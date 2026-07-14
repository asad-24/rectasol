import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getService, services } from "@/data/site";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FinalCTA } from "@/components/sections/FinalCTA";

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.description,
  };
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = getService(slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <>
      <section className="relative overflow-hidden pt-32 mesh-bg">
        <div className="absolute inset-0 grid-paper opacity-45" aria-hidden="true" />
        <div className="container-page relative z-10 grid gap-10 py-16 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <Badge>{service.eyebrow}</Badge>
            <h1 className="mt-5 text-4xl font-black leading-tight text-recta-ink sm:text-6xl">{service.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-recta-slate">{service.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="accent" size="lg">
                <Link href="/contact">
                  Plan this service
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/services">Back to services</Link>
              </Button>
            </div>
          </div>
          <div className="relative h-80 overflow-hidden rounded-lg border border-recta-ink/10 bg-white shadow-2xl">
            <Image src={service.image} alt={service.title} fill className="object-cover" sizes="(min-width: 1024px) 45vw, 100vw" priority />
          </div>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-page grid gap-8 lg:grid-cols-3">
          <Card className="p-6">
            <span className="grid size-12 place-items-center rounded-md bg-recta-ink text-white">
              <Icon className="size-5" />
            </span>
            <h2 className="mt-6 text-2xl font-black text-recta-ink">Outcomes</h2>
            <ul className="mt-5 grid gap-3">
              {service.outcomes.map((item) => (
                <li key={item} className="flex gap-3 text-sm font-semibold text-recta-slate">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-recta-orange" />
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="text-2xl font-black text-recta-ink">Capabilities</h2>
            <ul className="mt-5 grid gap-3">
              {service.capabilities.map((item) => (
                <li key={item} className="rounded-md bg-recta-muted px-4 py-3 text-sm font-bold text-recta-ink">
                  {item}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="text-2xl font-black text-recta-ink">Delivery Path</h2>
            <ol className="mt-5 grid gap-3">
              {service.process.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm font-semibold text-recta-slate">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-recta-ink font-mono text-xs text-white">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
