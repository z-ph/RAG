import {
  ClearOutlined,
  DatabaseOutlined,
  PictureOutlined,
  SendOutlined,
  PauseCircleFilled,
  SettingOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Button, Input } from "antd";
import { useRef, useState } from "react";
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
  onOpenAdmin?: () => void;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onSendWithImage?: (image: File, question: string, previewUrl: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearPendingImage() {
    setPendingImage(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleSend() {
    if (props.streaming) {
      void props.onCancel();
      return;
    }
    if (!props.prompt.trim()) return;

    if (pendingImage && props.onSendWithImage && previewUrl) {
      void props.onSendWithImage(pendingImage, props.prompt.trim(), previewUrl);
      setPendingImage(null);
      setPreviewUrl(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    } else {
      void props.onSend();
    }
  }

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
            <Input
              type="number"
              min={1}
              value={props.maxResults}
              className="!w-[72px] text-center"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) props.onMaxResultsChange(v);
              }}
            />
            <Button
              className="!rounded-full !border-white/[0.7] !bg-white/[0.85] !px-4 !text-ink-700 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
              icon={<ClearOutlined />}
              onClick={() => void props.onClearConversation()}
            >
              清空对话
            </Button>
            {props.onOpenAdmin && (
              <Button
                className="!rounded-full !border-ink-950/10 !bg-amber-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
                icon={<SettingOutlined />}
                onClick={props.onOpenAdmin}
              >
                管理
              </Button>
            )}
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

        <div>
          {previewUrl && pendingImage && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2">
              <img src={previewUrl} alt="preview" className="h-12 w-12 rounded object-cover" />
              <span className="truncate text-xs text-ink-600">{pendingImage.name}</span>
              <Button type="text" size="small" danger onClick={clearPendingImage}>移除</Button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              type="text"
              icon={<PictureOutlined />}
              className={pendingImage ? "!text-accent-500" : ""}
              onClick={() => imageInputRef.current?.click()}
              title="上传图片提问"
            />
            <Input
              value={props.prompt}
              placeholder="输入你的问题。"
              onChange={(event) => props.onPromptChange(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey && !props.streaming) {
                  event.preventDefault();
                  handleSend();
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
              onClick={handleSend}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
