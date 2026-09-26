import type { LeadStatus } from "@/lib/admin/validation";

const styles: Record<LeadStatus,string> = {
  new: "bg-blue-50 text-blue-800 ring-blue-200",
  contacted: "bg-sky-50 text-sky-800 ring-sky-200",
  qualified: "bg-violet-50 text-violet-800 ring-violet-200",
  proposal: "bg-amber-50 text-amber-900 ring-amber-200",
  won: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  lost: "bg-slate-100 text-slate-700 ring-slate-200",
};
export function StatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${styles[status]}`}>{status}</span>;
}
