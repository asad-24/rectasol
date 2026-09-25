import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import type { ContactInput } from "@/lib/contact";
import { getInquiryConfig } from "@/lib/server/inquiry-config";
import { createInquiryClient } from "@/lib/server/supabase";

const referenceSchema = z.string().regex(/^INQ-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const resultSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("created"), reference: referenceSchema }),
  z.object({ outcome: z.literal("replayed"), reference: referenceSchema }),
  z.object({ outcome: z.literal("rate_limited"), retry_after: z.number().int().min(1).max(900) }),
  z.object({ outcome: z.literal("conflict") }),
]);

export function prepareInquiry(input: ContactInput, headers: Headers, config: { hashSecret: string; ipHeader?: string }) {
  const payload = {
    name: input.name, email: input.email, company: input.company || null,
    service: input.service, budget: input.budget || null, timeline: input.timeline || null,
    message: input.message,
  };
  const hash = (scope: string, value: string) => createHmac("sha256", config.hashSecret).update(`${scope}:${value}`).digest("hex");
  const rawIp = config.ipHeader ? headers.get(config.ipHeader)?.trim() : undefined;
  // Do not guess which entry of an untrusted forwarded chain identifies a client.
  if (config.ipHeader && (!rawIp || !isIP(rawIp))) throw new Error("Trusted IP header is missing or invalid.");
  return {
    payload,
    requestHash: hash("payload-v1", JSON.stringify(payload)),
    emailHash: hash("email-v1", input.email),
    ipHash: rawIp ? hash("ip-v1", rawIp) : null,
  };
}

export async function saveInquiry(input: ContactInput, submissionKey: string, headers: Headers) {
  const prepared = prepareInquiry(input, headers, getInquiryConfig());
  const { data, error } = await createInquiryClient().rpc("submit_inquiry", {
    p_payload: prepared.payload,
    p_submission_key: submissionKey,
    p_request_hash: prepared.requestHash,
    p_email_hash: prepared.emailHash,
    p_ip_hash: prepared.ipHash,
  }).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error("Inquiry persistence failed.");
  return resultSchema.parse(data);
}
