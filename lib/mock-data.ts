export const featureCards = [
  "Ask WebLogic questions",
  "Analyze logs",
  "Troubleshoot startup failures",
  "Explain BEA errors",
  "Review configuration snippets",
  "Generate admin checklists",
];

export const architectureSteps = [
  {
    title: "Upload docs",
    description: "Add logs, domain configs, runbooks, WLST scripts, and Oracle notes into the knowledge base.",
  },
  {
    title: "Plan and retrieve",
    description: "Agentci AI classifies the request, searches memory, and retrieves WebLogic-specific evidence.",
  },
  {
    title: "Assess and refine",
    description: "Weak evidence triggers a rewrite_query hop and a second retrieval before answering.",
  },
  {
    title: "Answer with citations",
    description: "The final response separates confirmed evidence from probable cause and cites source chunks.",
  },
];

export const promptChips = [
  "Why is my managed server stuck in STARTING?",
  "Analyze JDBC connection pool failures and BEA-001129",
  "Decode BEA-000365 and related startup warnings",
  "Create a read-only WLST health-check checklist for this domain",
  "Is an LLM agent appropriate vs automation for JDBC waiter paging?",
  "Design SLOs, eval, and guardrails for this RAG desk from prototype to production",
];
