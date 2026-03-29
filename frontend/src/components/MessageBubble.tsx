import { CheckOutlined, CopyOutlined, LoadingOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import type { ChatMessage } from "../types";

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function getElapsedSeconds(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

function getElapsedSecondsFromTime(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSegment = String(minutes).padStart(2, "0");
  const secondSegment = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${minuteSegment}:${secondSegment}`;
  }

  return `${minuteSegment}:${secondSegment}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const showSourceLoading = isAssistant && message.status === "streaming" && message.sources.length === 0;
  const showThinkingTimer =
    isAssistant && message.status === "streaming" && message.sources.length > 0 && !message.content;
  const shellMaxWidth = "min(var(--message-shell-max, 920px), calc(100% - 5rem))";
  const [sourceLoadingSeconds, setSourceLoadingSeconds] = useState(() =>
    getElapsedSeconds(message.createdAt)
  );
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [copied, setCopied] = useState(false);
  const copyableContent = message.content.trim();
  const speakerName = isAssistant ? "Knowledge Copilot" : "You";
  const avatarLabel = isAssistant ? "AI" : "你";
  const rowClass = isAssistant ? "justify-start" : "flex-row-reverse justify-start";
  const shellClass = isAssistant ? "items-start" : "items-end";
  const metaClass = isAssistant ? "justify-start" : "justify-end";
  const avatarClass = isAssistant
    ? "border border-sky-500/[0.14] bg-white text-ink-900"
    : "bg-accent-500 text-white";
  const bubbleClass = isAssistant
    ? "rounded-tl-[8px] bg-white text-ink-950"
    : "rounded-tr-[8px] bg-accent-500 text-white";
  const sourceDividerClass = isAssistant ? "border-ink-950/8" : "border-white/[0.2]";
  const sourceLabelClass = isAssistant ? "text-ink-700" : "text-white/[0.82]";
  const sourceHintClass = isAssistant ? "text-ink-500" : "text-white/70";
  const sourceAccentClass = isAssistant ? "border-accent-500/[0.28]" : "border-white/[0.32]";
  const sourceTitleClass = isAssistant ? "text-ink-900" : "text-white";
  const sourceExcerptClass = isAssistant ? "text-ink-700" : "text-white/[0.88]";
  const sourceLoadingClass = isAssistant
    ? "border-amber-500/[0.2] bg-amber-50 text-amber-700"
    : "border-white/[0.24] bg-white/[0.1] text-white/[0.9]";
  const scoreClass = isAssistant
    ? "bg-accent-500/[0.12] text-accent-500"
    : "bg-white/[0.14] text-white";
  const copyButtonClass = isAssistant
    ? "border-ink-950/10 bg-white/88 text-ink-700 hover:border-accent-500/[0.28] hover:text-accent-500"
    : "border-accent-500/[0.16] bg-accent-500/[0.08] text-accent-500 hover:border-accent-500/[0.3] hover:bg-accent-500/[0.12]";

  useEffect(() => {
    setSourceLoadingSeconds(getElapsedSeconds(message.createdAt));

    if (!showSourceLoading) {
      return;
    }

    const timer = window.setInterval(() => {
      setSourceLoadingSeconds(getElapsedSeconds(message.createdAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [message.createdAt, showSourceLoading]);

  useEffect(() => {
    setThinkingSeconds(0);

    if (!showThinkingTimer) {
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setThinkingSeconds(getElapsedSecondsFromTime(startedAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [showThinkingTimer]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!copyableContent) {
      return;
    }

    await copyText(copyableContent);
    setCopied(true);
  }

  return (
    <article className={`flex w-full items-start gap-2 ${rowClass}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold tracking-[0.04em] ${avatarClass}`}
        aria-hidden="true"
      >
        {avatarLabel}
      </div>
      <div
        className={`flex min-w-0 flex-col gap-0.5 ${shellClass}`}
        style={{ maxWidth: shellMaxWidth }}
      >
        <div className={`flex items-center gap-2 text-[11px] text-ink-950/[0.56] ${metaClass}`}>
          <span>{speakerName}</span>
          <span>{formatTime(message.createdAt)}</span>
          <button
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:border-ink-950/8 disabled:bg-ink-950/[0.04] disabled:text-ink-950/[0.32] ${copyButtonClass}`}
            onClick={() => void handleCopy()}
            disabled={!copyableContent}
            aria-label={copied ? "已复制消息" : "复制消息"}
            title={copied ? "已复制" : "复制"}
          >
            {copied ? <CheckOutlined /> : <CopyOutlined />}
            <span>{copied ? "已复制" : "复制"}</span>
          </button>
        </div>

        <div
          className={`inline-flex max-w-full flex-col rounded-[18px] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.06)] ${bubbleClass}`}
        >
          {showSourceLoading ? (
            <div
              className={`mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${sourceLoadingClass}`}
            >
              <LoadingOutlined className="text-[12px]" />
              <span>正在检索文档</span>
              <span className="tabular-nums">{formatDuration(sourceLoadingSeconds)}</span>
            </div>
          ) : null}
          {message.sources.length > 0 ? (
            <details className={`group mb-2 border-b pb-2 ${sourceDividerClass}`}>
              <summary
                className={`flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden ${sourceLabelClass}`}
              >
                <span>来源片段 · {message.sources.length}</span>
                <span
                  className={`text-[10px] tracking-[0.2em] transition-transform group-open:rotate-180 ${sourceHintClass}`}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>
              <div className="mt-2 grid gap-2">
                {message.sources.map((source, index) => (
                  <section
                    key={`${source.filename}-${index}`}
                    className={`border-l-[3px] pl-2.5 ${sourceAccentClass}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className={`block truncate text-sm font-semibold ${sourceTitleClass}`}>
                        {source.filename}
                      </strong>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${scoreClass}`}
                      >
                        {formatScore(source.relevanceScore)}
                      </span>
                    </div>
                    <p className={`mt-1 text-[13px] leading-[1.55] ${sourceExcerptClass}`}>
                      {source.excerpt}
                    </p>
                  </section>
                ))}
              </div>
            </details>
          ) : null}
          <div className="whitespace-pre-wrap text-sm leading-6">
            {message.content ? (
              message.content
            ) : showThinkingTimer ? (
              <>
                <span>正在思考</span>
                <span className="ml-1 inline-block tabular-nums text-accent-500">
                  {formatDuration(thinkingSeconds)}
                </span>
              </>
            ) : (
              ""
            )}
            {message.status === "streaming" && (showThinkingTimer || Boolean(message.content)) ? (
              <span
                className={`ml-1 inline-block h-[18px] w-2.5 translate-y-[3px] animate-pulse rounded ${isAssistant ? "bg-accent-500" : "bg-white/[0.92]"}`}
              />
            ) : null}
          </div>

          {message.status === "error" ? (
            <span className="mt-2 inline-flex rounded-full bg-rose-500/[0.14] px-3 py-1 text-xs font-medium text-rose-700">
              本轮生成失败
            </span>
          ) : null}
          {message.status === "cancelled" ? (
            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${isAssistant ? "bg-amber-500/[0.16] text-amber-700" : "bg-white/[0.18] text-white"}`}
            >
              已取消
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
