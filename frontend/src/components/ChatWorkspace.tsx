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
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
  maxResults: number;
  streaming: boolean;
  authenticated: boolean;
  authUser: { username: string; role: string; roleCode: string } | null;
  onOpenDocuments: () => void;
  onOpenAuth: () => void;
  onOpenAdmin?: string;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onSendWithImage?: (image: File, question: string, previewUrl: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const navigate = useNavigate();
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const messageCount = props.messages.length;
    const lastMessage = props.messages[messageCount - 1];
    if (messageCount > prevMessageCountRef.current && lastMessage?.role === "user") {
      container.scrollTop = container.scrollHeight;
    } else {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [props.messages]);

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
    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    });
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              className="!border-ink-950/10 !bg-sky-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
              icon={<DatabaseOutlined />}
              onClick={props.onOpenDocuments}
            >
              文档集合
            </Button>
            <Input
              type="number"
              min={1}
              value={props.maxResults}
              className="!w-[72px] !border-ink-950/10 !bg-white/80 !text-center !shadow-none hover:!border-accent-500/25"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v) && v >= 1) props.onMaxResultsChange(v);
              }}
            />
            <Button
              className="!border-ink-950/10 !bg-white/80 !px-4 !text-ink-700 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
              icon={<ClearOutlined />}
              onClick={() => void props.onClearConversation()}
            >
              清空对话
            </Button>
            {props.onOpenAdmin && (
              <Button
                className="!border-ink-950/10 !bg-amber-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
                icon={<SettingOutlined />}
                onClick={() => navigate(props.onOpenAdmin!)}
              >
                管理
              </Button>
            )}
            <Button
              className={`!px-4 !shadow-none max-[720px]:max-w-[140px] ${
                props.authenticated
                  ? "!border-accent-200 !bg-accent-100 !text-accent-500 hover:!border-accent-300 hover:!text-accent-400"
                  : "!border-ink-950/10 !bg-white/80 !text-ink-700 hover:!border-accent-500/25 hover:!text-accent-500"
              }`}
              icon={<UserOutlined />}
              onClick={props.onOpenAuth}
            >
              <span className="truncate">
                {props.authenticated && props.authUser
                  ? `${props.authUser.username} · ${props.authUser.roleCode === "ADMIN" || props.authUser.roleCode === "SUPER_ADMIN" ? "管理" : "成员"}`
                  : "用户登录"}
              </span>
            </Button>
          </div>

        <div ref={messagesContainerRef} className="custom-scrollbar flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-0.5">
          {props.messages.map((entry) => (
            <MessageBubble key={entry.id} message={entry} />
          ))}
        </div>

        <div>
          {previewUrl && pendingImage && (
            <div className="mb-2 flex items-center gap-2 bg-ink-50 px-3 py-2">
              <img src={previewUrl} alt="preview" className="h-12 w-12 object-cover" />
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
                  ? "!px-6 !shadow-none"
                  : "!border-none !bg-accent-500 !px-6 !shadow-none hover:!bg-accent-400"
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
