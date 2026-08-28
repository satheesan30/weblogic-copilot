import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "outline";

const badgeClasses: Record<BadgeVariant, string> = {
  default: "border border-mist bg-mist/35 text-forest-deep",
  success: "border border-forest/25 bg-forest/10 text-forest-deep",
  warning: "border border-copper/30 bg-copper/10 text-copper-deep",
  danger: "border border-danger/25 bg-danger/10 text-danger",
  outline: "border border-line bg-paper text-ink-soft",
};

export function Badge({ className, variant = "default", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.12em]",
        badgeClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
