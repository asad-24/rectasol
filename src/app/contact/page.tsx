import type { Metadata } from "next";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageIntro } from "@/components/sections/PageIntro";
import { Card } from "@/components/ui/card";
import { contactInfo } from "@/data/site";
import { resolveContactService } from "@/lib/contact-options";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact RectaSol to plan a website, app, AI automation, SaaS platform, CRM, dashboard, cloud workflow, or digital growth system.",
};

export default async function ContactPage({ searchParams }: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const service = resolveContactService((await searchParams).service);
  return (
    <>
      <PageIntro
        eyebrow="Contact"
        title="Tell RectaSol what needs to exist, improve, or automate"
        description="Share your goals using the inquiry form below or email hello@rectasol.com. Once your inquiry is received, you will get a reference to keep."
      />
      <section className="section-pad bg-white">
        <div className="container-page mb-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {contactInfo.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-6 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-lg bg-recta-orange-strong text-white">
                  <Icon className="size-6" />
                </span>
                <p className="mt-5 font-mono text-xs font-black uppercase text-recta-slate">{item.title}</p>
                <h2 className="mt-2 text-xl font-black text-recta-ink">{item.value}</h2>
                <div className="mt-4 space-y-1">
                  {item.details.map((detail) => (
                    <p key={detail} className="text-xs font-semibold text-recta-slate">{detail}</p>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
        <div className="container-page grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg bg-recta-ink p-6 text-white">
            <p className="font-mono text-xs font-black uppercase text-recta-lime">Before you send</p>
            <h2 className="mt-3 text-3xl font-black text-white">Useful context makes the first reply sharper.</h2>
            <div className="mt-6 grid gap-4">
              {[
                { label: "Goal", value: "What should the system help people do?" },
                { label: "Current state", value: "Is this a new idea, redesign, rescue, or automation?" },
                { label: "Timeline", value: "Is there a launch date, sales need, or operational deadline?" },
              ].map((item) => {
                return (
                  <div key={item.label} className="rounded-md border border-white/10 bg-white/[0.05] p-4">
                    <p className="font-mono text-xs font-black uppercase text-recta-lime">{item.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white/68">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <ContactForm key={service} initialService={service} />
        </div>
      </section>
    </>
  );
}
