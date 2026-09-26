"use client";
import { useActionState } from "react";
import { statusAction } from "@/app/admin/actions";
import { leadStatuses, type LeadStatus } from "@/lib/admin/statuses";
import { Button } from "@/components/ui/button";

export function StatusForm({ id, status, revision }: { id: string; status: LeadStatus; revision: number }) {
  const [state,action,pending] = useActionState(statusAction,{ok:false,message:""});
  return <form action={action} aria-busy={pending} className="grid gap-4">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="revision" value={revision} />
    <label htmlFor="lead-status" className="grid gap-2 text-sm font-semibold">Lead status
      <select key={revision} id="lead-status" name="status" defaultValue={status} disabled={pending}
        className="h-11 rounded-md border border-slate-300 bg-white px-3 capitalize focus-visible:outline-2 focus-visible:outline-orange-600">
        {leadStatuses.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <Button type="submit" variant="accent" disabled={pending}>{pending ? "Saving…" : "Update status"}</Button>
    <p className="text-xs leading-5 text-slate-600">Every status change is recorded with your admin identity. Other inquiry fields remain unchanged.</p>
    <p role="status" aria-live="polite" className={`text-sm ${state.ok ? "text-emerald-800" : "text-red-800"}`}>{state.message}</p>
  </form>;
}
