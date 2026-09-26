"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function AdminError({ unstable_retry }: { unstable_retry: () => void }) {
  return <main className="mx-auto max-w-xl p-8">
    <h1 className="text-2xl font-bold">Workspace temporarily unavailable</h1>
    <p className="my-5 leading-7 text-slate-600">We could not load this view. Try again or sign in to renew your session.</p>
    <div className="flex gap-4"><Button onClick={unstable_retry}>Try again</Button><Link href="/admin/login" className="p-3 underline">Sign in</Link></div>
  </main>;
}
