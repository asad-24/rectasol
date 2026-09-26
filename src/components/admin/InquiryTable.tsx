import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { InquirySummary } from "@/lib/server/admin/data";

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(value)) + " UTC";
}

export function InquiryTable({ items }: { items: InquirySummary[] }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
    <h2 className="text-lg font-bold">No inquiries to show</h2>
    <p className="mt-2 text-sm text-slate-600">New website inquiries will appear here. If filters are active, try clearing them.</p>
  </div>;
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white" tabIndex={0} role="region" aria-label="Inquiry results; scroll horizontally on small screens">
    <table className="w-full min-w-[760px] text-left text-sm">
      <caption className="sr-only">Inquiries, newest first</caption>
      <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
        <tr>{["Inquiry / contact","Service","Status","Received"].map(label => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map(item => <tr key={item.id} className="hover:bg-slate-50">
          <td className="max-w-xs px-5 py-4">
            <Link href={`/admin/inquiries/${item.id}`} className="font-bold text-slate-950 underline decoration-slate-300 underline-offset-4 hover:text-orange-800 focus-visible:outline-2 focus-visible:outline-orange-600">{item.name}</Link>
            <p className="mt-1 break-all text-xs text-slate-600">{item.email}</p>
            {item.company && <p className="mt-1 break-words text-xs text-slate-600">{item.company}</p>}
            <p className="mt-2 break-all font-mono text-[10px] text-slate-500">{item.public_reference}</p>
          </td>
          <td className="px-5 py-4"><span className="capitalize">{item.service.replaceAll("-"," ")}</span>
            <p className="mt-1 max-w-48 break-words text-xs text-slate-600">{item.budget || "Budget not specified"}</p>
            <p className="mt-1 max-w-48 break-words text-xs text-slate-600">{item.timeline || "Timeline not specified"}</p>
          </td>
          <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
          <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600"><time dateTime={item.created_at}>{formatAdminDate(item.created_at)}</time></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
