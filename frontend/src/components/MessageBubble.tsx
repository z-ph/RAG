import { Collapse, Tag } from "antd";
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

  return (
    <article className={`message-row ${isAssistant ? "assistant" : "user"}`}>
      <div className={`message-avatar ${isAssistant ? "assistant" : "user"}`} aria-hidden="true">
        {avatarLabel}
      </div>
      <div className={`message-shell ${isAssistant ? "assistant" : "user"}`}>
        <div className="message-meta">
          <span>{speakerName}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>

        <div className={`message-bubble ${isAssistant ? "assistant" : "user"}`}>
          {message.sources.length > 0 ? (
            <Collapse
              ghost
              size="small"
              className="sources-panel"
              items={[
                {
                  key: "sources",
                  label: `来源片段 · ${message.sources.length}`,
                  children: (
                    <div className="sources-list">
                      {message.sources.map((source, index) => (
                        <section key={`${source.filename}-${index}`} className="source-card">
                          <div className="source-card-header">
                            <strong>{source.filename}</strong>
                            <Tag color="orange" bordered={false}>
                              {formatScore(source.relevanceScore)}
                            </Tag>
                          </div>
                          <p>{source.excerpt}</p>
                        </section>
                      ))}
                    </div>
                  )
                }
              ]}
            />
          ) : null}
          <div className="message-content">
            {message.content || (message.status === "streaming" ? "正在思考..." : "暂无内容")}
            {message.status === "streaming" ? <span className="typing-cursor" /> : null}
          </div>

          {message.status === "error" ? (
            <Tag color="error" bordered={false}>
              本轮生成失败
            </Tag>
          ) : null}
          {message.status === "cancelled" ? (
            <Tag color="warning" bordered={false}>
              已取消
            </Tag>
          ) : null}
        </div>
      </div>
    </article>
  );
}
