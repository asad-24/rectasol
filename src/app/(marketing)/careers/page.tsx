import type { Metadata } from "next";
import { PageIntro } from "@/components/sections/PageIntro";
import { benefits, careerRoles, careerValues } from "@/data/site";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Careers",
  description: "Career paths for people who want to help RectaSol build logical software, AI automation, design systems, and digital products.",
};

export default function CareersPage() {
  return (
    <>
      <PageIntro
        eyebrow="Careers"
        title="RectaSol is shaped for builders who like clear thinking"
        description="The first public site keeps careers lightweight, but the company direction is open to engineers, designers, automation builders, and operators who care about useful systems."
      />
      <section className="section-pad bg-white">
        <div className="container-page mb-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-sm font-black uppercase text-recta-orange">Why RectaSol</p>
            <h2 className="mt-4 text-4xl font-black text-recta-ink">More than a task list</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {careerValues.map((value) => (
              <Card key={value.title} className="p-6 text-center">
                <h3 className="text-xl font-black text-recta-ink">{value.title}</h3>
                <p className="mt-3 text-sm leading-7 text-recta-slate">{value.description}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="container-page mb-16">
          <div className="rounded-lg bg-recta-muted/70 p-6 sm:p-10">
            <div className="mb-8 text-center">
              <p className="font-mono text-sm font-black uppercase text-recta-orange">Benefits & working style</p>
              <h2 className="mt-4 text-4xl font-black text-recta-ink">A practical culture for careful builders</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <Card key={benefit.title} className="p-6">
                    <Icon className="size-6 text-recta-orange" />
                    <h3 className="mt-4 text-xl font-black text-recta-ink">{benefit.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-recta-slate">{benefit.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        <div className="container-page grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {careerRoles.map((role) => (
            <Card key={role} className="p-6">
              <p className="font-mono text-xs font-black uppercase text-recta-orange">Future role</p>
              <h2 className="mt-3 text-2xl font-black text-recta-ink">{role}</h2>
              <p className="mt-4 text-sm leading-7 text-recta-slate">
                A fit for people who can combine craft, communication, and practical ownership.
              </p>
            </Card>
          ))}
        </div>
        <div className="container-page mt-10">
          <div className="rounded-lg bg-recta-ink p-8 text-white">
            <h2 className="text-3xl font-black text-white">Want to collaborate with RectaSol?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65">
              Send your portfolio, strongest skill, and the kind of systems you want to build.
            </p>
            <Button asChild variant="light" className="mt-6">
              <a href="mailto:hello@rectasol.com">Email RectaSol</a>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
