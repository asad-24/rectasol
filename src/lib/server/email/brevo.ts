import "server-only";
import { messageSchema, type EmailProvider, type DeliveryResult } from "@/lib/server/email/model";

async function readProviderJson(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return null; }
  } finally { reader.releaseLock(); }
}

// Fixed endpoint: neither job data nor configuration can select a network target.
export function createBrevoProvider(apiKey: string, request: typeof fetch = fetch, timeoutMs = 10000): EmailProvider {
  return { async send(message, idempotencyKey): Promise<DeliveryResult> {
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      return { ok: false, category: "invalid_message", retryable: false };
    }
    try {
      const response = await request("https://api.brevo.com/v3/smtp/email", {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sender: parsed.data.from, to: parsed.data.to.map(email => ({ email })),
          subject: parsed.data.subject, htmlContent: parsed.data.html, textContent: parsed.data.text,
          headers: { idempotencyKey },
        }),
      });
      // Never persist/return provider response bodies or error strings.
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const delay = header === null ? 60 : /^\d+$/.test(header) ? Number(header)
          : (Date.parse(header) - Date.now()) / 1000;
        return { ok: false, category: "rate_limited", retryable: true,
          retryAfter: Number.isFinite(delay) ? Math.min(3600, Math.max(0, Math.ceil(delay))) : 60 };
      }
      if (response.status >= 500 && response.status <= 599) {
        return { ok: false, category: "provider_unavailable", retryable: true };
      }
      if (response.status === 408) return { ok: false, category: "delivery_uncertain", retryable: false };
      if (response.status === 400 || response.status === 409) {
        const detail = await readProviderJson(response).catch(() => null);
        if (detail && typeof detail === "object" && "code" in detail && detail.code === "duplicate_parameter") {
          return { ok: false, category: "delivery_uncertain", retryable: false };
        }
      }
      if (!response.ok) return { ok: false, category: "provider_rejected", retryable: false };
      const data = await readProviderJson(response);
      const id = data && typeof data === "object" && "messageId" in data ? data.messageId : null;
      if (typeof id !== "string" || !/^[\x21-\x7e]{1,128}$/.test(id)) {
        return { ok: false, category: "delivery_uncertain", retryable: false };
      }
      return { ok: true, messageId: id };
    } catch (error) {
      const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      return { ok: false, category: timeout ? "timeout" : "network", retryable: false };
    }
  } };
}
