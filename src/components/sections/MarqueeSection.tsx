"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Asterisk } from "lucide-react";
import { marqueeCopy } from "@/data/site";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { Button } from "@/components/ui/button";

export function MarqueeSection() {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLHeadingElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
    tweenRef.current?.paused(paused);
  }, [paused]);

  useEffect(() => {
    const track = trackRef.current;
    const item = itemRef.current;
    if (!track || !item) return;

    if (reducedMotion) {
      gsap.set(track, { x: 0 });
      return;
    }

    const start = () => {
      tweenRef.current?.kill();
      const distance = item.getBoundingClientRect().width + 12;
      gsap.set(track, { x: 0 });
      tweenRef.current = gsap.to(track, {
        x: -distance,
        duration: 12,
        ease: "none",
        repeat: -1,
        paused: pausedRef.current,
      });
    };

    start();
    window.addEventListener("resize", start);
    return () => {
      window.removeEventListener("resize", start);
      tweenRef.current?.kill();
      gsap.set(track, { clearProps: "transform" });
    };
  }, [reducedMotion]);

  const item = (
    <h3 ref={itemRef} className="m-0 inline-flex items-center gap-3 py-3 text-3xl font-black text-white sm:text-5xl">
      <Asterisk className="size-7 shrink-0 text-recta-cyan" strokeWidth={2.5} />
      {marqueeCopy}
    </h3>
  );

  return (
    <section className="overflow-hidden bg-recta-ink">
      <div ref={trackRef} className="inline-flex items-center gap-3 whitespace-nowrap will-change-transform">
        {item}
        <h3 aria-hidden="true" className="m-0 inline-flex items-center gap-3 py-3 text-3xl font-black text-white sm:text-5xl">
          <Asterisk className="size-7 shrink-0 text-recta-cyan" strokeWidth={2.5} />
          {marqueeCopy}
        </h3>
      </div>
      {!reducedMotion && <div className="container-page pb-3">
        <Button type="button" variant="light" size="sm" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
          {paused ? "Resume scrolling text" : "Pause scrolling text"}
        </Button>
      </div>}
    </section>
  );
}
