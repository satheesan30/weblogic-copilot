export function isOperationalQuestion(question: string) {
  const normalized = question.toLowerCase();
  const asksForGeneralExplanation =
    /^(what is|what are|define|explain|tell me about|meaning of|difference between)\b/.test(normalized) ||
    normalized.includes(" in simple terms") ||
    normalized.includes(" for beginners");
  const hasIncidentSignal = [
    /\banaly[sz]e\b/,
    /\bbea-\d+/,
    /\berrors?\b/,
    /\bexceptions?\b/,
    /\bfailed\b/,
    /\bfailures?\b/,
    /\bincidents?\b/,
    /\bissues?\b/,
    /\blogs?\b/,
    /\brca\b/,
    /\broot cause\b/,
    /\bstuck\b/,
    /\btimeouts?\b/,
    /\btroubleshoot(?:ing)?\b/,
    /\bwarnings?\b/,
  ].some((pattern) => pattern.test(normalized));

  if (asksForGeneralExplanation && !hasIncidentSignal) {
    return false;
  }

  const operationalKeywords = [
    "weblogic",
    "bea-",
    "jdbc",
    "jms",
    "wlst",
    "node manager",
    "managed server",
    "adminserver",
    "datasource",
    "data source",
    "connection pool",
    "persistent store",
    "deployment",
    "stuck thread",
    "thread dump",
    "server log",
    "log analysis",
    "root cause",
    "rca",
    "incident",
    "cluster",
    "work manager",
    "outofmemory",
    "heap",
    "xms",
    "xmx",
    "domain config",
  ];

  return operationalKeywords.some((keyword) => normalized.includes(keyword));
}
