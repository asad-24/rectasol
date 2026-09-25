"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";

export function CountUpNumber({
  end,
  suffix = "",
  start = true,
  duration = 1100,
}: {
  end: number;
  suffix?: string;
  start?: boolean;
  duration?: number;
}) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!start || reducedMotion) return;

    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [duration, end, start, reducedMotion]);

  return (
    <>
      {reducedMotion ? end : value}
      {suffix}
    </>
  );
}
