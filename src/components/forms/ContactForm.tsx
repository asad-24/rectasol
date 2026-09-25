"use client";

import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contactLimits, resolveContactService, serviceOptions } from "@/lib/contact-options";
import type { ContactErrors, ContactField } from "@/lib/contact";

export function ContactForm({ initialService }: { initialService?: string }) {
  const id = useId();
  const [service, setService] = useState(() => resolveContactService(initialService));
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [feedback, setFeedback] = useState("");
  const [reference, setReference] = useState("");
  const submissionRef = useRef<{ body: string; key: string } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  function fieldProps(field: ContactField) {
    return {
      id: `${id}-${field}`,
      "aria-invalid": Boolean(errors[field]?.length),
      "aria-describedby": errors[field]?.length ? `${id}-${field}-error` : undefined,
    };
  }

  function fieldError(field: ContactField) {
    return errors[field]?.length ? (
      <span id={`${id}-${field}-error`} className="text-sm font-medium text-red-700">{errors[field]?.[0]}</span>
    ) : null;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || reference) return;
    const controller = new AbortController();
    requestRef.current = controller;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = JSON.stringify({
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      company: String(formData.get("company") || ""),
      service,
      budget: String(formData.get("budget") || ""),
      timeline: String(formData.get("timeline") || ""),
      message: String(formData.get("message") || ""),
      website: String(formData.get("website") || ""),
    });
    setPending(true);
    setErrors({});
    setFeedback("");
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    try {
      if (submissionRef.current?.body !== body) {
        submissionRef.current = { body, key: crypto.randomUUID() };
      }
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": submissionRef.current.key },
        body,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!form.isConnected) return;
      if (!response.ok || result.ok !== true) {
        const issues: ContactErrors = result.issues ?? {};
        setErrors(issues);
        const first = (["name", "email", "company", "service", "budget", "timeline", "message"] as const)
          .find((field) => issues[field]?.length);
        setFeedback(result.message || "Please check your details and try again.");
        // Wait for controls to be enabled before focusing the invalid field.
        requestAnimationFrame(() => {
          if (form.isConnected) {
            (first ? document.getElementById(`${id}-${first}`) : feedbackRef.current)?.focus();
          }
        });
        return;
      }
      if (typeof result.reference !== "string" || !/^INQ-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result.reference)) {
        throw new Error("Invalid receipt");
      }
      setReference(result.reference);
      setFeedback("Your inquiry has been received. Keep your reference for future correspondence.");
    } catch {
      if (!form.isConnected) return;
      setFeedback(controller.signal.aborted
        ? "We could not confirm receipt before the request timed out. Your entries are still here. Retry with the same details to avoid a duplicate."
        : "We could not confirm receipt. Your entries are still here. Retry with the same details or email RectaSol.");
    } finally {
      window.clearTimeout(timeout);
      requestRef.current = null;
      if (form.isConnected) setPending(false);
    }
  }

  return (
    <form method="post" action="/api/contact" onSubmit={onSubmit} aria-busy={pending} aria-describedby={`${id}-notice`} className="grid gap-4 rounded-lg border border-recta-ink/10 bg-white p-5 shadow-xl sm:p-6">
      <p id={`${id}-notice`} className="text-sm leading-6 text-recta-slate">
        Send your project inquiry securely, or email{" "}
        <a href="mailto:hello@rectasol.com" className="font-bold text-recta-orange-strong underline">hello@rectasol.com</a>.
      </p>
      <noscript><p>This form requires JavaScript. Please email hello@rectasol.com instead.</p></noscript>
      <fieldset disabled={pending || Boolean(reference)} className="grid min-w-0 gap-4">
        <legend className="sr-only">Project inquiry details</legend>
        <div hidden aria-hidden="true">
          <label htmlFor={`${id}-website`}>Leave this field empty</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" maxLength={200} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={`${id}-name`} className="grid gap-2 text-sm font-bold text-recta-ink">
            Name
            <Input {...fieldProps("name")} name="name" autoComplete="name" placeholder="Asad" required minLength={contactLimits.name.min} maxLength={contactLimits.name.max} />
            {fieldError("name")}
          </label>
          <label htmlFor={`${id}-email`} className="grid gap-2 text-sm font-bold text-recta-ink">
            Email
            <Input {...fieldProps("email")} name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={contactLimits.email.max} />
            {fieldError("email")}
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={`${id}-company`} className="grid gap-2 text-sm font-bold text-recta-ink">
            Company
            <Input {...fieldProps("company")} name="company" autoComplete="organization" placeholder="Company or project name" maxLength={contactLimits.company.max} />
            {fieldError("company")}
          </label>
          <div className="grid gap-2 text-sm font-bold text-recta-ink">
            <label htmlFor={`${id}-service`}>Service</label>
            <Select value={service} onValueChange={setService} disabled={pending || Boolean(reference)}>
              <SelectTrigger {...fieldProps("service")}><SelectValue placeholder="Choose service" /></SelectTrigger>
              <SelectContent>
                {serviceOptions.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
            {fieldError("service")}
          </div>
        </div>
        <label htmlFor={`${id}-budget`} className="grid gap-2 text-sm font-bold text-recta-ink">
          Budget
          <Input {...fieldProps("budget")} name="budget" placeholder="Your estimated budget, if known" maxLength={contactLimits.budget.max} />
          {fieldError("budget")}
        </label>
        <label htmlFor={`${id}-timeline`} className="grid gap-2 text-sm font-bold text-recta-ink">
          Timeline
          <Input {...fieldProps("timeline")} name="timeline" placeholder="Example: MVP in 6 weeks" maxLength={contactLimits.timeline.max} />
          {fieldError("timeline")}
        </label>
        <label htmlFor={`${id}-message`} className="grid gap-2 text-sm font-bold text-recta-ink">
          What should RectaSol build?
          <Textarea {...fieldProps("message")} name="message" placeholder="Tell us the goal, users, current problem, and any systems involved." required minLength={contactLimits.message.min} maxLength={contactLimits.message.max} />
          {fieldError("message")}
        </label>
        <Button type="submit" variant="accent" size="lg" disabled={pending || Boolean(reference)}>
          <Send className="size-4" aria-hidden="true" />
          {pending ? "Sending inquiry..." : reference ? "Inquiry received" : "Send project inquiry"}
        </Button>
      </fieldset>
      <p ref={feedbackRef} tabIndex={-1} role="status" aria-live="polite" aria-atomic="true" className="text-sm leading-6 text-recta-ink">
        {pending ? "Sending your inquiry. Please wait." : feedback}
        {reference && <span className="mt-2 block break-all font-bold">Reference: {reference}</span>}
      </p>
    </form>
  );
}
