import { onBeforeUnmount, ref } from "vue";
import { cancelConversation, clearConversation, streamRagAnswer } from "../lib/api";
import {
  createAssistantMessageId,
  createStreamingAssistantMessage,
  createUserMessage
} from "../lib/chat";
import type { ChatMessage } from "../types";

interface MessageApi {
  error: (content: string) => void;
  info: (content: string) => void;
  success: (content: string) => void;
  warning: (content: string) => void;
}

export function useRagConversation(messageApi: MessageApi) {
  const messages = ref<ChatMessage[]>([]);
  const prompt = ref("");
  const conversationId = ref<string | null>(null);
  const maxResults = ref(64);
  const streaming = ref(false);
  const abortController = ref<AbortController | null>(null);

  onBeforeUnmount(() => {
    abortController.value?.abort();
  });

  function setPrompt(value: string) {
    prompt.value = value;
  }

  function setMaxResults(value: number) {
    maxResults.value = value;
  }

  function updateMessage(
    targetId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    messages.value = messages.value.map((item) =>
      item.id === targetId ? updater(item) : item
    );
  }

  async function handleSend(nextQuestion?: string) {
    const question = (nextQuestion ?? prompt.value).trim();

    if (!question || streaming.value) {
      return;
    }

    const nextConversationId = conversationId.value || `web-${crypto.randomUUID()}`;
    const assistantId = createAssistantMessageId();

    conversationId.value = nextConversationId;
    prompt.value = "";
    streaming.value = true;
    messages.value = [
      ...messages.value,
      createUserMessage(question),
      createStreamingAssistantMessage(assistantId)
    ];

    const controller = new AbortController();
    abortController.value = controller;

    try {
      await streamRagAnswer(
        {
          question,
          conversationId: nextConversationId,
          maxResults: maxResults.value
        },
        {
          onStart(payload) {
            if (payload.conversationId) {
              conversationId.value = payload.conversationId;
            }
          },
          onSources(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              sources: payload
            }));
          },
          onThinkingDelta(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              thinking: item.thinking + payload,
              thinkingStatus: "streaming"
            }));
          },
          onThinkingEnd(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              thinkingStatus: payload.thinkingEnded ? "complete" : item.thinkingStatus
            }));
          },
          onDelta(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              content: item.content + payload
            }));
          },
          onComplete(payload) {
            if (payload.conversationId) {
              conversationId.value = payload.conversationId;
            }

            updateMessage(assistantId, (item) => ({
              ...item,
              content: payload.content ?? item.content,
              thinking: payload.thinking ?? item.thinking,
              thinkingStatus:
                payload.thinking || item.thinking ? "complete" : item.thinkingStatus,
              status: payload.cancelled ? "cancelled" : "complete"
            }));
          },
          onCancelled(payload) {
            if (payload.conversationId) {
              conversationId.value = payload.conversationId;
            }

            updateMessage(assistantId, (item) => ({
              ...item,
              status: "cancelled",
              thinkingStatus: item.thinking ? "complete" : item.thinkingStatus,
              content: item.content || payload.reason || "本次回答已取消。"
            }));
          },
          onError(errorText) {
            updateMessage(assistantId, (item) => ({
              ...item,
              status: "error",
              thinkingStatus: item.thinking ? "complete" : item.thinkingStatus,
              content: item.content || errorText
            }));
          }
        },
        controller.signal
      );

      updateMessage(assistantId, (item) => ({
        ...item,
        thinkingStatus:
          item.thinking && item.thinkingStatus !== "complete"
            ? "complete"
            : item.thinkingStatus,
        status: item.status === "streaming" ? "complete" : item.status
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "cancelled",
          thinkingStatus: item.thinking ? "complete" : item.thinkingStatus,
          content: item.content || "本次回答已取消。"
        }));
      } else {
        const errorText = error instanceof Error ? error.message : "生成失败";
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "error",
          thinkingStatus: item.thinking ? "complete" : item.thinkingStatus,
          content: item.content || errorText
        }));
        messageApi.error(errorText);
      }
    } finally {
      abortController.value = null;
      streaming.value = false;
    }
  }

  async function handleCancel() {
    if (!conversationId.value) {
      abortController.value?.abort();
      return;
    }

    abortController.value?.abort();

    try {
      await cancelConversation(conversationId.value);
      messageApi.info("已发送取消指令");
    } catch (error) {
      messageApi.warning(error instanceof Error ? error.message : "取消请求未完成");
    }
  }

  async function handleClearConversation() {
    abortController.value?.abort();

    try {
      if (conversationId.value) {
        await clearConversation(conversationId.value);
      }

      conversationId.value = null;
      messages.value = [];
      messageApi.success("会话上下文已清空");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "清空会话失败");
    } finally {
      streaming.value = false;
    }
  }

  return {
    messages,
    prompt,
    setPrompt,
    conversationId,
    maxResults,
    setMaxResults,
    streaming,
    handleSend,
    handleCancel,
    handleClearConversation
  };
}
