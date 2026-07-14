import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { caseStudies, getCaseStudy } from "@/data/site";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ProjectGallery } from "@/components/sections/ProjectGallery";
import { ProjectCover } from "@/components/sections/ProjectCover";

export function generateStaticParams() {
  return caseStudies.map((study) => ({ slug: study.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) return {};
  return {
    title: study.title,
    description: study.description,
  };
}

export default async function CaseStudyDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = getCaseStudy(slug);
  if (!study) notFound();
  const relatedProjects = caseStudies.filter((item) => item.slug !== study.slug).slice(0, 2);

  return (
    <>
      <section className="relative overflow-hidden bg-recta-ink pt-32 pb-20 text-white">
        <div className="absolute inset-0 grid-paper opacity-[0.08]" aria-hidden="true" />
        <div className="container-page relative z-10">
          <Button asChild variant="light" className="mb-8">
            <Link href="/case-studies">
              <ArrowLeft className="size-4" />
              Back to case studies
            </Link>
          </Button>
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <Badge className="bg-white/10 text-white">{study.category}</Badge>
              <h1 className="mt-5 text-4xl font-black leading-tight text-white sm:text-6xl">{study.title}</h1>
              <p className="mt-6 text-lg leading-8 text-white/70">{study.description}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {study.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/72">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-8 grid gap-3 text-sm font-semibold text-white/62 sm:grid-cols-3">
                <span>Role: {study.role}</span>
                <span>Status: {study.status}</span>
                <span>Context: {study.clientName}</span>
              </div>
              <Button asChild variant="accent" size="lg" className="mt-8">
                <Link href="/contact">
                  Build something similar
                  <ArrowRight className="size-5" />
                </Link>
              </Button>
            </div>
            <ProjectGallery images={study.galleryImages.length ? study.galleryImages : [study.image]} title={study.title} />
          </div>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-sm font-black uppercase text-recta-orange">Overview</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-recta-ink">The product thinking behind the interface</h2>
          </div>
          <div className="space-y-5 text-base leading-8 text-recta-slate">
            {study.overview.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-recta-muted/70">
        <div className="container-page grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-2xl font-black text-recta-ink">Challenge</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-recta-slate">
              {study.challenge.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h2 className="text-2xl font-black text-recta-ink">Solution</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-recta-slate">
              {study.solution.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-sm font-black uppercase text-recta-orange">Features</p>
            <h2 className="mt-4 text-4xl font-black text-recta-ink">What the system needs to do well</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {study.features.map((feature) => (
              <Card key={feature.title} className="p-6">
                <CheckCircle2 className="size-6 text-recta-orange" />
                <h3 className="mt-5 text-xl font-black text-recta-ink">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-recta-slate">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-recta-ink text-white">
        <div className="container-page grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="font-mono text-sm font-black uppercase text-recta-lime">Architecture</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-white">A practical system shape, not only a page design</h2>
          </div>
          <div className="grid gap-3">
            {study.architecture.map((item, index) => (
              <div key={item} className="flex gap-4 rounded-lg border border-white/10 bg-white/[0.05] p-4">
                <span className="font-mono text-sm font-black text-recta-lime">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-sm font-semibold leading-7 text-white/70">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-pad bg-white">
        <div className="container-page grid gap-5 md:grid-cols-3">
          {study.impact.map((item) => (
            <Card key={item} className="p-6">
              <CheckCircle2 className="size-6 text-recta-orange" />
              <h2 className="mt-5 text-xl font-black text-recta-ink">{item}</h2>
              <p className="mt-3 text-sm leading-7 text-recta-slate">
                RectaSol would treat this as a measurable product outcome, then design the screens, workflows, and data around it.
              </p>
            </Card>
          ))}
        </div>
      </section>

      {relatedProjects.length ? (
        <section className="section-pad bg-background">
          <div className="container-page">
            <h2 className="text-4xl font-black text-recta-ink">Related project patterns</h2>
            <div className="mt-8 grid gap-5 lg:grid-cols-2">
              {relatedProjects.map((project) => (
                <Link key={project.slug} href={`/case-studies/${project.slug}`} className="group rounded-lg bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <ProjectCover image={project.image} title={project.title} category={project.category} status={project.status} />
                  <div className="p-3">
                    <h3 className="mt-3 text-2xl font-black text-recta-ink">{project.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-recta-slate">{project.description}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-recta-orange">
                      View related study
                      <ArrowUpRight className="size-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      <FinalCTA />
    </>
  );
}
