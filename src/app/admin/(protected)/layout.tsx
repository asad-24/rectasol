import Link from "next/link";
import { requireAdmin } from "@/lib/server/admin/guard";
import { AdminNav } from "@/components/admin/AdminNav";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const access = await requireAdmin();
  return <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_1fr]">
    <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3">Skip to workspace</a>
    <aside className="bg-slate-950 p-5 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:p-6">
      <Link href="/admin" className="text-2xl font-black tracking-tight">Recta<span className="text-orange-400">Sol</span></Link>
      <p className="mb-6 mt-1 text-xs uppercase tracking-widest text-slate-400">Admin workspace</p>
      <AdminNav />
      <div className="mt-6 border-t border-slate-700 pt-5 lg:mt-auto">
        <p className="break-all text-sm text-slate-200">{access.user.email}</p>
        <p className="mb-4 mt-1 text-xs capitalize text-slate-400">{access.role.replace("_"," ")}</p>
        <LogoutButton />
      </div>
    </aside>
    <main id="admin-content" className="min-w-0 p-5 sm:p-8 lg:p-10">{children}</main>
  </div>;
}
