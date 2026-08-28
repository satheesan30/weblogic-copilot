import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { architectureSteps, featureCards } from "@/lib/mock-data";
import { specialistRoster } from "@/lib/specialists-display";
import { listStoredDocuments } from "@/lib/server/storage";

const faqs = [
  {
    question: "Does anything leave this machine?",
    answer:
      "No. Chat, embeddings, retrieval, and storage all run locally against Ollama, ChromaDB, and SQLite. LiteLLM only routes to a remote model if you explicitly configure one.",
  },
  {
    question: "What can I upload?",
    answer:
      "Text-based WebLogic evidence: .log, .txt, .md, .html, .xml, .properties, and text-like .out/.trc files, up to 1 GB per file, streamed in 8 MB parts.",
  },
  {
    question: "How does it decide which specialist to use?",
    answer:
      "The orchestrator classifies each question and routes it to the FMW, BEA, WLST, RCA, Live Log, or FDE architecture specialist, or answers directly for general questions.",
  },
  {
    question: "What happens when evidence is weak?",
    answer:
      "The agent assesses retrieved evidence, optionally rewrites the query for a second retrieval hop, and reports missing evidence instead of guessing.",
  },
];

async function getLandingStats() {
  try {
    const ownerUsername = process.env.WEBLOGIC_COPILOT_USERNAME || "local-admin";
    const documents = await listStoredDocuments(ownerUsername);
    return {
      documentCount: documents.length,
      indexedCount: documents.filter((document) => document.status === "Indexed").length,
    };
  } catch {
    return { documentCount: 0, indexedCount: 0 };
  }
}

export default async function LandingPage() {
  const stats = await getLandingStats();

  return (
    <main className="bg-paper text-ink">
      <section className="hero-stage">
        <div className="hero-stage__media">
          <Image
            src="/assets/weblogic-topology-3d.png"
            alt="Agentci AI retrieval topology"
            fill
            priority
            fetchPriority="high"
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
        <div className="hero-stage__veil" aria-hidden="true" />
        <div className="hero-stage__scan" aria-hidden="true" />

        <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <p className="brand-mark font-display text-xl font-semibold tracking-tight text-[#eef5f4]">Agentci AI</p>
          <nav className="flex items-center gap-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#eef5f4]/78" aria-label="Landing navigation">
            <Link className="transition hover:text-white" href="/library">
              Library
            </Link>
            <Link className="hidden transition hover:text-white sm:inline" href="/login">
              Login
            </Link>
            <Link
              className="border border-[#eef5f4]/35 px-3 py-2 text-[#eef5f4] transition hover:border-white hover:bg-white/10"
              href="/chat"
            >
              Open desk
            </Link>
          </nav>
        </header>

        <div className="relative z-20 mx-auto flex min-h-[calc(100svh-76px)] w-full max-w-6xl flex-col justify-end px-5 pb-14 pt-24 sm:px-8 sm:pb-20">
          <div className="hero-copy max-w-3xl">
            <p className="font-display text-5xl font-semibold leading-[0.92] tracking-tight text-[#eef5f4] sm:text-6xl lg:text-7xl">
              Agentci AI
            </p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#eef5f4]/80 sm:text-xl">
              Agentic RAG for WebLogic ops — plan, retrieve, refine, and ground answers in your own logs and runbooks.
            </p>
          </div>
          <div className="hero-cta mt-10 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 bg-copper px-5 py-3 text-sm font-semibold text-white transition hover:bg-copper-deep"
              href="/chat"
            >
              Start investigation
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 border border-[#eef5f4]/40 px-5 py-3 text-sm font-semibold text-[#eef5f4] transition hover:border-white hover:bg-white/10"
              href="/live-logs"
            >
              Live log injection
            </Link>
            <Link
              className="inline-flex items-center gap-2 border border-[#eef5f4]/40 px-5 py-3 text-sm font-semibold text-[#eef5f4] transition hover:border-white hover:bg-white/10"
              href="/fde"
            >
              FDE solution desk
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-10 sm:px-8 md:grid-cols-4">
          <StatTile label="Specialist agents" value="6" />
          <StatTile label="Documents indexed" value={String(stats.indexedCount)} />
          <StatTile label="Runs 100% local" value="Ollama + Chroma" />
          <StatTile label="Max upload size" value="1 GB" />
        </div>
      </section>

      <section className="signal-field relative border-t border-line">
        <div className="reveal-up relative mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <div>
            <p className="mono-label">Agentic path</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Plan, retrieve, refine, then answer with evidence.
            </h2>
          </div>
          <ol className="space-y-0 border-t border-line">
            {architectureSteps.map((step, index) => (
              <li className="grid grid-cols-[3rem_1fr] gap-4 border-b border-line py-5" key={step.title}>
                <span className="font-mono text-sm text-forest">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="font-semibold text-ink">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="reveal-up mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <p className="mono-label">Specialist roster</p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            One orchestrator, six specialists.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
            Each question is classified and routed to the specialist best equipped to answer it, with evidence-grounded citations.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialistRoster.map((specialist) => (
              <div className="desk-panel p-5" key={specialist.id}>
                <p className="mono-label">{specialist.id}</p>
                <p className="mt-2 font-display text-base font-semibold text-ink">{specialist.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{specialist.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-paper">
        <div className="reveal-up mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mono-label">Desk capabilities</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                Built for WebLogic administrators.
              </h2>
            </div>
            <Link className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:text-forest-deep" href="/chat">
              Ask the desk
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-10 columns-1 gap-x-12 sm:columns-2">
            {featureCards.map((feature) => (
              <li className="mb-4 break-inside-avoid border-b border-line pb-4 text-base text-ink" key={feature}>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line bg-paper-2">
        <div className="reveal-up mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
          <p className="mono-label">FAQ</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Common questions.
          </h2>
          <dl className="mt-10 grid gap-6 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div className="border-t border-line pt-4" key={faq.question}>
                <dt className="font-semibold text-ink">{faq.question}</dt>
                <dd className="mt-2 text-sm leading-6 text-ink-soft">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <footer className="border-t border-line bg-forest-deep text-[#eef5f4]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-display text-xl font-semibold">Agentci AI</p>
          <p className="max-w-md text-sm leading-6 text-[#eef5f4]/70">
            Local agentic RAG desk for startup failures, JDBC/JMS incidents, BEA codes, live log injection, and domain triage.
          </p>
        </div>
      </footer>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-ink sm:text-3xl">{value}</p>
      <p className="mono-label mt-1">{label}</p>
    </div>
  );
}
