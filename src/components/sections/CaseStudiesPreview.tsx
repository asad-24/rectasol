import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { caseStudies } from "@/data/site";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "./SectionHeader";

export function CaseStudiesPreview() {
  return (
    <section className="section-pad bg-background">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            align="left"
            eyebrow="Case studies"
            title="Real product patterns adapted into RectaSol thinking"
            description="These examples show the kind of systems RectaSol can plan, design, build, and improve."
          />
          <Button asChild variant="outline">
            <Link href="/case-studies">View all work</Link>
          </Button>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {caseStudies.map((study, index) => (
            <Reveal key={study.slug} delay={index * 0.05}>
              <Link href={`/case-studies/${study.slug}`} className="group block h-full">
                <Card className="h-full overflow-hidden">
                  <div className="relative h-60 bg-recta-muted">
                    <Image src={study.image} alt={study.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 33vw, 100vw" />
                  </div>
                  <div className="p-6">
                    <Badge>{study.category}</Badge>
                    <h3 className="mt-4 text-2xl font-black text-recta-ink">{study.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-recta-slate">{study.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {study.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-recta-muted px-3 py-1 text-xs font-bold text-recta-slate">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex items-center gap-2 text-sm font-black text-recta-orange">
                      Open case study
                      <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
