"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <section className="container-page py-32">
      <h1 className="text-4xl font-black text-recta-ink">This page could not load.</h1>
      <p className="mt-5 text-recta-slate">Please try again, or email hello@rectasol.com if you need help.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button variant="accent" onClick={unstable_retry}>Try again</Button>
        <Button asChild variant="outline"><Link href="/">Return home</Link></Button>
      </div>
    </section>
  );
}
