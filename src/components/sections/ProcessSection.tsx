import { processSteps } from "@/data/site";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeader } from "./SectionHeader";

export function ProcessSection() {
  return (
    <section className="section-pad bg-recta-muted/70">
      <div className="container-page">
        <SectionHeader
          eyebrow="Process"
          title="A calm delivery system for complex ideas"
          description="RectaSol starts by making the work understandable, then builds with enough structure for the product to keep growing."
        />
        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 0.05}>
                <div className="relative h-full rounded-lg border border-recta-ink/10 bg-white p-6 shadow-sm">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-md bg-recta-ink text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="font-mono text-sm font-black text-recta-orange">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="text-xl font-black text-recta-ink">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-recta-slate">{step.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
