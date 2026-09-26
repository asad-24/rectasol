import Link from "next/link";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{state?:string|string[]}> }) {
  const unavailable = (await searchParams).state === "unavailable";
  return <main className="grid min-h-screen place-items-center px-5 py-12">
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
      <Link href="/" className="text-xl font-black tracking-tight">Recta<span className="text-recta-orange-strong">Sol</span></Link>
      <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Internal workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Sign in with your assigned admin account to manage project inquiries.</p>
      {unavailable && <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Admin access is temporarily unavailable. Please contact the site administrator.</p>}
      <LoginForm />
      <p className="mt-4 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-500">Access is assigned by an administrator. Public registration is not available.</p>
    </div>
  </main>;
}
