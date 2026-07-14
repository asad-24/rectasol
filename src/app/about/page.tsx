import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { companyStats, futureTeamRoles, growthChannels, values } from "@/data/site";
import { Card } from "@/components/ui/card";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CountUpNumber } from "@/components/ui/CountUpNumber";

export const metadata: Metadata = {
  title: "About",
  description: "About RectaSol, Asad's logical software company for advanced services, AI automation, apps, cloud, and digital growth.",
};

export default function AboutPage() {
  return (
    <>
      <PageIntro
        eyebrow="About RectaSol"
        title="A software company built around clarity, logic, and smooth delivery"
        description="RectaSol is Asad's company for building digital products that are not only attractive, but useful, maintainable, measurable, and ready for real operations."
      />
      <section className="section-pad bg-white">
        <div className="container-page mb-16 grid grid-cols-2 gap-6 md:grid-cols-4">
          {companyStats.map((stat) => (
            <Card key={stat.label} className="p-6 text-center">
              <div className="font-mono text-4xl font-black text-recta-orange">
                <CountUpNumber end={stat.value} suffix={stat.suffix} />
              </div>
              <p className="mt-2 text-xs font-black uppercase text-recta-slate">{stat.label}</p>
            </Card>
          ))}
        </div>
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-black leading-tight text-recta-ink sm:text-5xl">RectaSol means the right solution, shaped with reason.</h2>
            <p className="mt-6 text-base leading-8 text-recta-slate">
              The company direction is simple: provide all important digital services under one logical engineering mindset.
              A website, app, AI agent, CRM, dashboard, or cloud workflow should connect to a real business need.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <Card key={value.title} className="p-6">
                  <span className="grid size-11 place-items-center rounded-md bg-recta-ink text-white">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-black text-recta-ink">{value.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-recta-slate">{value.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-pad bg-recta-ink text-white">
        <div className="container-page">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-sm font-black uppercase text-recta-lime">Founder-led company</p>
            <h2 className="mt-4 text-4xl font-black leading-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>
              Built around Asad, ready to grow into a focused product studio
            </h2>
            <p className="mt-5 text-base leading-8 text-white/65">
              RectaSol is starting with a clear operating identity: useful systems, logical decisions, modern code, and
              honest communication.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {futureTeamRoles.map((member) => {
              const Icon = member.icon;
              return (
                <Card key={member.name} className="border-white/10 bg-white/[0.05] p-6 text-white">
                  <span className="grid size-12 place-items-center rounded-md bg-white text-recta-ink">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-2xl font-black text-white" style={{ color: "#ffffff" }}>
                    {member.name}
                  </h3>
                  <p className="mt-1 text-sm font-bold text-recta-lime">{member.role}</p>
                  <p className="mt-4 text-sm leading-7 text-white/65">{member.bio}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {member.expertise.map((item) => (
                      <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/70">
                        {item}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section-pad bg-recta-muted/70">
        <div className="container-page">
          <h2 className="max-w-3xl text-3xl font-black leading-tight text-recta-ink sm:text-5xl">One company for product, operations, automation, and growth.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {growthChannels.map((channel) => {
              const Icon = channel.icon;
              return (
                <div key={channel.label} className="rounded-lg bg-white p-6 shadow-sm">
                  <Icon className="size-6 text-recta-orange" />
                  <p className="mt-4 text-lg font-black text-recta-ink">{channel.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
