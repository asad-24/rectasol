import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { services } from "@/data/site";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "./SectionHeader";

export function ServicesPreview() {
  return (
    <section className="section-pad bg-white">
      <div className="container-page">
        <SectionHeader
          eyebrow="Services"
          title="Every service is shaped around business logic, not just screens"
          description="RectaSol covers the full digital product chain: strategy, design, engineering, automation, infrastructure, and growth."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.slice(0, 9).map((service, index) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.slug} delay={index * 0.03}>
                <Link href={`/services/${service.slug}`} className="group block h-full">
                  <Card className="relative flex h-full flex-col overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:border-recta-orange/40">
                    <div className="relative h-44 overflow-hidden rounded-md bg-recta-muted">
                      <Image src={service.image} alt={service.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw" />
                    </div>
                    <div className="mt-5 flex items-start gap-4">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-recta-ink text-white">
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="font-mono text-xs font-bold uppercase text-recta-orange">{service.eyebrow}</p>
                        <h3 className="mt-1 text-xl font-black text-recta-ink">{service.title}</h3>
                      </div>
                    </div>
                    <p className="mt-4 flex-1 text-sm leading-7 text-recta-slate">{service.description}</p>
                    <div className="mt-5 flex items-center gap-2 text-sm font-black text-recta-orange">
                      View capability
                      <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                    </div>
                  </Card>
                </Link>
              </Reveal>
            );
          })}
        </div>
        <div className="mt-10 text-center">
          <Button asChild variant="accent">
            <Link href="/services">See all services</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
