import "server-only";
import { z } from "zod";

export const mailboxSchema = z.string().max(254).email().regex(/^[^\s<>\r\n,;]+$/);
const headerSchema = z.string().min(1).max(200).regex(/^[^\r\n\u0000-\u001f\u007f]+$/);
export const messageSchema = z.strictObject({
  from: z.strictObject({ email: mailboxSchema, name: headerSchema }),
  to: z.array(mailboxSchema).min(1).max(10),
  subject: headerSchema,
  html: z.string().min(1).max(30000),
  text: z.string().min(1).max(12000),
});
export type EmailMessage = z.infer<typeof messageSchema>;
export const inquiryEmailSchema = z.object({
  id: z.string().uuid(), public_reference: z.string().regex(/^INQ-[0-9a-f-]{36}$/),
  name: z.string().min(2).max(80), email: mailboxSchema,
  company: z.string().max(120).nullable(), service: z.string().max(100),
  budget: z.string().max(160).nullable(), timeline: z.string().max(160).nullable(),
  message: z.string().max(2000),
});
export type EmailInquiry = z.infer<typeof inquiryEmailSchema>;
export type EmailKind = "inquiry_client_v1" | "inquiry_admin_v1";
export type DeliveryResult =
  | { ok: true; messageId: string }
  | { ok: false; category: "delivery_uncertain" | "network" | "timeout" | "rate_limited" | "provider_unavailable" | "provider_rejected" | "invalid_message"; retryable: boolean; retryAfter?: number };
export interface EmailProvider {
  send(message: EmailMessage, idempotencyKey: string): Promise<DeliveryResult>;
}
