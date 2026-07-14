import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-md border border-recta-ink/10 bg-white px-3 py-2 text-sm text-recta-ink shadow-sm outline-none transition placeholder:text-recta-slate/60 focus:border-recta-orange focus:ring-2 focus:ring-recta-orange/15 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
