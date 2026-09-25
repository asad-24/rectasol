"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";
import { CountUpNumber } from "@/components/ui/CountUpNumber";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

gsap.registerPlugin(ScrollTrigger);

const headline = "RectaSol builds resilient software, smarter automations, and digital systems that scale with your operations.";

export function AboutFeatureSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const [inView, setInView] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const heading = headlineRef.current;
    if (!section || !heading) return;

    const chars = heading.querySelectorAll("[data-about-char]");

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: "top 70%",
        once: true,
        onEnter: () => setInView(true),
      });

      if (reducedMotion) {
        gsap.set(chars, { autoAlpha: 1 });
        return;
      }

      gsap.from(chars, {
        duration: 0.8,
        scale: 3.4,
        autoAlpha: 0,
        rotationX: -120,
        transformOrigin: "100% 50%",
        ease: "back.out(1.7)",
        stagger: 0.012,
        scrollTrigger: {
          trigger: heading,
          start: "top 80%",
          once: true,
        },
      });
    }, section);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="bg-white py-10">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-lg bg-recta-ink p-8 text-white shadow-2xl sm:p-12 lg:p-16">
          <div className="absolute inset-0 grid-paper opacity-[0.05]" aria-hidden="true" />
          <div className="relative z-10">
            <h2 ref={headlineRef} aria-label={headline} className="text-3xl font-black leading-tight text-white sm:text-5xl">
              <span className="sr-only">{headline}</span>
              <span aria-hidden="true">
                {headline.split(" ").map((word, index) => {
                  const normalized = word.replace(/[^a-z]/gi, "").toLowerCase();
                  const color =
                    normalized === "resilient"
                      ? "text-white/55"
                      : normalized === "smarter"
                        ? "text-recta-cyan"
                        : normalized === "scale"
                          ? "text-recta-orange"
                          : "text-white";

                  return (
                    <span key={`${word}-${index}`} className={`mr-3 inline-block ${color}`}>
                      {Array.from(word).map((char, charIndex) => (
                        <span key={`${word}-${charIndex}`} data-about-char className="inline-block will-change-transform">
                          {char}
                        </span>
                      ))}
                    </span>
                  );
                })}
              </span>
            </h2>

            <div className="mt-12 grid gap-10 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-4">
                <div className="font-mono text-6xl font-black text-white">
                  <CountUpNumber end={30} suffix="+" start={inView} />
                </div>
                <p className="mt-2 text-lg font-semibold text-white/62">digital service directions</p>
              </div>
              <div className="space-y-5 text-base leading-8 text-white/68 lg:col-span-5">
                <p>
                  RectaSol is designed for founders and teams that need practical software, not decorative pages with no
                  operational logic.
                </p>
                <p>
                  Asad leads the company around a simple rule: every interface, automation, and data flow should make the
                  business easier to run.
                </p>
              </div>
              <div className="lg:col-span-3">
                <Button asChild variant="light" size="lg" className="w-full">
                  <Link href="/about">
                    About RectaSol
                    <ArrowRight className="size-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
