import { getSpecialist, type SpecialistId } from "@/lib/server/specialists/catalog";
import type { ChatRequestMessage } from "@/types/backend";

export interface SpecialistRoute {
  specialist: SpecialistId;
  label: string;
  reason: string;
  retrievalBoost: string;
}

const FDE_SIGNAL =
  /\b(fde|forward deploy|solution architecture|architectural pattern|reference design|slo|sli|observability|guardrail|evaluation framework|canary|a\/b|prompt(?:ing)? design|agentic (?:framework|workflow)|llm orchestration|prototype to production|when (?:is )?ai (?:appropriate|not)|ai vs automation|use case intake|handoff pack)\b/;

export function matchFdeSpecialist(question: string, history: ChatRequestMessage[] = []): SpecialistRoute | null {
  const text = `${history
    .slice(-4)
    .map((item) => item.content)
    .join("\n")}\n${question}`.toLowerCase();

  if (!FDE_SIGNAL.test(text)) return null;
  const specialist = getSpecialist("fde")!;
  return {
    specialist: "fde",
    label: specialist.label,
    reason: "Solution architecture / FDE delivery signals detected.",
    retrievalBoost: specialist.retrievalHints.slice(0, 4).join(" "),
  };
}

export function routeSpecialistAgent(question: string, history: ChatRequestMessage[] = []): SpecialistRoute {
  const fde = matchFdeSpecialist(question, history);
  if (fde) return fde;

  const text = `${history
    .slice(-4)
    .map((item) => item.content)
    .join("\n")}\n${question}`.toLowerCase();

  if (
    /\blive[- ]?log\b/.test(text) ||
    /\binjected\b/.test(text) ||
    /\btail(?:ing|ed)?\b/.test(text) ||
    /\blive stream\b/.test(text) ||
    /\brecent(?:ly)? (?:injected|tailed)\b/.test(text)
  ) {
    const specialist = getSpecialist("live")!;
    return {
      specialist: "live",
      label: specialist.label,
      reason: "Live log injection / tail signals detected.",
      retrievalBoost: specialist.retrievalHints.slice(0, 4).join(" "),
    };
  }

  if (/\bbea-\d+/i.test(text) || /\bbea error\b/.test(text) || /\berror code\b/.test(text)) {
    const specialist = getSpecialist("bea")!;
    return {
      specialist: "bea",
      label: specialist.label,
      reason: "BEA error code / decoder signals detected.",
      retrievalBoost: specialist.retrievalHints.slice(0, 4).join(" "),
    };
  }

  if (
    /\bfusion middleware\b/.test(text) ||
    /\bfmw\b/.test(text) ||
    /\bsoa(?: suite)?\b/.test(text) ||
    /\boracle service bus\b|\bosb\b/.test(text) ||
    /\bjrf\b|\bopss\b/.test(text) ||
    /\bohs\b|\boracle http server\b/.test(text) ||
    /\bjdbc\b/.test(text) ||
    /\bdata\s*source\b/.test(text) ||
    /\bdatasource\b/.test(text) ||
    /\bconnection pool\b/.test(text) ||
    /\bpool waiter/.test(text) ||
    /\bxa\b/.test(text)
  ) {
    const specialist = getSpecialist("fmw")!;
    return {
      specialist: "fmw",
      label: specialist.label,
      reason: "Fusion Middleware component or integration signals detected.",
      retrievalBoost: specialist.retrievalHints.slice(0, 4).join(" "),
    };
  }

  if (
    /\bwlst\b/.test(text) ||
    /\bchecklist\b/.test(text) ||
    /\bhealth[- ]?check\b/.test(text) ||
    /\bscript\b/.test(text) ||
    /\bread[- ]?only\b/.test(text)
  ) {
    const specialist = getSpecialist("wlst")!;
    return {
      specialist: "wlst",
      label: specialist.label,
      reason: "WLST / checklist / health-check signals detected.",
      retrievalBoost: specialist.retrievalHints.slice(0, 4).join(" "),
    };
  }

  if (/\broot cause\b|\brca\b|\bincident\b|\bpostmortem\b/.test(text)) {
    const specialist = getSpecialist("rca")!;
    return {
      specialist: "rca",
      label: specialist.label,
      reason: "Root-cause investigation signals detected.",
      retrievalBoost: specialist.retrievalHints.slice(0, 3).join(" "),
    };
  }

  const specialist = getSpecialist("fmw")!;
  return {
    specialist: "fmw",
    label: specialist.label,
    reason: "Default Oracle Fusion Middleware specialist selected.",
    retrievalBoost: specialist.retrievalHints.slice(0, 3).join(" "),
  };
}

export function buildSpecialistRetrievalQuery(baseQuery: string, route: SpecialistRoute) {
  return `${baseQuery}\n${route.retrievalBoost}`.trim();
}
