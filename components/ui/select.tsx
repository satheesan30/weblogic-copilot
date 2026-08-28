import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-10 w-full border border-line bg-paper px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-forest focus:ring-2 focus:ring-forest/15",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
