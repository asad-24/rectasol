"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const serviceOptions = [
  "Web application",
  "Mobile app",
  "AI automation",
  "SaaS platform",
  "CRM / ERP",
  "E-commerce",
  "UI/UX or branding",
  "Cloud / DevOps",
  "Maintenance / growth",
];

export function ContactForm() {
  const [service, setService] = useState(serviceOptions[0]);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      company: String(formData.get("company") || ""),
      service,
      budget: String(formData.get("budget") || ""),
      message: String(formData.get("message") || ""),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Please check the form and try again.");
      }

      toast.success("Project request received", {
        description: "RectaSol API stub accepted the inquiry. SMTP/CRM can be connected next.",
      });
      form.reset();
      setService(serviceOptions[0]);
    } catch (error) {
      toast.error("Could not send request", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-lg border border-recta-ink/10 bg-white p-5 shadow-xl sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-recta-ink">
          Name
          <Input name="name" placeholder="Asad" required minLength={2} />
        </label>
        <label className="grid gap-2 text-sm font-bold text-recta-ink">
          Email
          <Input name="email" type="email" placeholder="you@company.com" required />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold text-recta-ink">
          Company
          <Input name="company" placeholder="Company or project name" />
        </label>
        <label className="grid gap-2 text-sm font-bold text-recta-ink">
          Service
          <Select value={service} onValueChange={setService}>
            <SelectTrigger>
              <SelectValue placeholder="Choose service" />
            </SelectTrigger>
            <SelectContent>
              {serviceOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <label className="grid gap-2 text-sm font-bold text-recta-ink">
        Budget / timeline
        <Input name="budget" placeholder="Example: MVP in 6 weeks, flexible budget" />
      </label>
      <label className="grid gap-2 text-sm font-bold text-recta-ink">
        What should RectaSol build?
        <Textarea name="message" placeholder="Tell us the goal, users, current problem, and any systems involved." required minLength={20} />
      </label>
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        <Send className="size-4" />
        {pending ? "Sending..." : "Send project request"}
      </Button>
    </form>
  );
}
