import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfigSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card className="h-full">
      <CardHeader className="border-b border-line pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2.5">{children}</div>
      </CardContent>
    </Card>
  );
}

export function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="grid gap-1 border border-line bg-paper-2/50 px-3 py-2.5 sm:grid-cols-[140px_minmax(0,1fr)] sm:items-start">
      <span className="mono-label">{label}</span>
      <span className="min-w-0 break-words text-sm font-semibold leading-5 text-ink sm:text-right">{value}</span>
    </div>
  );
}
