import "server-only";
import { randomUUID } from "node:crypto";
import { contactSchema, type ContactErrors } from "@/lib/contact";
import type { saveInquiry } from "@/lib/server/inquiries";

const MAX_BYTES = 16 * 1024;
class BodyError extends Error {
  constructor(public status: number) { super("Invalid request body"); }
}

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new BodyError(413);
  if (!request.body) throw new BodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let expired = false;
  const cancel = () => { expired = true; void reader.cancel().catch(() => {}); };
  const timer = setTimeout(cancel, 5000);
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    if (request.signal.aborted) throw new BodyError(408);
    while (true) {
      const { done, value } = await reader.read();
      if (expired) throw new BodyError(408);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { void reader.cancel().catch(() => {}); throw new BodyError(413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function createContactHandler(save: typeof saveInquiry, siteOrigin: string) {
  return async function POST(request: Request) {
    const reply = (status: number, body: object, headers = {}) => Response.json(body, {
      status, headers: { "Cache-Control": "no-store", ...headers },
    });
    const failure = (status: number, code: string, message: string, extra = {}) => reply(status, { ok: false, code, message, ...extra });
    const origin = request.headers.get("origin");
    if ((origin && origin !== siteOrigin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return failure(403, "ORIGIN", "Please submit your inquiry from this website.");
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return failure(415, "CONTENT_TYPE", "Please use the website inquiry form with JavaScript enabled.");
    }
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      return failure(400, "SUBMISSION_KEY", "Please reload the form and try again.");
    }
    let body: unknown;
    try { body = await readBody(request); }
    catch (error) {
      const status = error instanceof BodyError ? error.status : 400;
      return failure(status, "BODY", status === 413 ? "Your inquiry is too large." : "The request could not be read. Please try again.");
    }
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const issues: ContactErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && field !== "website" && field in contactSchema.shape) {
          issues[field as keyof ContactErrors] = ["Please check this field and its length."];
        }
      }
      return failure(400, "VALIDATION", "Please check your inquiry details.", { issues });
    }
    if (parsed.data.website) return failure(400, "VALIDATION", "The inquiry could not be accepted.");
    try {
      const result = await save(parsed.data, key.toLowerCase(), request.headers);
      if (result.outcome === "rate_limited") return reply(429, {
        ok: false, code: "RATE_LIMIT", message: "Too many attempts. Please wait before trying again.",
      }, { "Retry-After": String(result.retry_after) });
      if (result.outcome === "conflict") return failure(409, "CONFLICT", "These details differ from an earlier submission. Please reload before submitting a new inquiry.");
      return reply(result.outcome === "created" ? 201 : 200, {
        ok: true, reference: result.reference, message: "Your inquiry has been received. Please keep your reference for future correspondence.",
      });
    } catch {
      // Never log request contents, credentials, or raw database errors.
      console.error("inquiry_persistence_failed", { requestId: randomUUID() });
      return failure(503, "UNAVAILABLE", "We could not confirm receipt. Your details are still here; retry with the same details to avoid a duplicate.");
    }
  };
}
