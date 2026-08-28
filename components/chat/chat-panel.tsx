"use client";

import { useState } from "react";
import { ChatMessageBubble } from "@/components/chat/chat-message";
import { PromptComposer } from "@/components/chat/prompt-chips";
import type { ChatMessage } from "@/types";
import type { ChatApiResponse, ChatRequestMessage } from "@/types/backend";

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("weblogic-copilot-conversation-id") || "",
  );

  function handleUserMessage(content: string) {
    setMessages((current) =>
      current.concat({
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }),
    );
  }

  function handleAssistantResponse(_question: string, response: ChatApiResponse) {
    if (response.conversationId) {
      setConversationId(response.conversationId);
      window.localStorage.setItem("weblogic-copilot-conversation-id", response.conversationId);
    }
    setMessages((current) =>
      current.concat({
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations: undefined,
        evidence: response.evidence,
        nextSteps: response.nextSteps,
        risks: response.risks,
        confidence: response.confidence,
        agentTrace: response.agentTrace,
      }),
    );
  }

  function handleAssistantStreamStart() {
    const id = crypto.randomUUID();
    setMessages((current) =>
      current.concat({
        id,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        streaming: true,
      }),
    );
    return id;
  }

  function handleAssistantToken(id: string, token: string) {
    setMessages((current) =>
      current.map((message) => (message.id === id ? { ...message, content: message.content + token } : message)),
    );
  }

  function handleAssistantStreamDone(id: string, response: ChatApiResponse) {
    if (response.conversationId) {
      setConversationId(response.conversationId);
      window.localStorage.setItem("weblogic-copilot-conversation-id", response.conversationId);
    }
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? {
              ...message,
              content: response.answer,
              streaming: false,
              evidence: response.evidence,
              nextSteps: response.nextSteps,
              risks: response.risks,
              confidence: response.confidence,
              agentTrace: response.agentTrace,
            }
          : message,
      ),
    );
  }

  function handleAssistantStreamError(id: string, message: string) {
    setMessages((current) =>
      current.map((item) => (item.id === id ? { ...item, content: item.content || message, streaming: false } : item)),
    );
  }

  const history: ChatRequestMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return (
    <section className="grid min-h-[430px] grid-rows-[minmax(120px,1fr)_auto] gap-4">
      <div className="desk-panel p-4">
        {messages.length ? (
          <div className="grid gap-4">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}
          </div>
        ) : (
          <div className="grid min-h-44 place-items-center border border-dashed border-line bg-paper-2/60 text-center">
            <div className="max-w-md px-4">
              <p className="font-display text-lg font-semibold text-ink">Start an RCA conversation</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Ask a follow-up in the same thread — short-term chat history and long-term incident memory stay in context.
              </p>
            </div>
          </div>
        )}
      </div>
      <PromptComposer
        history={history}
        conversationId={conversationId}
        onAssistantResponse={handleAssistantResponse}
        onAssistantStreamStart={handleAssistantStreamStart}
        onAssistantToken={handleAssistantToken}
        onAssistantStreamDone={handleAssistantStreamDone}
        onAssistantStreamError={handleAssistantStreamError}
        onUserMessage={handleUserMessage}
      />
    </section>
  );
}
