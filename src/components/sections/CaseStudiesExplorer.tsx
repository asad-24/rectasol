"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { caseStudies, projectFilters } from "@/data/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProjectCover } from "./ProjectCover";

export function CaseStudiesExplorer() {
  const [activeFilter, setActiveFilter] = useState<(typeof projectFilters)[number]>("All");
  const filtered = useMemo(
    () => (activeFilter === "All" ? caseStudies : caseStudies.filter((study) => study.category === activeFilter)),
    [activeFilter],
  );

  return (
    <>
      <section className="sticky top-20 z-30 border-b border-recta-ink/10 bg-white/92 py-5 backdrop-blur-xl">
        <div className="container-page flex flex-wrap items-center justify-center gap-2">
          {projectFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full px-5 py-2 font-mono text-sm font-black transition",
                activeFilter === filter ? "bg-recta-orange text-white" : "bg-recta-muted text-recta-slate hover:bg-recta-ink hover:text-white",
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>
      <section className="section-pad bg-white">
        <div className="container-page grid gap-6 lg:grid-cols-2">
          {filtered.map((study) => (
            <article key={study.slug} className="overflow-hidden rounded-lg border border-recta-ink/10 bg-background shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
              <Link href={`/case-studies/${study.slug}`} className="block">
                <ProjectCover image={study.image} title={study.title} category={study.category} status={study.status} />
              </Link>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {study.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-recta-ink/10 bg-white px-3 py-1 text-xs font-bold text-recta-slate">
                      {tag}
                    </span>
                  ))}
                </div>
                <h2 className="mt-5 text-3xl font-black text-recta-ink">{study.title}</h2>
                <p className="mt-4 text-sm leading-7 text-recta-slate">{study.description}</p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Button asChild variant="accent">
                    <Link href={`/case-studies/${study.slug}`}>
                      Open study
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                  <span className="font-mono text-xs font-black uppercase text-recta-slate">{study.role}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
