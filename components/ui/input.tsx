import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-forest focus:ring-2 focus:ring-forest/15",
        className,
      )}
      {...props}
    />
  );
}
