import "server-only";
import { z } from "zod";
import { mailboxSchema } from "@/lib/server/email/model";

export function getEmailConfig() {
  // Parse without propagating Zod errors, which may contain configuration values.
  const parsed = z.object({
    apiKey: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
    from: mailboxSchema,
    fromName: z.string().trim().min(1).max(100).regex(/^[^\u0000-\u001f\u007f<>]+$/),
    recipients: z.array(mailboxSchema).min(1).max(10),
  }).safeParse({
    apiKey: process.env.BREVO_API_KEY,
    from: process.env.EMAIL_FROM,
    fromName: process.env.EMAIL_FROM_NAME,
    recipients: process.env.EMAIL_ADMIN_RECIPIENTS?.split(",").map(value => value.trim()),
  });
  if (!parsed.success) throw new Error("Email configuration unavailable.");
  const recipients = [...new Set(parsed.data.recipients.map(value => value.toLowerCase()))];
  return { apiKey: parsed.data.apiKey, from: { email: parsed.data.from, name: parsed.data.fromName }, recipients };
}

export function getEmailWorkerSecret() {
  const value = process.env.EMAIL_WORKER_SECRET;
  if (!value || !/^[A-Za-z0-9_-]{32,128}$/.test(value)) throw new Error("Email processing unavailable.");
  return value;
}
