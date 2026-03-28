import {
  ClearOutlined,
  MessageOutlined,
  SendOutlined,
  StopOutlined
} from "@ant-design/icons";
import { Button, Input, Select, Space, Tag, Typography } from "antd";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

const suggestions = [
  "总结当前知识库里最重要的三条结论",
  "把文档内容整理成一份汇报提纲",
  "列出文档里涉及的关键流程与风险点"
];

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
  conversationId: string | null;
  maxResults: number;
  streaming: boolean;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <section className="surface panel-main">
      <div className="hero-banner">
        <div>
          <Tag color="geekblue" bordered={false}>
            AI Chat Workspace
          </Tag>
          <Typography.Title level={2} className="hero-title">
            企业知识库对话台
          </Typography.Title>
          <Typography.Paragraph className="hero-copy">
            采用 React + Vite 构建，直接消费后端 `POST /api/rag/ask/stream` 事件流。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Select
            value={props.maxResults}
            className="results-select"
            options={[
              { label: "Top 3", value: 3 },
              { label: "Top 5", value: 5 },
              { label: "Top 8", value: 8 }
            ]}
            onChange={props.onMaxResultsChange}
          />

          <Button icon={<ClearOutlined />} onClick={() => void props.onClearConversation()}>
            清空会话
          </Button>
        </Space>
      </div>

      <div className="suggestion-row">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            className="suggestion-chip"
            onClick={() => void props.onSend(item)}
            disabled={props.streaming}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="chat-panel">
        <div className="chat-toolbar">
          <div className="chat-toolbar-title">
            <MessageOutlined />
            <span>对话流</span>
          </div>
          <div className="chat-toolbar-meta">
            <span>Conversation</span>
            <code>{props.conversationId || "待创建"}</code>
          </div>
        </div>

        <div className="messages-stack">
          {props.messages.map((entry) => (
            <MessageBubble key={entry.id} message={entry} />
          ))}
        </div>

        <div className="composer-panel">
          <Input.TextArea
            value={props.prompt}
            rows={4}
            placeholder="输入你的问题，例如：请提炼这批制度文档的办理流程和责任边界。"
            onChange={(event) => props.onPromptChange(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey && !props.streaming) {
                event.preventDefault();
                void props.onSend();
              }
            }}
          />

          <div className="composer-footer">
            <div className="composer-hint">
              Shift + Enter 换行，Enter 发送；生成中可继续编辑输入框
            </div>
            <Button
              type={props.streaming ? "default" : "primary"}
              danger={props.streaming}
              size="large"
              icon={props.streaming ? <StopOutlined /> : <SendOutlined />}
              disabled={!props.streaming && !props.prompt.trim()}
              onClick={() => {
                if (props.streaming) {
                  void props.onCancel();
                  return;
                }

                void props.onSend();
              }}
            >
              {props.streaming ? "取消生成" : "发送问题"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
