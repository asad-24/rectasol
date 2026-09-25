"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { caseStudies } from "@/data/site";
import { Button } from "@/components/ui/button";
import { ProjectCover } from "./ProjectCover";
import { SectionHeader } from "./SectionHeader";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

export function FeaturedProjects() {
  return (
    <section className="section-pad bg-background">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            align="left"
            eyebrow="Featured work"
            title="Case-study patterns with product logic behind the polish"
            description="Each example is adapted into RectaSol thinking: clear workflows, useful interfaces, and measurable business outcomes."
          />
          <Button asChild variant="outline">
            <Link href="/case-studies">All case studies</Link>
          </Button>
        </div>

        <div className="mt-12 space-y-6">
          {caseStudies.map((study, index) => (
            <FeaturedProjectCard key={study.slug} study={study} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedProjectCard({ study, index }: { study: (typeof caseStudies)[number]; index: number }) {
  const reducedMotion = useReducedMotion();
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseMove={(event) => {
        if (reducedMotion) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setCursor({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="overflow-hidden rounded-lg border border-recta-ink/10 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <div className="grid gap-8 p-6 lg:grid-cols-2 lg:p-10">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm font-black text-recta-slate">({String(index + 1).padStart(2, "0")})</span>
              <span className="rounded-full bg-recta-muted px-3 py-1 text-xs font-bold text-recta-slate">{study.category}</span>
              <span className="rounded-full bg-recta-ink px-3 py-1 text-xs font-bold text-white">{study.status}</span>
            </div>
            <h3 className="mt-6 text-3xl font-black text-recta-ink sm:text-4xl">{study.title}</h3>
            <p className="mt-4 text-base leading-8 text-recta-slate">{study.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {study.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-recta-ink/10 px-3 py-1 font-mono text-xs font-bold text-recta-slate">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button asChild variant="accent">
                <Link href={`/case-studies/${study.slug}`}>
                  View details
                  <ArrowUpRight className="size-4" />
                </Link>
              </Button>
              <span className="font-mono text-xs font-black uppercase text-recta-slate">{study.role}</span>
            </div>
          </div>
          <Link href={`/case-studies/${study.slug}`} className="block transition duration-500 hover:scale-[1.02] motion-reduce:transform-none">
            <ProjectCover image={study.image} title={study.title} category={study.category} status={study.status} />
          </Link>
        </div>
      </div>
      <AnimatePresence>
        {hovered && !reducedMotion ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute z-10 rounded-full bg-recta-orange-strong px-5 py-2 text-sm font-black text-white shadow-lg"
            style={{ left: cursor.x, top: cursor.y, translateX: "-50%", translateY: "-50%" }}
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
          >
            View details
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
