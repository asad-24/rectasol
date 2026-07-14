import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { navItems, services } from "@/data/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-recta-ink/10 bg-white">
      <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-md text-sm leading-7 text-recta-slate">
            RectaSol is Asad&apos;s modern software company for websites, apps, AI automation, cloud systems, dashboards,
            and digital products that make business operations easier to understand.
          </p>
          <Link href="/contact" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-recta-orange">
            Build with RectaSol
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-normal text-recta-ink">Pages</h3>
          <div className="mt-4 grid gap-3">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm font-semibold text-recta-slate hover:text-recta-orange">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-black uppercase tracking-normal text-recta-ink">Core Services</h3>
          <div className="mt-4 grid gap-3">
            {services.slice(0, 6).map((service) => (
              <Link key={service.slug} href={`/services/${service.slug}`} className="text-sm font-semibold text-recta-slate hover:text-recta-orange">
                {service.shortTitle}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-recta-ink/10 py-5">
        <div className="container-page flex flex-col gap-2 text-xs font-semibold text-recta-slate sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 RectaSol. Built for logical digital growth.</p>
          <p>Founder: Asad</p>
        </div>
      </div>
    </footer>
  );
}
