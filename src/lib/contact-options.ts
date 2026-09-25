import { services } from "@/data/site";

// Browser-safe constraints and catalog options; no database or validation runtime.
export const contactLimits = {
  name: { min: 2, max: 80 }, email: { max: 120 }, company: { max: 120 },
  budget: { max: 160 }, timeline: { max: 160 }, message: { min: 20, max: 2000 },
} as const;

export const serviceOptions = services.map(({ slug, title }) => ({ value: slug, label: title }));

export function resolveContactService(value: unknown) {
  return typeof value === "string" && serviceOptions.some(({ value: slug }) => slug === value)
    ? value : serviceOptions[0].value;
}
