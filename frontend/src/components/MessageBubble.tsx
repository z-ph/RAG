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

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const speakerName = isAssistant ? "Knowledge Copilot" : "You";
  const avatarLabel = isAssistant ? "AI" : "你";
  const rowClass = isAssistant ? "justify-start" : "flex-row-reverse justify-end";
  const shellClass = isAssistant ? "items-start" : "items-end";
  const metaClass = isAssistant ? "justify-start" : "justify-end";
  const avatarClass = isAssistant
    ? "border border-sky-500/[0.14] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(230,240,255,0.96))] text-ink-900"
    : "bg-[linear-gradient(135deg,rgba(242,91,42,0.98),rgba(255,137,81,0.92))] text-white";
  const bubbleClass = isAssistant
    ? "rounded-tl-[8px] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(247,250,255,0.90))] text-ink-950"
    : "rounded-tr-[8px] bg-[linear-gradient(135deg,rgba(242,91,42,0.96),rgba(255,131,74,0.88))] text-white";
  const sourceDividerClass = isAssistant ? "border-ink-950/8" : "border-white/[0.2]";
  const sourceLabelClass = isAssistant ? "text-ink-700" : "text-white/[0.82]";
  const sourceHintClass = isAssistant ? "text-ink-500" : "text-white/70";
  const sourceAccentClass = isAssistant ? "border-accent-500/[0.28]" : "border-white/[0.32]";
  const sourceTitleClass = isAssistant ? "text-ink-900" : "text-white";
  const sourceExcerptClass = isAssistant ? "text-ink-700" : "text-white/[0.88]";
  const scoreClass = isAssistant
    ? "bg-accent-500/[0.12] text-accent-500"
    : "bg-white/[0.14] text-white";

  return (
    <article className={`flex w-full items-end gap-2 ${rowClass}`}>
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold tracking-[0.04em] ${avatarClass}`}
        aria-hidden="true"
      >
        {avatarLabel}
      </div>
      <div
        className={`flex min-w-0 flex-1 max-w-[var(--message-shell-max,920px)] flex-col gap-0.5 ${shellClass}`}
      >
        <div className={`flex items-center gap-2 text-[11px] text-ink-950/[0.56] ${metaClass}`}>
          <span>{speakerName}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>

        <div
          className={`w-full rounded-[18px] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.06)] ${bubbleClass}`}
        >
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
            {message.content || (message.status === "streaming" ? "正在思考..." : "暂无内容")}
            {message.status === "streaming" ? (
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
