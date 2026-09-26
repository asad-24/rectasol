import { z } from "zod";

import { leadStatuses } from "@/lib/admin/statuses";
export { leadStatuses, type LeadStatus } from "@/lib/admin/statuses";
export const statusSchema = z.enum(leadStatuses);
export const identifierSchema = z.string().uuid();
export const loginSchema = z.strictObject({
  email: z.string().trim().email().max(120),
  password: z.string().min(1).max(256),
});
export const statusUpdateSchema = z.strictObject({
  id: identifierSchema,
  status: statusSchema,
  revision: z.string().regex(/^(0|[1-9]\d*)$/).transform(Number).pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)),
});
export const inquiryQuerySchema = z.strictObject({
  q: z.string().trim().max(80).default(""),
  status: z.union([statusSchema, z.literal("")]).default(""),
  page: z.string().regex(/^[1-9]\d{0,4}$/).default("1").transform(Number).pipe(z.number().max(10000)),
});
export type InquiryQuery = z.infer<typeof inquiryQuerySchema>;
export type AdminFeedback = { ok: boolean; message: string };

// Framework metadata is not application input. Repeated application fields fail.
export function readActionFields(form: FormData) {
  const fields: Record<string, unknown> = Object.create(null);
  for (const [key,value] of form.entries()) {
    if (key.startsWith("$ACTION_")) continue;
    fields[key] = Object.hasOwn(fields,key) ? null : value;
  }
  return fields;
}
