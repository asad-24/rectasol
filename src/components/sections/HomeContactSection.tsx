import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { contactInfo } from "@/data/site";
import { SectionHeader } from "./SectionHeader";

export function HomeContactSection() {
  return (
    <section className="section-pad bg-white">
      <div className="container-page">
        <SectionHeader
          eyebrow="Get in touch"
          title="Tell RectaSol what needs to exist next"
          description="A project does not need perfect requirements to start. It needs honest context, a useful first target, and a clear next decision."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-5">
            {contactInfo.slice(0, 3).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className="group flex items-center gap-5 rounded-lg border border-recta-ink/10 bg-background p-5 transition hover:border-recta-orange/40 hover:bg-white">
                  <span className="grid size-13 shrink-0 place-items-center rounded-md bg-recta-ink text-white transition group-hover:bg-recta-orange">
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <span className="font-mono text-xs font-black uppercase text-recta-slate">{item.title}</span>
                    <span className="mt-1 block text-lg font-black text-recta-ink">{item.value}</span>
                  </span>
                </Link>
              );
            })}
            <div className="rounded-lg border border-recta-ink/10 bg-recta-ink p-6 text-white">
              <h3 className="text-2xl font-black text-white">Why work with RectaSol?</h3>
              <ul className="mt-5 grid gap-3">
                {["Founder-led discovery", "Clear project scope", "Typed modern stack", "Post-launch improvement path"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-semibold text-white/70">
                    <CheckCircle2 className="size-4 text-recta-lime" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
