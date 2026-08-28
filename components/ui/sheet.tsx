"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, side = "left", children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "app-rail fixed top-0 h-full w-[85vw] max-w-[300px] border-r p-4 shadow-2xl",
          side === "left"
            ? "left-0 animate-[sheet-in-left_220ms_cubic-bezier(0.22,1,0.36,1)_both]"
            : "right-0 animate-[sheet-in-right_220ms_cubic-bezier(0.22,1,0.36,1)_both]",
        )}
        role="dialog"
        aria-modal="true"
      >
        <button
          aria-label="Close menu"
          className="absolute right-4 top-4 text-ink-soft transition hover:text-ink"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
