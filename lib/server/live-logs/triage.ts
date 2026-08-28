import type { LiveLogSeverity } from "@/lib/server/live-logs/store";

export interface TriageHit {
  severity: LiveLogSeverity;
  title: string;
  detail: string;
  matched: string;
}

const RULES: Array<{
  pattern: RegExp;
  severity: LiveLogSeverity;
  title: string;
  detail: string;
}> = [
  {
    pattern: /\bBEA-(\d+)\b/i,
    severity: "critical",
    title: "BEA error code detected",
    detail: "A WebLogic BEA-xxxxx code appeared in the live stream.",
  },
  {
    pattern: /\bOutOfMemory(?:Error)?\b/i,
    severity: "critical",
    title: "OutOfMemory signal",
    detail: "JVM memory exhaustion indicators found in live logs.",
  },
  {
    pattern: /\bStuckThread\b|\bstuck thread\b/i,
    severity: "critical",
    title: "Stuck thread detected",
    detail: "A stuck-thread warning appeared in the live stream.",
  },
  {
    pattern: /\bConnection refused\b|\bSQLException\b|\bpool waiters?\b|\bJDBC\b.*\bfail/i,
    severity: "warn",
    title: "JDBC / connectivity issue",
    detail: "Database or JDBC pool failure signals found.",
  },
  {
    pattern: /<Error>|SEVERE|FATAL|\bERROR\b/i,
    severity: "warn",
    title: "Error-level log line",
    detail: "An error or severe severity marker appeared.",
  },
];

export function triageLogLines(lines: string[]): TriageHit[] {
  const hits: TriageHit[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const rule of RULES) {
      const match = trimmed.match(rule.pattern);
      if (!match) continue;
      const matched = match[0];
      const key = `${rule.title}:${matched}:${trimmed.slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({
        severity: rule.severity,
        title: rule.title,
        detail: `${rule.detail} Sample: ${trimmed.slice(0, 240)}`,
        matched,
      });
      break;
    }
  }

  return hits;
}
