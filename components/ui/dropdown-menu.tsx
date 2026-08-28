"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null);

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative" ref={rootRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

function useDropdownMenu() {
  const ctx = useContext(DropdownMenuContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within <DropdownMenu>");
  return ctx;
}

export function DropdownMenuTrigger({ className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useDropdownMenu();
  return (
    <button
      aria-expanded={open}
      className={cn("cursor-pointer", className)}
      onClick={() => setOpen(!open)}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({ className, children, align = "end", ...props }: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end" }) {
  const { open } = useDropdownMenu();
  if (!open) return null;
  return (
    <div
      className={cn(
        "desk-panel absolute top-[calc(100%+0.5rem)] z-40 w-72 animate-[rise-in_160ms_cubic-bezier(0.22,1,0.36,1)_both] overflow-hidden p-1.5",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
      role="menu"
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mono-label px-2.5 py-2", className)} {...props} />;
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("my-1 h-px bg-line", className)} />;
}

export function DropdownMenuItem({ className, children, onClick, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { setOpen } = useDropdownMenu();
  return (
    <div
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-2 text-sm text-ink transition hover:bg-paper-3",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      role="menuitem"
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuEmpty({ children }: { children: ReactNode }) {
  return <p className="px-2.5 py-4 text-center text-sm text-ink-soft">{children}</p>;
}
