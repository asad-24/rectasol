"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state,action,pending] = useActionState(loginAction,{ok:false,message:""});
  return <form action={action} className="mt-8 grid gap-5" aria-busy={pending}>
    <fieldset disabled={pending} className="grid gap-5">
      <legend className="sr-only">Admin sign-in</legend>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="admin-email">Email
        <Input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={120} />
      </label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="admin-password">Password
        <Input id="admin-password" name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      <Button type="submit" variant="accent" disabled={pending}>{pending ? "Signing in…" : "Sign in securely"}</Button>
    </fieldset>
    <p role="status" aria-live="polite" className="min-h-6 text-sm text-slate-700">{state.message}</p>
  </form>;
}
