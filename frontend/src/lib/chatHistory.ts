import type { ChatMessage } from "../types";

const STORAGE_KEY = "rag_chat_history";
const MAX_MESSAGES = 500;

interface StoredConversation {
  messages: ChatMessage[];
  conversationId: string | null;
}

export function saveConversation(messages: ChatMessage[], conversationId: string | null): void {
  const completed = messages.filter((m) => m.status !== "streaming");
  try {
    const data: StoredConversation = {
      messages: completed.slice(-MAX_MESSAGES),
      conversationId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full — trim oldest messages and retry
    const trimmed = messages.filter((m) => m.status !== "streaming").slice(-100);
    try {
      const data: StoredConversation = { messages: trimmed, conversationId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // give up silently
    }
  }
}

export function loadConversation(): StoredConversation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConversation;
  } catch {
    return null;
  }
}

export function clearStoredConversation(): void {
  localStorage.removeItem(STORAGE_KEY);
}
