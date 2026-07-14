"use client";

import { socialChannels } from "@/data/site";
import { SectionHeader } from "./SectionHeader";

export function SocialMediaSection() {
  return (
    <section className="section-pad relative overflow-hidden bg-recta-ink text-white">
      <div className="absolute inset-0 grid-paper opacity-[0.06]" aria-hidden="true" />
      <div className="absolute left-[8%] top-[30%] size-72 rounded-full bg-recta-orange/14 blur-3xl" />
      <div className="absolute right-[8%] top-[30%] size-72 rounded-full bg-recta-cyan/14 blur-3xl" />
      <div className="container-page relative z-10">
        <SectionHeader
          eyebrow="Social channels"
          title="RectaSol public channels are being prepared with care"
          description="Until official profiles are live, the contact page is the safest place to start a real conversation."
          className="[&_h2]:text-white [&_p]:text-white/65"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {socialChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.name} className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.09]">
                <div className={`mx-auto grid size-14 place-items-center rounded-lg bg-gradient-to-br ${channel.gradient} text-white shadow-xl`}>
                  <Icon className="size-6" />
                </div>
                <h3 className="mt-5 text-2xl font-black text-white">{channel.name}</h3>
                <p className="mt-2 text-sm font-bold text-recta-lime">{channel.status}</p>
                <p className="mt-4 text-sm leading-7 text-white/62">{channel.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
