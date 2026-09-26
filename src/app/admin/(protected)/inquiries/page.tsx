import Link from "next/link";
import { inquiryQuerySchema, leadStatuses } from "@/lib/admin/validation";
import { listInquiries } from "@/lib/server/admin/data";
import { requireAdmin } from "@/lib/server/admin/guard";
import { InquiryTable } from "@/components/admin/InquiryTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  await requireAdmin();
  const parsed = inquiryQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <section><h1 className="text-2xl font-bold">Invalid inquiry filters</h1><p className="mt-3 text-slate-600">Use one search, status and page value. Search supports up to 80 characters.</p><Link href="/admin/inquiries" className="mt-5 inline-block underline">Clear filters</Link></section>;
  const query = parsed.data;
  const result = await listInquiries(query);
  const pages = Math.min(10000, Math.max(1,Math.ceil(result.total/25)));
  const pageHref = (page: number) => "/admin/inquiries?" + new URLSearchParams({q:query.q,status:query.status,page:String(page)}).toString();
  return <div className="mx-auto max-w-7xl space-y-6">
    <header><h1 className="text-3xl font-bold tracking-tight">Inquiries</h1><p className="mt-2 text-sm text-slate-600">Review incoming projects and keep each opportunity moving.</p></header>
    <form action="/admin/inquiries" method="get" className="grid items-end gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[1fr_180px_auto_auto]">
      <label htmlFor="inquiry-search" className="grid gap-2 text-sm font-semibold">Search contacts or references
        <Input key={query.q} id="inquiry-search" name="q" defaultValue={query.q} maxLength={80} placeholder="Name, email, company or reference" />
      </label>
      <label htmlFor="inquiry-filter" className="grid gap-2 text-sm font-semibold">Status
        <select key={query.status} id="inquiry-filter" name="status" defaultValue={query.status} className="h-11 rounded-md border border-slate-300 bg-white px-3 capitalize focus-visible:outline-2 focus-visible:outline-orange-600">
          <option value="">All statuses</option>{leadStatuses.map(status => <option key={status}>{status}</option>)}
        </select>
      </label>
      <Button type="submit">Apply</Button><Link href="/admin/inquiries" className="py-3 text-center text-sm underline">Clear</Link>
    </form>
    <p className="text-sm text-slate-600">{result.total} matching {result.total === 1 ? "inquiry" : "inquiries"} · Newest first</p>
    <InquiryTable items={result.items} />
    <nav aria-label="Inquiry pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">Page {query.page} of {pages}</span>
      <div className="flex gap-4">
        {query.page > 1 && <Link href={pageHref(Math.min(pages,query.page-1))} className="rounded border border-slate-300 bg-white px-4 py-2">Previous</Link>}
        {query.page < pages && <Link href={pageHref(query.page+1)} className="rounded border border-slate-300 bg-white px-4 py-2">Next</Link>}
      </div>
    </nav>
  </div>;
}
