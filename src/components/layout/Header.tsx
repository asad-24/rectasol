"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { navItems } from "@/data/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./Logo";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState({ pathname, open: false });
  const mobileOpen = mobileMenu.pathname === pathname && mobileMenu.open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-recta-ink/10 bg-background/92 shadow-sm backdrop-blur-xl" : "bg-transparent",
      )}
    >
      <div className="container-page flex h-20 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-bold transition-colors",
                  active ? "text-recta-orange" : "text-recta-slate hover:text-recta-ink",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button asChild variant="outline">
            <Link href="/case-studies">View Work</Link>
          </Button>
          <Button asChild variant="accent">
            <Link href="/contact">Start a Project</Link>
          </Button>
        </div>
        <Sheet open={mobileOpen} onOpenChange={(open) => setMobileMenu({ pathname, open })}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <div className="mb-10">
              <Logo />
            </div>
            <nav className="grid gap-2">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenu({ pathname: item.href, open: false })}
                    className={cn(
                      "rounded-md px-3 py-3 text-base font-bold transition-colors hover:bg-recta-muted",
                      active ? "text-recta-orange" : "text-recta-ink",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Button asChild variant="accent" className="mt-8 w-full">
              <Link href="/contact" onClick={() => setMobileMenu({ pathname: "/contact", open: false })}>
                Start a Project
              </Link>
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
