import type { ChatMessage } from "../types";
import { randomUUID } from "./uuid";

function createMessageId(role: ChatMessage["role"]) {
  return `${role}-${randomUUID()}`;
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
    thinking: "",
    thinkingStatus: "idle",
    thinkingDurationMs: 0,
    createdAt: createTimestamp(),
    status: "streaming",
    sources: []
  };
}

export function createUserMessage(content: string, imageUrl?: string): ChatMessage {
  return {
    id: createMessageId("user"),
    role: "user",
    content,
    imageUrl,
    thinking: "",
    thinkingStatus: "idle",
    thinkingDurationMs: 0,
    createdAt: createTimestamp(),
    status: "complete",
    sources: []
  };
}
