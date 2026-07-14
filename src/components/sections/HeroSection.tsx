"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { TextReveal } from "@/components/motion/TextReveal";
import { stats } from "@/data/site";

export function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const style = {
    "--hero-x": "50%",
    "--hero-y": "50%",
  } as CSSProperties;

  useEffect(() => {
    const section = sectionRef.current;
    const panel = panelRef.current;
    const glow = glowRef.current;
    if (!section || !panel || !glow) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const panelX = gsap.quickTo(panel, "rotateY", { duration: 0.8, ease: "power3.out" });
    const panelY = gsap.quickTo(panel, "rotateX", { duration: 0.8, ease: "power3.out" });
    const glowX = gsap.quickTo(glow, "x", { duration: 0.9, ease: "power3.out" });
    const glowY = gsap.quickTo(glow, "y", { duration: 0.9, ease: "power3.out" });

    const onMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      section.style.setProperty("--hero-x", `${x * 100}%`);
      section.style.setProperty("--hero-y", `${y * 100}%`);
      panelX((x - 0.5) * 8);
      panelY((0.5 - y) * 8);
      glowX((x - 0.5) * 48);
      glowY((y - 0.5) * 36);
    };

    const onLeave = () => {
      section.style.setProperty("--hero-x", "50%");
      section.style.setProperty("--hero-y", "50%");
      panelX(0);
      panelY(0);
      glowX(0);
      glowY(0);
    };

    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);
    return () => {
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section ref={sectionRef} style={style} className="relative min-h-screen overflow-hidden pt-28 mesh-bg">
      <div className="absolute inset-0 grid-paper opacity-60" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at var(--hero-x) var(--hero-y), rgba(255,106,53,0.2), rgba(35,182,216,0.12) 18%, transparent 43%)",
        }}
      />
      <div ref={glowRef} className="pointer-events-none absolute right-[8%] top-[16%] size-80 rounded-full bg-recta-cyan/20 blur-3xl" />
      <div className="container-page relative z-10 grid min-h-[calc(100vh-7rem)] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-recta-ink/10 bg-white/80 px-4 py-2 text-sm font-bold text-recta-slate shadow-sm backdrop-blur">
            <Sparkles className="size-4 text-recta-orange" />
            Advanced software company by Asad
          </div>
          <TextReveal
            text="RectaSol builds logical digital systems for ambitious businesses"
            className="mt-7 max-w-4xl text-5xl font-black leading-[0.98] text-recta-ink sm:text-6xl lg:text-7xl"
          />
          <p className="mt-7 max-w-2xl text-lg leading-8 text-recta-slate">
            Websites, apps, AI automation, SaaS platforms, CRM systems, dashboards, cloud workflows, and growth tools
            designed to work smoothly from first click to daily operations.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="accent" size="lg">
              <Link href="/contact">
                Start a Project
                <ArrowRight className="size-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/services">Explore Services</Link>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-recta-ink/10 bg-white/70 p-4 backdrop-blur">
                <div className="text-2xl font-black text-recta-ink">{stat.value}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-normal text-recta-slate">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div ref={panelRef} className="relative rounded-lg border border-recta-ink/10 bg-white/82 p-4 shadow-2xl backdrop-blur-xl will-change-transform">
          <div className="rounded-md bg-recta-ink p-5 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-xs uppercase text-white/55">RectaSol OS</p>
                <h2 className="mt-1 text-2xl font-black text-white">Project logic board</h2>
              </div>
              <div className="size-3 rounded-full bg-recta-lime shadow-[0_0_24px_rgba(165,223,85,0.8)]" />
            </div>
            <div className="mt-5 grid gap-3">
              {[
                "Discovery translated into clear scope",
                "Typed UI, APIs, data and automation",
                "Launch-ready performance and analytics",
                "Maintenance plan after first release",
              ].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-white/10 font-mono text-xs">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-sm font-semibold text-white/84">{item}</span>
                  <CheckCircle2 className="ml-auto size-4 text-recta-lime" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {["AI", "SaaS", "Cloud"].map((item) => (
              <div key={item} className="rounded-md bg-recta-muted p-4 text-center text-sm font-black text-recta-ink">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
