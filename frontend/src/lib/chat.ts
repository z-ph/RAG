import type { ChatMessage } from "../types";

function createMessageId(role: ChatMessage["role"]) {
  return `${role}-${crypto.randomUUID()}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

export function createAssistantMessageId() {
  return createMessageId("assistant");
}

export function createStreamingAssistantMessage(id: string): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "",
    createdAt: createTimestamp(),
    status: "streaming",
    sources: []
  };
}

export function createUserMessage(content: string): ChatMessage {
  return {
    id: createMessageId("user"),
    role: "user",
    content,
    createdAt: createTimestamp(),
    status: "complete",
    sources: []
  };
}
