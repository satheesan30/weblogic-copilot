"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiOpsSummary } from "@/types/backend";

const COLOR_LATENCY = "#ffba3d";
const COLOR_CONFIDENCE = "#43d497";

export function TelemetryChart({ timeline }: { timeline: AiOpsSummary["observability"]["timeline"] }) {
  if (!timeline.length) {
    return (
      <div className="grid h-64 place-items-center border border-dashed border-line bg-paper-2/50 text-center">
        <div>
          <p className="font-display font-semibold text-ink">No telemetry to chart yet</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Send a few chat messages to populate this trend.</p>
        </div>
      </div>
    );
  }

  const data = timeline.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    latencyMs: point.latencyMs,
    confidence: point.confidence,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#243452" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="time" fontSize={10} stroke="#9aa6c3" tickLine={false} axisLine={{ stroke: "#243452" }} />
          <YAxis
            axisLine={false}
            fontSize={10}
            stroke="#9aa6c3"
            tickLine={false}
            yAxisId="latency"
          />
          <YAxis
            axisLine={false}
            domain={[0, 100]}
            fontSize={10}
            orientation="right"
            stroke="#9aa6c3"
            tickLine={false}
            yAxisId="confidence"
          />
          <Tooltip
            contentStyle={{ background: "#172541", border: "1px solid #243452", borderRadius: 4, fontSize: 12 }}
            itemStyle={{ color: "#f5f7ff" }}
            labelStyle={{ color: "#9aa6c3" }}
          />
          <Line
            dataKey="latencyMs"
            dot={false}
            name="Latency (ms)"
            stroke={COLOR_LATENCY}
            strokeWidth={2}
            type="monotone"
            yAxisId="latency"
          />
          <Line
            connectNulls
            dataKey="confidence"
            dot={false}
            name="Confidence (%)"
            stroke={COLOR_CONFIDENCE}
            strokeDasharray="4 3"
            strokeWidth={2}
            type="monotone"
            yAxisId="confidence"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3" style={{ background: COLOR_LATENCY }} />
          Latency (ms)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 border-t border-dashed" style={{ borderColor: COLOR_CONFIDENCE }} />
          Confidence (%)
        </span>
      </div>
    </div>
  );
}
