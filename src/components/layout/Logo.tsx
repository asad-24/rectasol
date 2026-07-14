import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2", className)} aria-label="RectaSol home">
      <span className="grid size-10 place-items-center rounded-lg bg-recta-ink text-sm font-black text-white shadow-sm">
        RS
      </span>
      <span className="leading-none">
        <span className="block text-lg font-black tracking-normal text-recta-ink">RectaSol</span>
        <span className="block font-mono text-[10px] font-semibold uppercase tracking-normal text-recta-slate">systems with sense</span>
      </span>
    </Link>
  );
}
