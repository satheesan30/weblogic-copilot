import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-4", className)} {...props} />;
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-lg bg-paper-2 p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn("rounded-md px-3 py-1.5 text-sm font-semibold text-ink-soft first:bg-paper-3 first:text-ink first:shadow-sm", className)}
      type="button"
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg", className)} {...props} />;
}
