import { useEffect, useRef, useState } from "react";
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(64);
  const [streaming, setStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  function updateMessage(
    targetId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    setMessages((current) =>
      current.map((item) => (item.id === targetId ? updater(item) : item))
    );
  }

  async function handleSend(nextQuestion?: string) {
    const question = (nextQuestion ?? prompt).trim();

    if (!question || streaming) {
      return;
    }

    const nextConversationId = conversationId || `web-${crypto.randomUUID()}`;
    const assistantId = createAssistantMessageId();

    setConversationId(nextConversationId);
    setPrompt("");
    setStreaming(true);
    setMessages((current) => [
      ...current,
      createUserMessage(question),
      createStreamingAssistantMessage(assistantId)
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamRagAnswer(
        {
          question,
          conversationId: nextConversationId,
          maxResults
        },
        {
          onStart(payload) {
            if (payload.conversationId) {
              setConversationId(payload.conversationId);
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
              setConversationId(payload.conversationId);
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
              setConversationId(payload.conversationId);
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
      abortControllerRef.current = null;
      setStreaming(false);
    }
  }

  async function handleCancel() {
    if (!conversationId) {
      abortControllerRef.current?.abort();
      return;
    }

    abortControllerRef.current?.abort();

    try {
      await cancelConversation(conversationId);
      messageApi.info("已发送取消指令");
    } catch (error) {
      messageApi.warning(error instanceof Error ? error.message : "取消请求未完成");
    }
  }

  async function handleClearConversation() {
    abortControllerRef.current?.abort();

    try {
      if (conversationId) {
        await clearConversation(conversationId);
      }

      setConversationId(null);
      setMessages([]);
      messageApi.success("会话上下文已清空");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "清空会话失败");
    } finally {
      setStreaming(false);
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
