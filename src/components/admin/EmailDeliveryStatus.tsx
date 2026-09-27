import { getInquiryEmailStatus } from "@/lib/server/admin/email";
import { formatAdminDate } from "@/components/admin/InquiryTable";

const labels = { inquiry_client_v1: "Client confirmation", inquiry_admin_v1: "Admin notification" };
const styles = {
  pending: "bg-amber-50 text-amber-900", processing: "bg-blue-50 text-blue-800",
  sent: "bg-emerald-50 text-emerald-800", failed: "bg-red-50 text-red-800",
};

export async function EmailDeliveryStatus({ id }: { id: string }) {
  // A status-read outage must not hide the inquiry or the existing status controls.
  const deliveries = await getInquiryEmailStatus(id).catch(() => null);
  return <section className="rounded-xl border border-slate-200 bg-white p-6" aria-labelledby="email-delivery">
    <h2 id="email-delivery" className="text-lg font-bold">Email delivery</h2>
    <p className="mt-1 text-xs text-slate-500">Sent means accepted by the email provider; inbox delivery is not confirmed here.</p>
    {deliveries === null ? <p className="mt-4 text-sm text-slate-600">Delivery status is temporarily unavailable.</p> :
      deliveries.length === 0 ? <p className="mt-4 text-sm text-slate-600">No email deliveries recorded. Inquiries created before email delivery was enabled have no queued emails.</p> :
        <ul className="mt-4 divide-y divide-slate-100">{deliveries.map(delivery => <li key={delivery.kind} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{labels[delivery.kind]}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${styles[delivery.status]}`}>{delivery.status}</span></div>
          <p className="mt-2 text-xs text-slate-600">Attempts: {delivery.attempts}{delivery.sent_at ? ` · Sent ${formatAdminDate(delivery.sent_at)}` : ""}</p>
          {delivery.status === "failed" && <p className="mt-2 text-xs text-slate-600">Automatic delivery stopped. An operator should review delivery records before any resend.</p>}
        </li>)}</ul>}
  </section>;
}
