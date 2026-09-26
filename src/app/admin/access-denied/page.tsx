import Link from "next/link";
import { LogoutButton } from "@/components/admin/LogoutButton";
export default function AccessDenied() {
  return <main className="mx-auto max-w-xl px-6 py-24">
    <p className="text-sm font-bold text-recta-orange-strong">Restricted workspace</p>
    <h1 className="mt-3 text-3xl font-bold">Admin access required</h1>
    <p className="my-6 leading-7 text-slate-600">Your account does not have active admin membership. Contact the site administrator or sign out to use a different account.</p>
    <LogoutButton /><Link href="/" className="mt-6 inline-block underline">Return to the website</Link>
  </main>;
}
