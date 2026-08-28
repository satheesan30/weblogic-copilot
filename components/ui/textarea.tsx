import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full resize-y border border-line bg-paper px-3 py-2 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-soft/60 focus:border-forest focus:ring-2 focus:ring-forest/15",
        className,
      )}
      {...props}
    />
  );
}
