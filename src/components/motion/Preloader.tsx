"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const STARTUP_STORAGE_KEY = "rectasol-startup-seen";

export function Preloader() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    try {
      if (window.sessionStorage.getItem(STARTUP_STORAGE_KEY) === "true") return;
    } catch {
      // Storage is optional; the animation still has a CSS release deadline.
    }

    const finish = () => {
      try {
        window.sessionStorage.setItem(STARTUP_STORAGE_KEY, "true");
      } catch {
        // Storage can be unavailable in strict privacy modes; still release the page.
      }

      delete node.dataset.active;
    };

    let finished = false;
    const safeFinish = () => {
      if (finished) return;
      finished = true;
      finish();
    };
    const maxReleaseTimeout = window.setTimeout(safeFinish, 4200);
    preference.addEventListener("change", safeFinish);
    window.addEventListener("pointerdown", safeFinish, { once: true });
    window.addEventListener("keydown", safeFinish, { once: true });
    node.dataset.active = "true";

    const ctx = gsap.context(() => {}, node);
    try {
      ctx.add(() => {
      const tl = gsap.timeline({
        defaults: { ease: "power3.inOut" },
        onComplete: safeFinish,
      });

      tl.fromTo("[data-startup-stage]", { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18 })
        .fromTo(
          "[data-startup-word]",
          { autoAlpha: 0, y: 42, rotateX: -65, filter: "blur(12px)" },
          {
            autoAlpha: 1,
            y: 0,
            rotateX: 0,
            filter: "blur(0px)",
            duration: 0.58,
            stagger: 0.18,
            ease: "power4.out",
          },
        )
        .to(
          "[data-startup-word]",
          {
            autoAlpha: 0,
            y: -34,
            filter: "blur(8px)",
            duration: 0.44,
            stagger: 0.08,
            ease: "power3.in",
          },
          "+=0.28",
        )
        .fromTo(
          "[data-startup-wipe]",
          { autoAlpha: 1, xPercent: -110, scaleX: 0.22 },
          { xPercent: 0, scaleX: 1, duration: 0.46 },
          "-=0.08",
        )
        .to("[data-startup-wipe]", { xPercent: 110, scaleX: 0.28, duration: 0.38 })
        .fromTo(
          "[data-startup-brand]",
          { autoAlpha: 0, y: 22, filter: "blur(10px)" },
          { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.42, ease: "power3.out" },
          "-=0.38",
        )
        .fromTo(
          "[data-startup-mark]",
          { scale: 0.72, rotate: -10, autoAlpha: 0 },
          { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.46, ease: "back.out(1.8)" },
          "-=0.32",
        )
        .to("[data-startup-brand]", { autoAlpha: 0, y: -22, filter: "blur(8px)", duration: 0.44 }, "+=0.42")
        .to(node, { opacity: 0, duration: 0.5, ease: "sine.out" }, "-=0.1");
      });
    } catch {
      ctx.revert();
      safeFinish();
    }

    return () => {
      finished = true;
      window.clearTimeout(maxReleaseTimeout);
      preference.removeEventListener("change", safeFinish);
      window.removeEventListener("pointerdown", safeFinish);
      window.removeEventListener("keydown", safeFinish);
      ctx.revert();
      delete node.dataset.active;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="startup-overlay pointer-events-none fixed inset-0 z-[1000000] overflow-hidden bg-recta-ink text-white"
      aria-hidden="true"
    >
      <div className="absolute inset-0 grid-paper opacity-[0.08]" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-recta-orange/12 blur-3xl" />
      <div className="absolute right-[12%] top-[18%] size-64 rounded-full bg-recta-cyan/14 blur-3xl" />

      <div data-startup-stage className="relative h-screen opacity-0">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center sm:flex-row sm:gap-4">
          {["Logical", "Digital", "Systems"].map((word) => (
            <span
              key={word}
              data-startup-word
              className="inline-block text-4xl font-black leading-none text-white opacity-0 sm:text-5xl lg:text-6xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              {word}
            </span>
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="relative flex min-h-24 min-w-[min(30rem,calc(100vw-2rem))] items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] px-8 shadow-2xl backdrop-blur">
            <span
              data-startup-wipe
              className="absolute inset-y-0 left-0 z-10 w-full origin-left opacity-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,106,53,0.96), rgba(255,106,53,0.94) 72%, rgba(35,182,216,0.92))",
              }}
            />
            <div data-startup-brand className="relative z-20 flex items-center gap-3 opacity-0">
              <span data-startup-mark className="grid size-12 place-items-center rounded-lg bg-white text-base font-black text-recta-ink opacity-0">
                RS
              </span>
              <span className="text-left">
                <span className="block text-3xl font-black leading-none text-white sm:text-4xl">RectaSol</span>
                <span className="mt-2 block font-mono text-xs font-bold uppercase tracking-normal text-white/62">rectasol.com</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
