import {
  ClearOutlined,
  DatabaseOutlined,
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
  onOpenDocuments: () => void;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden px-[18px] py-2 min-[721px]:px-6 min-[721px]:py-3">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
        <div className="flex flex-col items-stretch justify-between gap-3 border-b border-ink-950/8 pb-4 min-[721px]:flex-row min-[721px]:items-center">
          <div className="flex items-center gap-2.5 text-sm font-bold tracking-[0.08em] text-ink-900">
            <MessageOutlined />
            <span>对话流</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 min-[721px]:justify-end">
            <Button
              className="!rounded-full !border-ink-950/10 !bg-sky-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
              icon={<DatabaseOutlined />}
              onClick={props.onOpenDocuments}
            >
              文档控制台
            </Button>
            <Select
              value={props.maxResults}
              className="!w-[108px]"
              options={[
                { label: "3 条", value: 3 },
                { label: "5 条", value: 5 },
                { label: "8 条", value: 8 }
              ]}
              onChange={props.onMaxResultsChange}
            />
            <Button
              className="!rounded-full !border-white/[0.7] !bg-white/[0.85] !px-4 !text-ink-700 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
              icon={<ClearOutlined />}
              onClick={() => void props.onClearConversation()}
            >
              清空
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-0.5">
          {props.messages.map((entry) => (
            <MessageBubble key={entry.id} message={entry} />
          ))}
        </div>

        <div className="grid gap-3 border-t border-ink-950/8 pt-4">
          <Input.TextArea
            className="!rounded-[24px] !border-ink-950/10 !bg-white/[0.9] !px-[18px] !pt-[18px] !pb-[14px] !shadow-none placeholder:!text-ink-500/[0.7]"
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

          <div className="flex flex-col items-stretch justify-end gap-3 min-[721px]:flex-row min-[721px]:items-center">
            <Button
              type={props.streaming ? "default" : "primary"}
              danger={props.streaming}
              size="large"
              className={
                props.streaming
                  ? "!rounded-full !px-6 !shadow-none"
                  : "!rounded-full !border-none !bg-accent-500 !px-6 !shadow-none hover:!bg-accent-400"
              }
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
