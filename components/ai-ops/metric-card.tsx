import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function MetricCard({
  description,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  tone?: "default" | "good" | "warning" | "danger";
  value: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mono-label">{label}</p>
            <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink">{value}</div>
          </div>
          <div
            className={cn(
              "grid h-11 w-11 place-items-center border",
              tone === "good" && "border-forest/25 bg-forest/10 text-forest-deep",
              tone === "warning" && "border-copper/30 bg-copper/10 text-copper-deep",
              tone === "danger" && "border-danger/25 bg-danger/10 text-danger",
              tone === "default" && "border-line bg-paper-2 text-forest",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink-soft">{description}</p>
      </CardContent>
    </Card>
  );
}

export function ScoreBar({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const tone = inverse ? riskTone(value) : scoreTone(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-ink-soft">{label}</span>
        <span className={cn("font-semibold", tone.text)}>{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-paper-3">
        <div className={cn("h-full transition-all", tone.bar)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function scoreTone(value: number) {
  if (value >= 75) return { text: "text-forest-deep", bar: "bg-forest" };
  if (value >= 50) return { text: "text-copper-deep", bar: "bg-copper" };
  return { text: "text-danger", bar: "bg-danger" };
}

function riskTone(value: number) {
  if (value <= 30) return { text: "text-forest-deep", bar: "bg-forest" };
  if (value <= 60) return { text: "text-copper-deep", bar: "bg-copper" };
  return { text: "text-danger", bar: "bg-danger" };
}
