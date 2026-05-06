import {
  ClearOutlined,
  DatabaseOutlined,
  FilterOutlined,
  PictureOutlined,
  SendOutlined,
  PauseCircleFilled,
  SettingOutlined,
  UserOutlined
} from "@ant-design/icons";
import { Button, Input, InputNumber, Popover, Space, Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../types";

interface ChatWorkspaceProps {
  messages: ChatMessage[];
  prompt: string;
  maxResults: number;
  minScore: number;
  streaming: boolean;
  authenticated: boolean;
  authUser: { username: string; role: string; roleCode: string } | null;
  onOpenDocuments: string;
  onOpenAuth: () => void;
  onOpenAdmin?: string;
  onPromptChange: (value: string) => void;
  onMaxResultsChange: (value: number) => void;
  onMinScoreChange: (value: number) => void;
  onSend: (question?: string) => Promise<void>;
  onSendWithImage?: (image: File, question: string, previewUrl: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onClearConversation: () => Promise<void>;
}

export function ChatWorkspace(props: ChatWorkspaceProps) {
  const navigate = useNavigate();
  const [consoleOpen, setConsoleOpen] = useState(false);
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

  const parameterConsole = (
    <div className="w-[260px]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <Typography.Text className="!text-sm !font-medium !text-ink-900">
            检索参数
          </Typography.Text>
          <Typography.Paragraph className="!mb-0 !mt-1 !text-xs !text-ink-500">
            控制召回片段数量与最低匹配分数。
          </Typography.Paragraph>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Typography.Text className="!text-sm !text-ink-800">最大片段数</Typography.Text>
            <Typography.Paragraph className="!mb-0 !mt-0.5 !text-xs !text-ink-500">
              默认 4
            </Typography.Paragraph>
          </div>
          <InputNumber
            min={1}
            max={20}
            precision={0}
            value={props.maxResults}
            className="!w-24"
            controls
            onChange={(value) => {
              if (typeof value === "number" && Number.isFinite(value) && value >= 1) {
                props.onMaxResultsChange(value);
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <Typography.Text className="!text-sm !text-ink-800">最低分数</Typography.Text>
            <Typography.Paragraph className="!mb-0 !mt-0.5 !text-xs !text-ink-500">
              默认 0.5
            </Typography.Paragraph>
          </div>
          <InputNumber
            min={0}
            max={1}
            step={0.1}
            precision={1}
            value={props.minScore}
            className="!w-24"
            controls
            onChange={(value) => {
              if (typeof value === "number" && Number.isFinite(value)) {
                props.onMinScoreChange(value);
              }
            }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              className="!border-ink-950/10 !bg-sky-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
              icon={<DatabaseOutlined />}
              onClick={() => navigate(props.onOpenDocuments)}
            >
              文档控制台
            </Button>
            <Popover
              trigger="click"
              placement="bottomRight"
              open={consoleOpen}
              onOpenChange={setConsoleOpen}
              content={parameterConsole}
            >
              <Button
                className="!border-ink-950/10 !bg-white/80 !px-3 !text-ink-700 !shadow-none hover:!border-accent-500/25 hover:!text-accent-500"
                icon={<FilterOutlined />}
              >
                <Space size={6}>
                  <span>参数</span>
                  <span className="text-xs text-ink-500">
                    {props.maxResults} / {props.minScore.toFixed(1)}
                  </span>
                </Space>
              </Button>
            </Popover>
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
