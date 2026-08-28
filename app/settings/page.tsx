import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ConfigRow, ConfigSection } from "@/components/settings/config-section";
import { SettingsForm } from "@/components/settings/settings-form";
import { Badge } from "@/components/ui/badge";
import { getAppConfig } from "@/lib/server/config";
import { getCurrentSession } from "@/lib/server/auth";
import { BrainCircuit, Database, HardDrive, ShieldCheck, SlidersHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?redirect=/settings");

  const config = await getAppConfig();

  return (
    <AppShell>
      <PageHeader
        actions={
          <>
            <Badge>Configuration</Badge>
            <Badge variant="success">Signal desk</Badge>
          </>
        }
        description="Review the model route, retrieval layer, vector database, and agent memory profile before moving this workspace into production."
        eyebrow="Settings"
        title="Desk configuration"
      />

      <section className="desk-panel mb-6 overflow-hidden">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end lg:p-8">
          <div className="max-w-3xl">
            <p className="mono-label">Runtime profile</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Loaded from agentci.toml</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              These values drive chat routing, embeddings, retrieval depth, and agent memory.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:min-w-[360px]">
            <MetricTile label="Model" value={config.llm.model} />
            <MetricTile label="Vector store" value={config.vectorStore.provider} />
            <MetricTile label="Retrieval topK" value={config.retrieval.topK} />
            <MetricTile label="Memory" value={config.memory.enabled ? "Enabled" : "Disabled"} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line bg-paper-2/60 px-6 py-4 lg:px-8">
          <ShieldCheck className="h-4 w-4 text-forest" aria-hidden="true" />
          <span className="text-sm text-ink-soft">
            Base values are loaded from <span className="font-semibold text-ink">agentci.toml</span>; retrieval and
            memory can be overridden below without a restart.
          </span>
        </div>
      </section>

      <SettingsForm
        initial={{ retrieval: config.retrieval, memory: config.memory, temperature: config.llm.temperature }}
      />
      <div className="mt-5" />

      <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
        <ConfigPanel icon={BrainCircuit} title="Model configuration">
          <ConfigRow label="Provider" value={config.llm.provider} />
          <ConfigRow label="Endpoint" value={config.llm.endpoint} />
          <ConfigRow label="Model" value={config.llm.model} />
          <ConfigRow label="Temperature" value={config.llm.temperature} />
        </ConfigPanel>

        <ConfigPanel icon={Database} title="Vector store">
          <ConfigRow label="Provider" value={config.vectorStore.provider} />
          <ConfigRow label="Endpoint" value={config.vectorStore.endpoint} />
          <ConfigRow label="Collection" value={config.vectorStore.collectionName} />
          <ConfigRow label="Persistence" value={config.vectorStore.persistencePath} />
          <ConfigRow label="Embed model" value={config.vectorStore.embeddingModel} />
          <ConfigRow label="Embed URL" value={config.vectorStore.embeddingEndpoint} />
        </ConfigPanel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ConfigPanel icon={SlidersHorizontal} title="Retrieval settings">
          <ConfigRow label="topK" value={config.retrieval.topK} />
          <ConfigRow label="Chunk size" value={config.retrieval.chunkSize} />
          <ConfigRow label="Citation mode" value={config.retrieval.citationMode} />
        </ConfigPanel>

        <ConfigPanel icon={HardDrive} title="Agent memory">
          <ConfigRow label="Enabled" value={config.memory.enabled ? "Yes" : "No"} />
          <ConfigRow label="Provider" value={config.memory.provider} />
          <ConfigRow label="Collection" value={config.memory.collectionName} />
          <ConfigRow label="Memory topK" value={config.memory.topK} />
        </ConfigPanel>
      </div>

      <p className="mt-5 border border-line bg-paper-2/70 p-4 text-sm leading-6 text-ink-soft">
        Provider, endpoint, and API key values still require editing{" "}
        <span className="font-semibold text-ink">agentci.toml</span> and a restart. Retrieval, citation mode,
        temperature, and memory settings save immediately from this page.
      </p>
    </AppShell>
  );
}

function ConfigPanel({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof BrainCircuit; title: string }) {
  return (
    <ConfigSection title={title}>
      <div className="-mt-1 mb-3 flex h-10 w-10 items-center justify-center border border-line bg-forest text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      {children}
    </ConfigSection>
  );
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-line bg-paper p-3">
      <p className="mono-label">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}
