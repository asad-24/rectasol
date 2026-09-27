import Link from "next/link";
import { notFound } from "next/navigation";
import { getInquiry, getInquiryAudit } from "@/lib/server/admin/data";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { StatusForm } from "@/components/admin/StatusForm";
import { formatAdminDate } from "@/components/admin/InquiryTable";
import { EmailDeliveryStatus } from "@/components/admin/EmailDeliveryStatus";

export default async function InquiryPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const inquiry = await getInquiry(id);
  if (!inquiry) notFound();
  const audit = await getInquiryAudit(id);
  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/admin/inquiries" className="text-sm font-semibold text-recta-orange-strong underline">Back to inquiries</Link>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="break-all font-mono text-xs text-slate-500">{inquiry.public_reference}</p><h1 className="mt-2 break-words text-3xl font-bold">{inquiry.name}</h1><p className="mt-2 break-all text-slate-600">{inquiry.email}</p></div>
      <StatusBadge status={inquiry.status} />
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <EmailDeliveryStatus id={inquiry.id} />
        <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="project-context">
          <h2 id="project-context" className="text-lg font-bold">Project context</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            {[["Company",inquiry.company],["Service",inquiry.service.replaceAll("-"," ")],["Budget",inquiry.budget],["Timeline",inquiry.timeline],["Received",formatAdminDate(inquiry.created_at)],["Last updated",formatAdminDate(inquiry.updated_at)]].map(([label,value]) =>
              <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 break-words text-sm">{value || "Not specified"}</dd></div>)}
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="project-message">
          <h2 id="project-message" className="text-lg font-bold">Project details</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{inquiry.message}</p>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="audit-history">
          <h2 id="audit-history" className="text-lg font-bold">Status history</h2><p className="mt-1 text-xs text-slate-500">Most recent 25 changes · Times shown in UTC</p>
          {!audit.length ? <p className="mt-5 text-sm text-slate-600">No status changes have been recorded.</p> :
            <ol className="mt-5 divide-y divide-slate-100">{audit.map(event => <li key={event.id} className="py-4">
              <p className="flex flex-wrap items-center gap-2"><StatusBadge status={event.previous_status} /><span aria-label="changed to">→</span><StatusBadge status={event.new_status} /></p>
              <p className="mt-2 break-all text-xs text-slate-600">Admin ID: {event.actor_user_id}</p><time className="mt-1 block text-xs text-slate-500" dateTime={event.created_at}>{formatAdminDate(event.created_at)}</time>
            </li>)}</ol>}
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="manage-status">
        <h2 id="manage-status" className="mb-5 text-lg font-bold">Manage pipeline</h2><StatusForm id={inquiry.id} status={inquiry.status} revision={inquiry.revision} />
      </section>
    </div>
  </div>;
}
