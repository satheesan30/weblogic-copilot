"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AppConfig } from "@/types/backend";

interface SettingsFormProps {
  initial: Pick<AppConfig, "retrieval" | "memory"> & { temperature: number };
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const [topK, setTopK] = useState(initial.retrieval.topK);
  const [chunkSize, setChunkSize] = useState(initial.retrieval.chunkSize);
  const [citationMode, setCitationMode] = useState(initial.retrieval.citationMode);
  const [temperature, setTemperature] = useState(initial.temperature);
  const [memoryEnabled, setMemoryEnabled] = useState(initial.memory.enabled);
  const [memoryTopK, setMemoryTopK] = useState(initial.memory.topK);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retrieval: { topK, chunkSize, citationMode },
          llm: { temperature },
          memory: { enabled: memoryEnabled, topK: memoryTopK },
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not save settings.");
      }

      toast.success("Settings saved", { description: "New requests will use the updated retrieval and memory configuration." });
    } catch (error) {
      toast.error("Save failed", { description: error instanceof Error ? error.message : "Unknown error." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="desk-panel p-6 lg:p-8">
      <p className="mono-label">Operational overrides</p>
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Edit retrieval and memory settings</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">
        These values are saved locally and override <span className="font-semibold text-ink">agentci.toml</span> for
        this workspace. Provider, endpoint, and API key values remain config-file-only.
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Retrieval topK" hint="Number of chunks retrieved per question (1-20).">
          <Input
            max={20}
            min={1}
            onChange={(event) => setTopK(Number(event.target.value))}
            type="number"
            value={topK}
          />
        </Field>
        <Field label="Chunk size" hint="Characters per indexed chunk (200-4000).">
          <Input
            max={4000}
            min={200}
            onChange={(event) => setChunkSize(Number(event.target.value))}
            type="number"
            value={chunkSize}
          />
        </Field>
        <Field label="Citation mode" hint="How strictly answers must cite evidence.">
          <Select onChange={(event) => setCitationMode(event.target.value as typeof citationMode)} value={citationMode}>
            <option value="Strict">Strict</option>
            <option value="Balanced">Balanced</option>
            <option value="Verbose">Verbose</option>
          </Select>
        </Field>
        <Field label="Model temperature" hint="Response randomness (0-2).">
          <Input
            max={2}
            min={0}
            onChange={(event) => setTemperature(Number(event.target.value))}
            step={0.1}
            type="number"
            value={temperature}
          />
        </Field>
        <Field label="Agent memory topK" hint="Memory items recalled per question (1-20).">
          <Input
            max={20}
            min={1}
            onChange={(event) => setMemoryTopK(Number(event.target.value))}
            type="number"
            value={memoryTopK}
          />
        </Field>
        <label className="flex items-center gap-3 self-end border border-line bg-paper-2/50 px-3 py-2.5">
          <Checkbox checked={memoryEnabled} onChange={(event) => setMemoryEnabled(event.target.checked)} />
          <span className="text-sm font-semibold text-ink">Agent memory enabled</span>
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled={saving} onClick={handleSave} type="button">
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Field({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="mono-label">{label}</span>
      {children}
      <span className="block text-xs text-ink-soft">{hint}</span>
    </label>
  );
}
