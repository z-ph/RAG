import type { ChatMessage } from "../types";

function createMessageId(role: ChatMessage["role"]) {
  return `${role}-${crypto.randomUUID()}`;
}

function createTimestamp() {
  return new Date().toISOString();
}

export function createAssistantIntro(): ChatMessage {
  return {
    id: createMessageId("assistant"),
    role: "assistant",
    content: "上传 PDF 或 TXT 后就可以直接提问。我会流式返回答案，并给出命中的来源片段。",
    createdAt: createTimestamp(),
    status: "complete",
    sources: []
  };
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
