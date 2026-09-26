import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { serviceProcess, services } from "@/data/site";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Services",
  description: "Explore RectaSol services across web, mobile, AI, SaaS, CRM, e-commerce, design, cloud, APIs, security, maintenance, and growth.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-recta-ink pt-32 pb-20 text-white">
        <div className="absolute inset-0 grid-paper opacity-[0.08]" aria-hidden="true" />
        <div className="absolute right-20 top-20 size-96 rounded-full bg-recta-orange/20 blur-3xl" />
        <div className="container-page relative z-10 text-center">
          <div className="mb-6 inline-flex rounded-full bg-white/10 px-4 py-2 font-mono text-sm font-bold uppercase text-white/80">
            RectaSol services
          </div>
          <h1
            className="mx-auto max-w-5xl text-5xl font-black leading-tight md:text-7xl"
            style={{ color: "#ffffff" }}
          >
            Full-stack digital services for serious business systems
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-xl leading-8" style={{ color: "rgba(255,255,255,0.78)" }}>
            From first idea to launch and improvement, RectaSol provides the product, design, engineering,
            automation, cloud, and growth work needed to make systems useful.
          </p>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-page space-y-24">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.slug}>
                <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
                  <div className={index % 2 === 1 ? "lg:order-2" : ""}>
                    <span className="grid size-14 place-items-center rounded-lg bg-recta-ink text-white">
                      <Icon className="size-6" />
                    </span>
                    <p className="mt-6 font-mono text-xs font-black uppercase text-recta-orange">{service.eyebrow}</p>
                    <h2 className="mt-3 text-4xl font-black leading-tight text-recta-ink md:text-5xl">{service.title}</h2>
                    <p className="mt-5 text-lg leading-8 text-recta-slate">{service.description}</p>
                    <div className="mt-7 grid gap-3">
                      {service.capabilities.map((feature) => (
                        <div key={feature} className="flex items-center gap-3 text-sm font-bold text-recta-slate">
                          <span className="grid size-6 place-items-center rounded-md bg-recta-orange-strong text-white">
                            <Check className="size-3.5" />
                          </span>
                          {feature}
                        </div>
                      ))}
                    </div>
                    <Button asChild variant="accent" className="mt-8">
                      <Link href={`/services/${service.slug}`}>
                        Explore service
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="relative h-80 overflow-hidden rounded-lg bg-recta-muted shadow-2xl lg:h-96">
                    <Image src={service.image} alt={service.title} fill className="object-cover" sizes="(min-width: 1024px) 50vw, 100vw" />
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="section-pad bg-recta-muted/70">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex rounded-full bg-white px-4 py-2 font-mono text-sm font-bold uppercase text-recta-slate shadow-sm">
              Delivery process
            </div>
            <h2 className="text-4xl font-black leading-tight text-recta-ink md:text-5xl">
              From rough idea to maintained product
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {serviceProcess.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.step} className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-md bg-recta-ink text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-sm font-black text-recta-orange">{step.step}</span>
                  </div>
                  <h3 className="mt-6 text-2xl font-black text-recta-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-recta-slate">{step.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
