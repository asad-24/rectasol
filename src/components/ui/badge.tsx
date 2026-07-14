import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-recta-ink/10 bg-white/80 px-3 py-1 text-xs font-semibold text-recta-slate shadow-sm backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
