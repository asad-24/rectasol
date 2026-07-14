import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="bg-background py-8">
      <div className="container-page overflow-hidden rounded-lg bg-recta-ink p-8 text-white shadow-2xl sm:p-12 lg:p-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="font-mono text-sm font-bold uppercase text-recta-lime">Ready when the idea is real</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-white sm:text-5xl">
              Bring RectaSol the rough version. We&apos;ll turn it into a system.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/65">
              Tell us what you want to build, automate, improve, or rescue. The first goal is clarity.
            </p>
          </div>
          <Button asChild variant="light" size="lg">
            <Link href="/contact">
              Start with RectaSol
              <ArrowRight className="size-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
