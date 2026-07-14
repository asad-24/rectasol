"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

export function TextReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const parts = node.querySelectorAll("[data-word]");
    gsap.fromTo(
      parts,
      { autoAlpha: 0, y: 80, rotateX: -70, filter: "blur(10px)" },
      { autoAlpha: 1, y: 0, rotateX: 0, filter: "blur(0px)", stagger: 0.055, duration: 0.85, delay: 0.75, ease: "power4.out" },
    );
  }, []);

  return (
    <h1 ref={ref} className={cn("perspective-distant", className)}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} data-word className="inline-block pr-3 align-top will-change-transform">
          {word}
        </span>
      ))}
    </h1>
  );
}
