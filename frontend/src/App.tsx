import {
  ClearOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  MessageOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined
} from "@ant-design/icons";
import {
  App as AntdApp,
  Button,
  Collapse,
  Empty,
  Input,
  List,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  type UploadProps
} from "antd";
import { useEffect, useRef, useState } from "react";
import {
  cancelConversation,
  clearConversation,
  deleteDocument,
  getDocumentHealth,
  getRagHealth,
  listDocuments,
  streamRagAnswer,
  uploadDocument
} from "./lib/api";
import type { ChatMessage, DocumentListItem, HealthState, SourceReference } from "./types";

const suggestions = [
  "总结当前知识库里最重要的三条结论",
  "把文档内容整理成一份汇报提纲",
  "列出文档里涉及的关键流程与风险点"
];

const emptySources: SourceReference[] = [];

function createAssistantIntro(): ChatMessage {
  return {
    id: `assistant-${crypto.randomUUID()}`,
    role: "assistant",
    content: "上传 PDF 或 TXT 后就可以直接提问。我会流式返回答案，并给出命中的来源片段。",
    createdAt: new Date().toISOString(),
    status: "complete",
    sources: emptySources
  };
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function HealthBadge(props: { label: string; state: HealthState }) {
  const colorMap: Record<HealthState, string> = {
    checking: "default",
    ok: "success",
    error: "error"
  };

  const textMap: Record<HealthState, string> = {
    checking: "检查中",
    ok: "可用",
    error: "异常"
  };

  return (
    <Tag color={colorMap[props.state]} bordered={false} className="health-tag">
      {props.label} · {textMap[props.state]}
    </Tag>
  );
}

function MessageBubble(props: { message: ChatMessage }) {
  const { message } = props;
  const isAssistant = message.role === "assistant";

  return (
    <article className={`message-row ${isAssistant ? "assistant" : "user"}`}>
      <div className={`message-bubble ${isAssistant ? "assistant" : "user"}`}>
        <div className="message-meta">
          <span>{isAssistant ? "Knowledge Copilot" : "You"}</span>
          <span>{formatTime(message.createdAt)}</span>
        </div>
        <div className="message-content">
          {message.content || (message.status === "streaming" ? "正在思考..." : "暂无内容")}
          {message.status === "streaming" ? <span className="typing-cursor" /> : null}
        </div>
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
    </article>
  );
}

function App() {
  const { message } = AntdApp.useApp();
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ragHealth, setRagHealth] = useState<HealthState>("checking");
  const [documentHealth, setDocumentHealth] = useState<HealthState>("checking");
  const [messages, setMessages] = useState<ChatMessage[]>([createAssistantIntro()]);
  const [prompt, setPrompt] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [maxResults, setMaxResults] = useState(5);
  const [streaming, setStreaming] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void refreshDocuments();
    void refreshHealth();
  }, []);

  async function refreshDocuments() {
    setDocumentsLoading(true);

    try {
      const response = await listDocuments();
      setDocuments(response.documents);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载文档失败");
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function refreshHealth() {
    setRefreshingHealth(true);
    setRagHealth("checking");
    setDocumentHealth("checking");

    try {
      await Promise.all([
        getRagHealth().then(() => setRagHealth("ok")).catch(() => setRagHealth("error")),
        getDocumentHealth()
          .then(() => setDocumentHealth("ok"))
          .catch(() => setDocumentHealth("error"))
      ]);
    } finally {
      setRefreshingHealth(false);
    }
  }

  function updateMessage(
    targetId: string,
    updater: (message: ChatMessage) => ChatMessage
  ) {
    setMessages((current) =>
      current.map((item) => (item.id === targetId ? updater(item) : item))
    );
  }

  async function handleUpload(file: File) {
    setUploading(true);

    try {
      const response = await uploadDocument(file);
      message.success(`${response.filename || file.name} 已入库，切分 ${response.segmentCount} 段`);
      await refreshDocuments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setDeletingId(documentId);

    try {
      const response = await deleteDocument(documentId);
      message.success(`${response.message}，删除 ${response.deletedSegments} 段`);
      await refreshDocuments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSend(nextQuestion?: string) {
    const question = (nextQuestion ?? prompt).trim();

    if (!question || streaming) {
      return;
    }

    const nextConversationId = conversationId || `web-${crypto.randomUUID()}`;
    const assistantId = `assistant-${crypto.randomUUID()}`;

    setConversationId(nextConversationId);
    setPrompt("");
    setStreaming(true);
    setMessages((current) => [
      ...current,
      {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
        status: "complete",
        sources: emptySources
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        status: "streaming",
        sources: emptySources
      }
    ]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamRagAnswer(
        {
          question,
          conversationId: nextConversationId,
          maxResults
        },
        {
          onStart(payload) {
            if (payload.conversationId) {
              setConversationId(payload.conversationId);
            }
          },
          onSources(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              sources: payload
            }));
          },
          onDelta(payload) {
            updateMessage(assistantId, (item) => ({
              ...item,
              content: item.content + payload
            }));
          },
          onComplete(payload) {
            if (payload.conversationId) {
              setConversationId(payload.conversationId);
            }

            updateMessage(assistantId, (item) => ({
              ...item,
              status: payload.cancelled ? "cancelled" : "complete"
            }));
          },
          onCancelled(payload) {
            if (payload.conversationId) {
              setConversationId(payload.conversationId);
            }

            updateMessage(assistantId, (item) => ({
              ...item,
              status: "cancelled",
              content: item.content || payload.reason || "本次回答已取消。"
            }));
          },
          onError(errorText) {
            updateMessage(assistantId, (item) => ({
              ...item,
              status: "error",
              content: item.content || errorText
            }));
          }
        },
        controller.signal
      );

      updateMessage(assistantId, (item) => ({
        ...item,
        status:
          item.status === "streaming"
            ? "complete"
            : item.status
      }));
    } catch (error) {
      if (controller.signal.aborted) {
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "cancelled",
          content: item.content || "本次回答已取消。"
        }));
      } else {
        const errorText = error instanceof Error ? error.message : "生成失败";
        updateMessage(assistantId, (item) => ({
          ...item,
          status: "error",
          content: item.content || errorText
        }));
        message.error(errorText);
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
    }
  }

  async function handleCancel() {
    if (!conversationId) {
      abortControllerRef.current?.abort();
      return;
    }

    abortControllerRef.current?.abort();

    try {
      await cancelConversation(conversationId);
      message.info("已发送取消指令");
    } catch (error) {
      message.warning(error instanceof Error ? error.message : "取消请求未完成");
    }
  }

  async function handleClearConversation() {
    abortControllerRef.current?.abort();

    try {
      if (conversationId) {
        await clearConversation(conversationId);
      }

      setConversationId(null);
      setMessages([createAssistantIntro()]);
      message.success("会话上下文已清空");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "清空会话失败");
    } finally {
      setStreaming(false);
    }
  }

  const uploadProps: UploadProps = {
    accept: ".pdf,.txt",
    multiple: false,
    showUploadList: false,
    beforeUpload(file) {
      void handleUpload(file);
      return false;
    }
  };

  return (
    <main className="app-shell">
      <section className="orb orb-left" />
      <section className="orb orb-right" />

      <div className="app-grid">
        <aside className="surface panel-side">
          <div className="panel-header">
            <div>
              <Tag color="orange" bordered={false}>
                Knowledge Base
              </Tag>
              <Typography.Title level={3} className="panel-title">
                文档控制台
              </Typography.Title>
              <Typography.Paragraph className="panel-copy">
                把 PDF 和 TXT 推进知识库，再用右侧对话流直接验证检索与生成效果。
              </Typography.Paragraph>
            </div>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                void refreshDocuments();
                void refreshHealth();
              }}
              loading={documentsLoading || refreshingHealth}
            >
              刷新
            </Button>
          </div>

          <div className="status-row">
            <HealthBadge label="RAG" state={ragHealth} />
            <HealthBadge label="文档" state={documentHealth} />
            <Tag icon={<DatabaseOutlined />} bordered={false} className="health-tag">
              {documents.length} 份文档
            </Tag>
          </div>

          <div className="upload-panel">
            <div className="upload-copy">
              <CloudUploadOutlined />
              <span>支持 PDF / TXT，上传后自动切分并向量化</span>
            </div>
            <Upload {...uploadProps}>
              <Button type="primary" icon={uploading ? <LoadingOutlined /> : <CloudUploadOutlined />} loading={uploading} block>
                上传知识文档
              </Button>
            </Upload>
          </div>

          <div className="documents-section">
            <div className="section-heading">
              <span>已入库文档</span>
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void refreshDocuments()}>
                重载
              </Button>
            </div>

            {documentsLoading ? (
              <div className="empty-state">
                <Spin />
              </div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <Empty
                  description="还没有文档，先上传一份试试"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            ) : (
              <List
                dataSource={documents}
                className="documents-list"
                renderItem={(item) => (
                  <List.Item
                    key={item.documentId}
                    actions={[
                      <Button
                        key="delete"
                        danger
                        type="text"
                        icon={<DeleteOutlined />}
                        loading={deletingId === item.documentId}
                        onClick={() => void handleDeleteDocument(item.documentId)}
                      >
                        删除
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={item.filename}
                      description={`文档 ID: ${item.documentId}`}
                    />
                    <Tag bordered={false}>{item.segmentCount} 段</Tag>
                  </List.Item>
                )}
              />
            )}
          </div>
        </aside>

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
                value={maxResults}
                className="results-select"
                options={[
                  { label: "Top 3", value: 3 },
                  { label: "Top 5", value: 5 },
                  { label: "Top 8", value: 8 }
                ]}
                onChange={setMaxResults}
              />

              <Button icon={<ClearOutlined />} onClick={() => void handleClearConversation()}>
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
                onClick={() => void handleSend(item)}
                disabled={streaming}
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
                <code>{conversationId || "待创建"}</code>
              </div>
            </div>

            <div className="messages-stack">
              {messages.map((entry) => (
                <MessageBubble key={entry.id} message={entry} />
              ))}
            </div>

            <div className="composer-panel">
              <Input.TextArea
                value={prompt}
                rows={4}

                placeholder="输入你的问题，例如：请提炼这批制度文档的办理流程和责任边界。"
                onChange={(event) => setPrompt(event.target.value)}
                onPressEnter={(event) => {
                  if (!event.shiftKey && !streaming) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />

              <div className="composer-footer">
                <div className="composer-hint">
                  Shift + Enter 换行，Enter 发送；生成中可继续编辑输入框
                </div>
                <Button
                  type={streaming ? "default" : "primary"}
                  danger={streaming}
                  size="large"
                  icon={streaming ? <StopOutlined /> : <SendOutlined />}
                  disabled={!streaming && !prompt.trim()}
                  onClick={() => {
                    if (streaming) {
                      void handleCancel();
                      return;
                    }

                    void handleSend();
                  }}
                >
                  {streaming ? "取消生成" : "发送问题"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
