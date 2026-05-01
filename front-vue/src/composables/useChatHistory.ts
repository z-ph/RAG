import { onMounted, type Ref } from "vue";
import { saveConversation, loadConversation, clearStoredConversation } from "../lib/chatHistory";
import type { ChatMessage } from "../types";

export function useChatHistory(
  messages: Ref<ChatMessage[]>,
  conversationId: Ref<string | null>
) {
  function persist() {
    saveConversation(messages.value, conversationId.value);
  }

  function restore() {
    const stored = loadConversation();
    if (stored) {
      messages.value = stored.messages;
      conversationId.value = stored.conversationId;
    }
  }

  function clear() {
    clearStoredConversation();
  }

  onMounted(() => {
    restore();
  });

  return {
    persist,
    restore,
    clear
  };
}
