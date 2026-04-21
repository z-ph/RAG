import {
  ClearOutlined,
  DatabaseOutlined,
  SendOutlined,
  PauseCircleFilled,
  UserOutlined
} from "@ant-design/icons";
import { Button, Input, Select } from "antd";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
  maxResults: number;
  streaming: boolean;
  authenticated: boolean;
  authUser: { username: string; role: string } | null;
  onOpenDocuments: () => void;
  onOpenAuth: () => void;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              className="!rounded-full !border-ink-950/10 !bg-sky-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
              icon={<DatabaseOutlined />}
              onClick={props.onOpenDocuments}
            >
              文档集合
            </Button>
            <Select
              value={props.maxResults}
              className="!w-[108px]"
              options={[
                { label: "16", value: 16 },
                { label: "64", value: 64 },
                { label: "256", value: 256 },
                { label: "1024", value: 1024 }
              ]}
              onChange={props.onMaxResultsChange}
            />
            <Button
              className="!rounded-full !border-white/[0.7] !bg-white/[0.85] !px-4 !text-ink-700 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
              icon={<ClearOutlined />}
              onClick={() => void props.onClearConversation()}
            >
              清空对话
            </Button>
            <Button
              className={`!rounded-full !px-4 !shadow-none ${
                props.authenticated
                  ? "!border-volcano-200 !bg-volcano-50/80 !text-volcano-700 hover:!border-volcano-300 hover:!text-volcano-800"
                  : "!border-ink-950/10 !bg-white/[0.72] !text-ink-700 hover:!border-accent-500/[0.25] hover:!text-accent-500"
              }`}
              icon={<UserOutlined />}
              onClick={props.onOpenAuth}
            >
              {props.authenticated && props.authUser
                ? `${props.authUser.username} (${props.authUser.role === "ADMIN" ? "管理" : "成员"})`
                : "用户登录"}
            </Button>
          </div>

        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-0.5">
          {props.messages.map((entry) => (
            <MessageBubble key={entry.id} message={entry} />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Input
            value={props.prompt}
            placeholder="输入你的问题。"
            onChange={(event) => props.onPromptChange(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey && !props.streaming) {
                event.preventDefault();
                void props.onSend();
              }
            }}
          />
          <Button
            type={props.streaming ? "default" : "primary"}
            danger={props.streaming}
            size="large"
            className={
              props.streaming
                ? "!rounded-full !px-6 !shadow-none"
                : "!rounded-full !border-none !bg-accent-500 !px-6 !shadow-none hover:!bg-accent-400"
            }
            icon={props.streaming ? <PauseCircleFilled /> : <SendOutlined />}
            disabled={!props.streaming && !props.prompt.trim()}
            onClick={() => {
              if (props.streaming) {
                void props.onCancel();
                return;
              }

              void props.onSend();
            }}
          />
        </div>
      </div>
    </section>
  );
}
