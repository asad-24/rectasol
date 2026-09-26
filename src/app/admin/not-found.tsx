import Link from "next/link";
export default function NotFound() {
  return <section className="p-8"><h1 className="text-2xl font-bold">Inquiry not found</h1><p className="my-4 text-slate-600">This inquiry is unavailable or the link is invalid.</p><Link href="/admin/inquiries" className="underline">Return to inquiries</Link></section>;
}
