"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FdeStage, FdeSummary } from "@/types/fde";

const STAGES: FdeStage[] = ["intake", "design", "prototype", "production", "parked"];
const STAGE_COLOR = "#43d497";
const APPROACH_COLORS = ["#6d5dfc", "#ffba3d", "#9aa6c3"];

const tooltipStyle = { background: "#172541", border: "1px solid #243452", borderRadius: 4, fontSize: 12 };

export function PipelineCharts({ pipeline }: { pipeline: FdeSummary["pipeline"] }) {
  const stageData = STAGES.map((stage) => ({ stage, count: pipeline.byStage[stage] }));
  const approachData = [
    { name: "AI agent", value: pipeline.aiAgent },
    { name: "Automation", value: pipeline.automation },
    { name: "Traditional", value: pipeline.traditional },
  ];
  const hasApproachData = approachData.some((item) => item.value > 0);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Pipeline by stage</CardTitle>
          <CardDescription>Use cases from intake through production.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={stageData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#243452" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" fontSize={10} stroke="#9aa6c3" tickLine={false} axisLine={{ stroke: "#243452" }} />
                <YAxis allowDecimals={false} axisLine={false} fontSize={10} stroke="#9aa6c3" tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#f5f7ff" }} labelStyle={{ color: "#9aa6c3" }} />
                <Bar dataKey="count" fill={STAGE_COLOR} name="Use cases" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery approach</CardTitle>
          <CardDescription>Recommended agent, automation, or traditional split.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasApproachData ? (
            <div className="h-56 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: "#f5f7ff" }} />
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={approachData}
                    dataKey="value"
                    innerRadius={45}
                    nameKey="name"
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {approachData.map((entry, index) => (
                      <Cell fill={APPROACH_COLORS[index % APPROACH_COLORS.length]} key={entry.name} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 flex flex-wrap justify-center gap-4 text-xs text-ink-soft">
                {approachData.map((entry, index) => (
                  <span className="flex items-center gap-1.5" key={entry.name}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: APPROACH_COLORS[index % APPROACH_COLORS.length] }} />
                    {entry.name} ({entry.value})
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid h-56 place-items-center border border-dashed border-line bg-paper-2/50 text-center">
              <div>
                <p className="font-display font-semibold text-ink">No use cases yet</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">Score an opportunity to populate this chart.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
