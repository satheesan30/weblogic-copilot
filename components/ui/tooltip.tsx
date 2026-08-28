"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onBlur={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-md border border-line bg-paper-3 px-2.5 py-1.5 text-xs font-medium text-ink shadow-lg",
            side === "top" ? "bottom-[calc(100%+0.4rem)]" : "top-[calc(100%+0.4rem)]",
            className,
          )}
          role="tooltip"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
