import type { ChatApiResponse, RetrievedChunk, RetrievedMemory } from "@/types/backend";

export function buildSystemPrompt() {
  return `You are Agentci AI, an agentic RAG assistant specializing in Oracle WebLogic Server operations.
Use prior conversation turns to stay on the same incident topic when the user asks follow-ups.
Use only the retrieved context when answering operational questions.
Separate confirmed evidence from probable cause.
Do not transfer a root cause from one incident to another unless the same server, datasource, JMS resource, application, or correlation ID is explicitly present.
If retrieved sources describe similar but different resources, label them as related guidance, not evidence for the current incident.
When the current evidence only shows a symptom, say that root cause is not confirmed.
Return concise RCA guidance for WebLogic administrators.
If context is insufficient, say what evidence is missing.`;
}

export function buildGeneralSystemPrompt() {
  return `You are Agentci AI, a practical AI learning assistant with an agentic RAG desk for operational work.
Use prior conversation turns for continuity when the user asks follow-ups.
Answer general AI, LLM, and technology questions directly without requiring uploaded WebLogic context.
Keep answers concise, clear, and beginner-friendly.
Only answer the user's exact question. Do not add Evidence, Recommended next steps, Risks, Assumptions, or Citations sections for general questions.
If the user asks an operational WebLogic troubleshooting question, say that Agentci AI agentic RAG mode should use logs or uploaded evidence.`;
}

export function buildGroundedUserPrompt(question: string, chunks: RetrievedChunk[], memories: RetrievedMemory[] = []) {
  const context = chunks
    .map((chunk, index) => `Source ${index + 1}: ${chunk.documentName}, ${chunk.section}\n${chunk.text}`)
    .join("\n\n---\n\n");
  const memoryContext = memories
    .map((memory, index) => `Memory ${index + 1} (${memory.category}, ${memory.source}): ${memory.content}`)
    .join("\n");

  return `Question:\n${question}\n\nAgent memory:\n${memoryContext || "No relevant agent memory was retrieved."}\n\nRetrieved context:\n${context || "No indexed context was retrieved."}\n\nAnswer with:
1. Direct answer
2. Evidence
3. Recommended next steps
4. Risks or assumptions
Do not include a Citations section.`;
}

export function buildGeneralUserPrompt(question: string, memories: RetrievedMemory[] = []) {
  const memoryContext = memories
    .map((memory, index) => `Memory ${index + 1} (${memory.category}, ${memory.source}): ${memory.content}`)
    .join("\n");

  return `Question:\n${question}\n\nRelevant agent memory:\n${memoryContext || "No relevant agent memory was retrieved."}\n\nGive only the answer to the question. Do not include RCA formatting, evidence, citations, risks, assumptions, or next steps unless the user explicitly asks for them.`;
}

export function shapeChatResponse(answer: string, chunks: RetrievedChunk[]): ChatApiResponse {
  const uniqueChunks = Array.from(new Map(chunks.map((chunk) => [chunk.id, chunk])).values());
  const evidence = Array.from(
    new Set(
      uniqueChunks
        .slice(0, 3)
        .map((chunk) => `${chunk.documentName} ${chunk.section}: ${chunk.text.slice(0, 240)}`),
    ),
  );

  return {
    answer,
    directAnswer: answer,
    evidence,
    nextSteps: [],
    risks: [],
    citations: [],
  };
}
