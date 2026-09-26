"use client";
import { useFormStatus } from "react-dom";
import { logoutAction } from "@/app/admin/actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg border border-slate-400 px-4 py-2 text-sm font-semibold text-inherit hover:bg-slate-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-60">{pending ? "Signing out…" : "Sign out"}</button>;
}
export function LogoutButton() { return <form action={logoutAction}><Submit /></form>; }
