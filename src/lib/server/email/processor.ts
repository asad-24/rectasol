import "server-only";
import { z } from "zod";
import { inquiryEmailSchema, messageSchema, type EmailProvider } from "@/lib/server/email/model";
import { renderInquiryEmail } from "@/lib/server/email/templates";

export type EmailRpc = (name: string, args?: Record<string, unknown>) => Promise<unknown>;
const jobSchema = z.object({
  provider: z.literal("brevo"),
  id: z.string().uuid(), kind: z.enum(["inquiry_client_v1", "inquiry_admin_v1"]),
  lease_token: z.string().uuid(), attempts: z.number().int().min(1).max(6),
  first_attempt_at: z.string().datetime({ offset: true }),
  message: z.unknown().nullable(), inquiry: inquiryEmailSchema,
});

// One bounded job per invocation. Database functions own all durable transitions.
export async function processEmailDelivery(rpc: EmailRpc, provider: EmailProvider,
  config: { from: { email: string; name: string }; recipients: string[]; siteUrl: string }) {
  const raw = await rpc("claim_email_delivery");
  if (raw === null) return { outcome: "idle" };
  const job = jobSchema.parse(raw);
  let candidate;
  try {
    candidate = job.message === null ? renderInquiryEmail(job.kind, job.inquiry, config) : messageSchema.parse(job.message);
  } catch {
    const saved = await rpc("finish_email_delivery", { p_id: job.id, p_lease: job.lease_token,
      p_message_id: null, p_error: "invalid_message", p_retryable: false });
    if (saved !== true) throw new Error("Email state unavailable.");
    return { outcome: "failed" };
  }
  // Do not send unless the exact payload was durably saved and lease rechecked.
  const prepared = await rpc("prepare_email_delivery", {
    p_id: job.id, p_lease: job.lease_token, p_message: candidate,
  });
  if (prepared === null) return { outcome: "lease_lost" };
  // Conservative local guard as well as database deadline (one minute margin).
  if (Date.now() - Date.parse(job.first_attempt_at) >= 19 * 60000) return { outcome: "lease_lost" };
  const result = await provider.send(messageSchema.parse(prepared), job.id);
  const saved = await rpc("finish_email_delivery", {
    p_id: job.id, p_lease: job.lease_token,
    p_message_id: result.ok ? result.messageId : null,
    p_error: result.ok ? null : result.category,
    p_retryable: !result.ok && result.retryable,
    p_retry_after: result.ok ? 0 : result.retryAfter ?? 0,
  });
  // Failed acknowledgement leaves the dispatch marker; lease expiry quarantines it.
  if (saved !== true) throw new Error("Email state unavailable.");
  return { outcome: result.ok ? "sent" : "attempt_recorded" };
}
