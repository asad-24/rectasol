"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  return <nav aria-label="Administration" className="flex gap-2 lg:flex-col">
    {[{href:"/admin",label:"Overview"},{href:"/admin/inquiries",label:"Inquiries"}].map(({href,label}) => {
      const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}
        className={`rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${active ? "bg-white text-slate-950" : "text-slate-200 hover:bg-white/10"}`}>{label}</Link>;
    })}
  </nav>;
}
