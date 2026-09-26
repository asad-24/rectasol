import Link from "next/link";
import { getPipelineCounts, listInquiries } from "@/lib/server/admin/data";
import { leadStatuses } from "@/lib/admin/validation";
import { InquiryTable } from "@/components/admin/InquiryTable";

export default async function Dashboard() {
  const [counts,recent] = await Promise.all([getPipelineCounts(),listInquiries({q:"",status:"",page:1})]);
  const total = counts.reduce((sum,item) => sum + item.total,0);
  return <div className="mx-auto max-w-7xl space-y-8">
    <header><p className="text-xs font-bold uppercase tracking-widest text-recta-orange-strong">Lead workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Inquiry overview</h1>
      <p className="mt-2 text-sm text-slate-600">A live view of incoming opportunities and their progress.</p>
    </header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
      <Link href="/admin/inquiries" className="rounded-xl bg-slate-950 p-5 text-white shadow-sm"><p className="text-xs font-semibold text-slate-300">Total inquiries</p><p className="mt-3 text-3xl font-bold">{total}</p></Link>
      {leadStatuses.map(status => <Link key={status} href={`/admin/inquiries?status=${status}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-400 focus-visible:outline-2 focus-visible:outline-orange-600">
        <p className="text-xs font-semibold capitalize text-slate-600">{status}</p>
        <p className="mt-3 text-3xl font-bold">{counts.find(item => item.status === status)?.total ?? 0}</p>
      </Link>)}
    </div>
    <section aria-labelledby="recent-inquiries"><div className="mb-4 flex items-center justify-between gap-4">
      <h2 id="recent-inquiries" className="text-xl font-bold">Recent inquiries</h2><Link href="/admin/inquiries" className="text-sm font-semibold text-recta-orange-strong underline">View all inquiries</Link>
    </div><InquiryTable items={recent.items.slice(0,5)} /></section>
  </div>;
}
