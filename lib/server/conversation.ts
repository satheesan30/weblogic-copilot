import type { ChatRequestMessage } from "@/types/backend";
import { isOperationalQuestion } from "@/lib/server/intent";

const FOLLOW_UP_SIGNAL =
  /\b(that|this|it|same|also|again|more|continue|why|how|what about|and then|still|pool|server|error|cause|fix|next)\b/i;

export function normalizeHistory(history: ChatRequestMessage[] | undefined, limit = 8): ChatRequestMessage[] {
  if (!history?.length) return [];

  return history
    .filter((item) => (item.role === "user" || item.role === "assistant") && item.content?.trim())
    .slice(-limit)
    .map((item) => ({
      role: item.role,
      content: item.role === "assistant" ? item.content.trim().slice(0, 1200) : item.content.trim().slice(0, 2000),
    }));
}

export function shouldUseAgenticRag(question: string, history: ChatRequestMessage[] = []) {
  if (isOperationalQuestion(question)) return true;

  const recentText = history
    .slice(-4)
    .map((item) => item.content)
    .join("\n");

  if (!recentText) return false;

  const priorOperational = isOperationalQuestion(recentText);
  const looksLikeFollowUp = question.trim().length < 160 && FOLLOW_UP_SIGNAL.test(question);
  return priorOperational && looksLikeFollowUp;
}

export function buildContextualRetrievalQuery(question: string, history: ChatRequestMessage[] = []) {
  const recentUsers = history
    .filter((item) => item.role === "user")
    .slice(-2)
    .map((item) => item.content.trim())
    .filter(Boolean);

  if (!recentUsers.length) return question;

  const isShortFollowUp = question.trim().length < 160 && FOLLOW_UP_SIGNAL.test(question);
  if (!isShortFollowUp && isOperationalQuestion(question)) return question;

  return `${recentUsers.join("\n")}\n${question}`.trim();
}

export function buildSessionMemoryNote(question: string, answer: string, confidence?: number) {
  const shortAnswer = answer.replace(/\s+/g, " ").trim().slice(0, 280);
  const confidenceText = typeof confidence === "number" ? ` Confidence ${confidence}%.` : "";
  return `Incident thread note: User asked "${question.slice(0, 180)}". Assistant summary: ${shortAnswer}.${confidenceText}`;
}
