"use client";
import { useActionState } from "react";
import { convertAction } from "@/app/admin/actions";
import { type AdminFeedback } from "@/lib/admin/validation";

export function ConvertForm({ inquiryId }: { inquiryId: string }) {
  const [state, action, pending] = useActionState(convertAction, { ok: false, message: "" } as AdminFeedback);
  return <form action={action} aria-busy={pending} className="grid gap-4">
    <input type="hidden" name="inquiry_id" value={inquiryId} />
    <p className="text-xs leading-5 text-slate-600">Convert this inquiry to a CRM contact. Active contacts with the same email will be reused.</p>
    <button type="submit" disabled={pending} className="rounded-md bg-recta-orange-strong px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-orange-600 disabled:opacity-50">
      {pending ? "Converting…" : "Convert to CRM contact"}
    </button>
    <p role="status" aria-live="polite" className={`text-sm ${state.ok ? "text-emerald-800" : "text-red-800"}`}>{state.message}</p>
  </form>;
}
