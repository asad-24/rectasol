"use client";

import { Pagination, Autoplay } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import { testimonials } from "@/data/site";
import { SectionHeader } from "./SectionHeader";

export function TestimonialsSection() {
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
            modules={[Pagination, Autoplay]}
            slidesPerView={1.05}
            spaceBetween={16}
            pagination={{ clickable: true }}
            autoplay={{ delay: 3200, disableOnInteraction: true }}
            className="pb-12"
          >
            {testimonials.map((item) => (
              <SwiperSlide key={item.name}>
                <TestimonialCard {...item} />
              </SwiperSlide>
            ))}
          </Swiper>
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
