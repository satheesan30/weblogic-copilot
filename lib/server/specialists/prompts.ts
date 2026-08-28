import { SPECIALISTS, type SpecialistId } from "@/lib/server/specialists/catalog";
import type { RetrievedChunk, RetrievedMemory } from "@/types/backend";

export function buildSpecialistSystemPrompt(specialist: SpecialistId) {
  if (specialist === "general") {
    return `You are Agentci AI, a practical AI learning assistant with an agentic RAG desk for operational work.
Use prior conversation turns for continuity when the user asks follow-ups.
Answer general AI, LLM, and technology questions directly without requiring uploaded WebLogic context.
Keep answers concise, clear, and beginner-friendly.
Only answer the user's exact question. Do not add Evidence, Recommended next steps, Risks, Assumptions, or Citations sections for general questions.
If the user asks an operational WebLogic troubleshooting question, say that Agentci AI agentic RAG mode should use logs or uploaded evidence.`;
  }

  return SPECIALISTS[specialist].systemPrompt;
}

export function buildSpecialistUserPrompt(
  specialist: SpecialistId,
  question: string,
  chunks: RetrievedChunk[],
  memories: RetrievedMemory[] = [],
) {
  if (specialist === "general") {
    const memoryContext = memories
      .map((memory, index) => `Memory ${index + 1} (${memory.category}, ${memory.source}): ${memory.content}`)
      .join("\n");
    return `Question:\n${question}\n\nRelevant agent memory:\n${memoryContext || "No relevant agent memory was retrieved."}\n\nGive only the answer to the question. Do not include RCA formatting, evidence, citations, risks, assumptions, or next steps unless the user explicitly asks for them.`;
  }

  const context = chunks
    .map((chunk, index) => `Source ${index + 1}: ${chunk.documentName}, ${chunk.section}\n${chunk.text}`)
    .join("\n\n---\n\n");
  const memoryContext = memories
    .map((memory, index) => `Memory ${index + 1} (${memory.category}, ${memory.source}): ${memory.content}`)
    .join("\n");
  const focus = SPECIALISTS[specialist].answerFocus;

  return `Specialist: ${SPECIALISTS[specialist].label}
Question:
${question}

Agent memory:
${memoryContext || "No relevant agent memory was retrieved."}

Retrieved context:
${context || "No indexed context was retrieved."}

${focus}`;
}
