"use client";

import { useEffect, useState } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { Pagination, Autoplay, A11y, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { testimonials } from "@/data/site";
import { SectionHeader } from "./SectionHeader";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { Button } from "@/components/ui/button";

export function TestimonialsSection() {
  const reducedMotion = useReducedMotion();
  const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!swiper || swiper.destroyed) return;
    if (reducedMotion || paused) swiper.autoplay.stop();
    else swiper.autoplay.start();
    return () => { if (!swiper.destroyed) swiper.autoplay.stop(); };
  }, [swiper, reducedMotion, paused]);
  return (
    <section className="section-pad bg-recta-ink text-white">
      <div className="container-page">
        <SectionHeader
          eyebrow="Trust"
          title="Built for founders and teams who need clarity"
          description="RectaSol is shaped for business owners who want a technical partner that can think through product, operations, and delivery together."
          className="[&_h2]:text-white [&_p]:text-white/65"
        />
        <div className="mt-12 hidden gap-4 lg:grid lg:grid-cols-3">
          {testimonials.map((item) => (
            <TestimonialCard key={item.name} {...item} />
          ))}
        </div>
        <div className="mt-12 lg:hidden">
          <Swiper
            modules={[Pagination, Autoplay, A11y, Keyboard]}
            onSwiper={setSwiper}
            onFocusCapture={() => setPaused(true)}
            onTouchStart={() => setPaused(true)}
            keyboard={{ enabled: true, onlyInViewport: true }}
            speed={reducedMotion ? 0 : 300}
            slidesPerView={1.05}
            spaceBetween={16}
            pagination={{ clickable: true }}
            autoplay={reducedMotion || paused ? false : { delay: 3200, disableOnInteraction: true, pauseOnMouseEnter: true }}
            className="pb-12"
          >
            {testimonials.map((item) => (
              <SwiperSlide key={item.name}>
                <TestimonialCard {...item} />
              </SwiperSlide>
            ))}
          </Swiper>
          {!reducedMotion && <Button type="button" variant="light" className="mt-4" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
            {paused ? "Resume testimonials" : "Pause testimonials"}
          </Button>}
        </div>
      </div>
    </section>
  );
}

function TestimonialCard({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <figure className="h-full rounded-lg border border-white/10 bg-white/[0.04] p-6">
      <blockquote className="text-lg font-semibold leading-8 text-white/88">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="mt-8">
        <div className="font-black text-white">{name}</div>
        <div className="mt-1 text-sm font-semibold text-white/45">{role}</div>
      </figcaption>
    </figure>
  );
}
