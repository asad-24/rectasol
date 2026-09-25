import { z } from "zod";
import { contactLimits, serviceOptions } from "@/lib/contact-options";
export { contactLimits, serviceOptions, resolveContactService } from "@/lib/contact-options";

export const contactSchema = z.strictObject({
  name: z.string().trim().min(contactLimits.name.min, "Enter at least 2 characters.").max(contactLimits.name.max),
  email: z.string().trim().email("Enter a valid email address.").max(contactLimits.email.max).toLowerCase(),
  company: z.string().trim().max(contactLimits.company.max).optional(),
  service: z.string().trim().refine((value) => serviceOptions.some(({ value: slug }) => slug === value), "Choose a listed service."),
  budget: z.string().trim().max(contactLimits.budget.max).optional(),
  timeline: z.string().trim().max(contactLimits.timeline.max).optional(),
  message: z.string().trim().min(contactLimits.message.min, "Add at least 20 characters.").max(contactLimits.message.max),
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactField = Exclude<keyof ContactInput, "website">;
export type ContactErrors = Partial<Record<ContactField, string[]>>;

export type ContactResponse =
  | { ok: true; reference: string; message: string }
  | { ok: false; code: string; message: string; issues?: ContactErrors };
