import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="container-page py-32">
      <p className="font-mono font-bold text-recta-orange-strong">404 / Page not found</p>
      <h1 className="mt-4 text-4xl font-black text-recta-ink">Let’s find the right direction.</h1>
      <p className="mt-5 max-w-xl text-recta-slate">This page may have moved, or the link may be incorrect. Explore our services or return to the homepage.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="accent"><Link href="/">Return home</Link></Button>
        <Button asChild variant="outline"><Link href="/services">Explore services</Link></Button>
      </div>
    </section>
  );
}
