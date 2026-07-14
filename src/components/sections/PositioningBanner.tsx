"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { homeStats } from "@/data/site";
import { CountUpNumber } from "@/components/ui/CountUpNumber";

gsap.registerPlugin(ScrollTrigger);

export function PositioningBanner() {
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: section,
        start: "top 75%",
        once: true,
        onEnter: () => setInView(true),
      });

      if (reducedMotion) {
        gsap.set(section, { clipPath: "inset(0% 0% 0% 0% round 0px)" });
        return;
      }

      gsap.fromTo(
        section,
        { clipPath: "inset(0% 18% 0% 18% round 28px)" },
        {
          clipPath: "inset(0% 0% 0% 0% round 0px)",
          ease: "none",
          scrollTrigger: {
            trigger: section,
            scrub: 1.4,
            start: "top 84%",
            end: "top 48%",
          },
        },
      );
    }, section);

    return () => ctx.revert();
  }, []);

  const renderStat = (stat: (typeof homeStats)[number]) => (
    <div className="h-full rounded-lg border border-white/10 bg-white/[0.06] p-6 text-left backdrop-blur">
      <div className="font-mono text-4xl font-black text-white">
        <CountUpNumber end={stat.value} suffix={stat.suffix} start={inView} />
      </div>
      <p className="mt-2 text-sm font-semibold text-white/62">{stat.label}</p>
    </div>
  );

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-recta-ink py-24 text-white lg:py-32">
      <div className="absolute inset-0 grid-paper opacity-[0.07]" aria-hidden="true" />
      <div className="absolute left-[-10%] top-[-20%] size-96 rounded-full bg-recta-orange/20 blur-3xl" />
      <div className="absolute bottom-[-20%] right-[-8%] size-96 rounded-full bg-recta-cyan/18 blur-3xl" />
      <div className="container-page relative z-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex rounded-full bg-white/[0.07] px-4 py-2 font-mono text-sm font-bold uppercase text-white/60">
            RectaSol approach
          </div>
          <h2 className="text-4xl font-black leading-tight text-white sm:text-6xl">
            Business ideas become useful systems when the logic is clear first.
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/65">
            RectaSol combines product thinking, engineering, automation, and launch care so every page, workflow, and
            dashboard has a reason to exist.
          </p>
        </div>

        <div className="mt-12 md:hidden">
          <Swiper modules={[Pagination]} slidesPerView={1.08} spaceBetween={14} pagination={{ clickable: true }} className="pb-12">
            {homeStats.map((stat) => (
              <SwiperSlide key={stat.label}>{renderStat(stat)}</SwiperSlide>
            ))}
          </Swiper>
        </div>
        <div className="mt-12 hidden gap-5 md:grid md:grid-cols-3">
          {homeStats.map((stat) => (
            <div key={stat.label}>{renderStat(stat)}</div>
          ))}
        </div>
      </div>
    </section>
  );
}
