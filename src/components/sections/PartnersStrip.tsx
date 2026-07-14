import Image from "next/image";
import { partnerLogos } from "@/data/site";

export function PartnersStrip() {
  return (
    <section className="border-y border-recta-ink/10 bg-white py-8">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm font-black uppercase tracking-normal text-recta-slate">Inspired by proven project categories</p>
          <div className="grid grid-cols-3 gap-3 lg:w-[520px]">
            {partnerLogos.map((logo) => (
              <div key={logo.name} className="relative flex h-16 items-center justify-center rounded-md border border-recta-ink/10 bg-recta-muted px-4">
                <Image src={logo.src} alt={logo.name} fill className="object-contain p-3" sizes="180px" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
