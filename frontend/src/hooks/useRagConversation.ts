import { useEffect, useRef, useState } from "react";
import { cancelConversation, clearConversation, streamRagAnswer } from "../lib/api";
import {
  createAssistantIntro,
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
  const [messages, setMessages] = useState<ChatMessage[]>([createAssistantIntro()]);
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(5);
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
              content: item.content || payload.reason || "本次回答已取消。"
            }));
          },
          onError(errorText) {
            updateMessage(assistantId, (item) => ({
              ...item,
              status: "error",
              content: item.content || errorText
            }));
          }
        },
        controller.signal
      );

      updateMessage(assistantId, (item) => ({
        ...item,
        status: item.status === "streaming" ? "complete" : item.status
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "cancelled",
          content: item.content || "本次回答已取消。"
        }));
      } else {
        const errorText = error instanceof Error ? error.message : "生成失败";
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "error",
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
      setMessages([createAssistantIntro()]);
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
