import {
  ClearOutlined,
  MessageOutlined,
  SendOutlined,
  StopOutlined
} from "@ant-design/icons";
import { Button, Input, Select } from "antd";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
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
      <div className="chat-panel">
        <div className="chat-toolbar">
          <div className="chat-toolbar-title">
            <MessageOutlined />
            <span>对话流</span>
          </div>
          <div className="chat-toolbar-controls">
            <Select
              value={props.maxResults}
              className="results-select"
              options={[
                { label: "3 条", value: 3 },
                { label: "5 条", value: 5 },
                { label: "8 条", value: 8 }
              ]}
              onChange={props.onMaxResultsChange}
            />
            <Button icon={<ClearOutlined />} onClick={() => void props.onClearConversation()}>
              清空
            </Button>
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
