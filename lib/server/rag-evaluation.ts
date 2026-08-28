import { routeSpecialistAgent } from "@/lib/server/specialists/orchestrator";
import { searchKnowledge } from "@/lib/server/agent-tools";
import type { AppConfig } from "@/types/backend";

export interface RagEvaluationCase {
  id: string;
  question: string;
  expectedSpecialist: string;
  expectedDocuments: string[];
  expectedTerms: string[];
}

export const FMW_RAG_EVALUATION_SET: RagEvaluationCase[] = [
  { id: "fmw-startup-001", question: "Why did ms-payments-01 stay in ADMIN instead of RUNNING?", expectedSpecialist: "fmw", expectedDocuments: ["01-managed-server-startup-stuck.log"], expectedTerms: ["FinanceXADataSource", "PaymentFileStore"] },
  { id: "fmw-jdbc-001", question: "Find the root cause of the OrdersCoreDS incident.", expectedSpecialist: "rca", expectedDocuments: ["02-jdbc-pool-exhaustion.log"], expectedTerms: ["ORA-00020", "ActiveConnectionsCurrentCount"] },
  { id: "fmw-jms-001", question: "Why did BillingJMSServer fail to start?", expectedSpecialist: "fmw", expectedDocuments: ["03-jms-persistent-store-failure.log"], expectedTerms: ["BillingFileStore", "checksum mismatch"] },
  { id: "fmw-deploy-001", question: "Explain the portal-ui deployment failure.", expectedSpecialist: "fmw", expectedDocuments: ["04-deployment-classloading-conflict.log"], expectedTerms: ["NoSuchMethodError", "jsr311-api"] },
  { id: "fmw-webservice-001", question: "Why are claims requests getting stuck?", expectedSpecialist: "fmw", expectedDocuments: ["05-webservice-timeout-and-stuck-thread.log"], expectedTerms: ["PolicyValidation", "stuck"] },
  { id: "fmw-nodemanager-001", question: "Why cannot AdminServer start ms-inventory-02 through Node Manager?", expectedSpecialist: "fmw", expectedDocuments: ["06-node-manager-ssl-handshake.log"], expectedTerms: ["hostname verification", "CN"] },
  { id: "fmw-wlst-001", question: "Give me a read-only WLST health check for a managed server.", expectedSpecialist: "wlst", expectedDocuments: ["07-rca-runbook.md", "08-domain-config-notes.properties"], expectedTerms: ["WLST", "health"] },
  { id: "fmw-bea-001", question: "What does BEA-001129 mean in this datasource failure?", expectedSpecialist: "bea", expectedDocuments: ["02-jdbc-pool-exhaustion.log"], expectedTerms: ["BEA-001129", "connection pool"] },
];

export async function runRagEvaluation(config: AppConfig, ownerUsername: string) {
  const results = await Promise.all(FMW_RAG_EVALUATION_SET.map(async (testCase) => {
    const route = routeSpecialistAgent(testCase.question);
    const chunks = await searchKnowledge(config, testCase.question, ownerUsername);
    const retrievedText = chunks.map((chunk) => `${chunk.documentName}\n${chunk.text}`).join("\n").toLowerCase();
    const foundDocuments = testCase.expectedDocuments.filter((document) => chunks.some((chunk) => chunk.documentName === document));
    const foundTerms = testCase.expectedTerms.filter((term) => retrievedText.includes(term.toLowerCase()));
    return {
      id: testCase.id,
      expectedSpecialist: testCase.expectedSpecialist,
      actualSpecialist: route.specialist,
      specialistPass: route.specialist === testCase.expectedSpecialist,
      expectedDocuments: testCase.expectedDocuments,
      foundDocuments,
      documentRecall: ratio(foundDocuments.length, testCase.expectedDocuments.length),
      expectedTerms: testCase.expectedTerms,
      foundTerms,
      termCoverage: ratio(foundTerms.length, testCase.expectedTerms.length),
      retrievedChunks: chunks.length,
    };
  }));
  return {
    dataset: "fmw-rag-v1",
    evaluatedAt: new Date().toISOString(),
    totalCases: results.length,
    specialistAccuracy: average(results.map((result) => Number(result.specialistPass))),
    documentRecallAtK: average(results.map((result) => result.documentRecall)),
    termCoverageAtK: average(results.map((result) => result.termCoverage)),
    results,
  };
}

function ratio(value: number, total: number) { return total ? Math.round((value / total) * 100) : 0; }
function average(values: number[]) { return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : 0; }
