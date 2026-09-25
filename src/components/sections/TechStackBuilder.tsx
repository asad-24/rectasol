"use client";

import { useMemo, useState } from "react";
import { Check, Plus, RotateCcw } from "lucide-react";
import { techCategories } from "@/data/site";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SectionHeader } from "./SectionHeader";

export function TechStackBuilder() {
  const [selected, setSelected] = useState<string[]>(["Next.js", "TypeScript", "OpenAI", "PostgreSQL"]);
  const allItems = useMemo(() => techCategories.flatMap((category) => category.items), []);

  const toggle = (item: string) => {
    setSelected((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]));
  };

  return (
    <section className="section-pad bg-white">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <SectionHeader
            align="left"
            eyebrow="Interactive stack"
            title="Build a logical stack before writing code"
            description="Select the tools your product may need. RectaSol turns stack choices into architecture, delivery, and maintenance decisions."
          />
          <div className="rounded-lg border border-recta-ink/10 bg-recta-ink p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-xs uppercase text-white/50">Selected build path</p>
                <h3 className="mt-1 text-2xl font-black text-white">{selected.length} technologies</h3>
              </div>
              <Button variant="light" size="sm" onClick={() => setSelected([])}>
                <RotateCcw className="size-4" />
                Reset
              </Button>
            </div>
            <div className="mt-5 flex min-h-24 flex-wrap gap-2 rounded-md border border-dashed border-white/20 bg-white/[0.04] p-4">
              {selected.length ? (
                selected.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggle(item)}
                    aria-label={`Remove ${item} from selected technologies`}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-bold text-recta-ink"
                  >
                    <Check className="size-3 text-recta-orange" />
                    {item}
                  </button>
                ))
              ) : (
                <p className="self-center text-sm font-semibold text-white/45">Select technologies below to shape the project system.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-4">
          {techCategories.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.name} className="rounded-lg border border-recta-ink/10 bg-white p-5 shadow-sm">
                <div className="mb-5 flex items-center gap-3">
                  <span className={cn("grid size-10 place-items-center rounded-md bg-gradient-to-br text-white", category.color)}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-black text-recta-ink">{category.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.items.map((item) => {
                    const active = selected.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggle(item)}
                        aria-pressed={active}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition",
                          active
                            ? "border-recta-orange-strong bg-recta-orange-strong text-white"
                            : "border-recta-ink/10 bg-recta-muted text-recta-slate hover:border-recta-orange hover:text-recta-ink",
                        )}
                      >
                        {!active ? <Plus className="size-3" /> : <Check className="size-3" />}
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-recta-slate">
          {allItems.length} practical tools across frontend, backend, AI, data, cloud, and launch operations.
        </p>
      </div>
    </section>
  );
}
