import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Empty,
  Popconfirm,
  Progress,
  Space,
  Spin,
  Tag,
  Upload,
  type UploadProps,
} from "antd";
import { useRef, type ReactNode } from "react";
import type { DocumentListItem, FileUploadEntry } from "../types";
import type { BatchReindexStatus } from "../lib/api";

interface DocumentSidebarProps {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  fileUploads: FileUploadEntry[];
  deletingId: string | null;
  reindexingId: string | null;
  authenticated: boolean;
  canManageDocuments: boolean;
  batchReindexing: boolean;
  batchReindexProgress: BatchReindexStatus | null;
  onBack?: () => void;
  onClose?: () => void;
  onRefreshDocuments: () => Promise<void>;
  onUpload: (fileOrFiles: File | File[]) => Promise<void>;
  onCancelUpload: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onReindexDocument: (documentId: string) => Promise<void>;
  onBatchReindex: () => Promise<void>;
  onViewDocument: (documentId: string) => void;
  onShowDownloadLink: (documentId: string, filename: string) => void;
  headerActions?: ReactNode;
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  const fileQueue = useRef<File[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleBeforeUpload(file: File) {
    fileQueue.current.push(file);
    if (batchTimer.current != null) clearTimeout(batchTimer.current);
    batchTimer.current = setTimeout(() => {
      const files = fileQueue.current;
      fileQueue.current = [];
      void props.onUpload(files);
    }, 0);
    return false;
  }

  const uploadProps: UploadProps = {
    multiple: true,
    showUploadList: false,
    beforeUpload: handleBeforeUpload,
    accept: ".pdf,.txt,.docx,.doc,.md,.xlsx,.xls",
  };

  const folderUploadProps: UploadProps = {
    directory: true,
    showUploadList: false,
    beforeUpload: handleBeforeUpload,
  };

  const batchLabel =
    props.fileUploads.length > 1
      ? `上传中 (${props.fileUploads.filter((f) => f.status === "complete").length}/${props.fileUploads.length})...`
      : "上传中...";

  const handleReturn = props.onBack ?? props.onClose ?? (() => undefined);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="text"
            shape="circle"
            className="!mt-0.5 !text-ink-500 transition-colors hover:!bg-white/80 hover:!text-ink-950"
            icon={<ArrowLeftOutlined />}
            onClick={handleReturn}
            title="返回对话"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
              文档控制台
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink-950">
              浏览、上传和维护知识库文档
            </h2>
          </div>
        </div>
        {props.headerActions ? (
          <div className="flex items-center gap-2">{props.headerActions}</div>
        ) : null}
      </div>

      {props.authenticated && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Upload {...uploadProps}>
              <Button
                type="primary"
                icon={
                  props.uploading ? (
                    <LoadingOutlined />
                  ) : (
                    <CloudUploadOutlined />
                  )
                }
                loading={props.uploading}
                disabled={props.uploading}
              >
                {props.uploading ? batchLabel : "上传文档"}
              </Button>
            </Upload>
            <Upload {...folderUploadProps}>
              <Button
                icon={
                  props.uploading ? <LoadingOutlined /> : <FolderOpenOutlined />
                }
                loading={props.uploading}
                disabled={props.uploading}
              >
                {props.uploading ? batchLabel : "上传文件夹"}
              </Button>
            </Upload>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void props.onRefreshDocuments()}
              loading={props.documentsLoading}
              disabled={props.uploading}
            >
              刷新
            </Button>
            {props.canManageDocuments && (
              <Popconfirm
                title="一键重建全部"
                description="将基于原始文件重新切分所有文档并重建向量索引，可能需要较长时间。"
                okText="开始重建"
                cancelText="取消"
                onConfirm={() => void props.onBatchReindex()}
              >
                <Button
                  icon={<ReloadOutlined />}
                  loading={props.batchReindexing}
                  disabled={props.uploading || props.batchReindexing}
                  className="!border-amber-300 !text-amber-700 hover:!border-amber-400 hover:!text-amber-800"
                >
                  {props.batchReindexing ? "重建中..." : "一键重建全部"}
                </Button>
              </Popconfirm>
            )}
          </div>
          <Alert
            type="info"
            showIcon
            className="!border-sky-200 !bg-sky-50"
            message="支持 PDF、TXT、DOCX、DOC、XLSX、XLS、MD"
            description="Word 文档建议优先上传 DOCX；Excel 表格会直接提取所有工作表的文本内容；扫描版 PDF 会自动尝试 OCR 识别。"
          />
        </div>
      )}

      {props.uploading && props.fileUploads.length > 0 && (
        <div className="mt-4 border border-ink-300 bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink-900">
              {props.fileUploads.length > 1 && (
                <span className="text-ink-500 mr-2">
                  (
                  {
                    props.fileUploads.filter((f) => f.status === "complete")
                      .length
                  }
                  /{props.fileUploads.length})
                </span>
              )}
              上传进度
            </span>
            <Button
              type="text"
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={props.onCancelUpload}
              title="取消上传"
            >
              取消
            </Button>
          </div>
          <div className="mt-2 max-h-[260px] space-y-2 overflow-y-auto">
            {props.fileUploads.map((entry, i) => (
              <div key={`${entry.filename}-${i}`}>
                <div className="flex items-center gap-1.5 text-xs">
                  {entry.status === "uploading" && (
                    <LoadingOutlined className="text-accent-500" />
                  )}
                  {entry.status === "complete" && (
                    <CheckCircleOutlined className="text-emerald-600" />
                  )}
                  {entry.status === "error" && (
                    <CloseCircleOutlined className="text-rose-600" />
                  )}
                  <span
                    className="truncate text-ink-900"
                    title={entry.filename}
                  >
                    {entry.filename}
                  </span>
                  {entry.status === "error" && entry.errorMessage && (
                    <span className="text-rose-600">
                      ({entry.errorMessage})
                    </span>
                  )}
                </div>
                <Progress
                  percent={
                    entry.status === "complete"
                      ? 100
                      : (entry.progress?.percent ?? 0)
                  }
                  status={
                    entry.status === "error"
                      ? "exception"
                      : entry.status === "complete"
                        ? "success"
                        : "active"
                  }
                  strokeColor={{ from: "#f25b2a", to: "#ff894f" }}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {props.batchReindexing && props.batchReindexProgress && (
        <div className="mt-4 border border-amber-300 bg-amber-50/60 px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-amber-800">
              批量重建进度
            </span>
            <Button
              type="text"
              size="small"
              className="!text-ink-500 hover:!text-ink-700"
              onClick={() => void props.onRefreshDocuments()}
              disabled={
                props.batchReindexProgress.status !== "COMPLETED" &&
                props.batchReindexProgress.status !== "FAILED"
              }
            >
              完成后刷新列表
            </Button>
          </div>
          <Progress
            percent={
              props.batchReindexProgress.totalDocuments > 0
                ? Math.round(
                    ((props.batchReindexProgress.completedDocuments +
                      props.batchReindexProgress.failedDocuments) /
                      props.batchReindexProgress.totalDocuments) *
                      100,
                  )
                : 0
            }
            status={
              props.batchReindexProgress.status === "FAILED"
                ? "exception"
                : props.batchReindexProgress.status === "COMPLETED"
                  ? "success"
                  : "active"
            }
            strokeColor={
              props.batchReindexProgress.status === "FAILED"
                ? undefined
                : { from: "#f25b2a", to: "#ff894f" }
            }
            size="small"
            className="mt-1"
          />
          <div className="mt-2 text-xs text-ink-600">
            {props.batchReindexProgress.status === "RUNNING" && (
              <span>
                已处理{" "}
                {props.batchReindexProgress.completedDocuments +
                  props.batchReindexProgress.failedDocuments}
                /{props.batchReindexProgress.totalDocuments}
                {props.batchReindexProgress.currentDocument &&
                  ` · 正在重建: ${props.batchReindexProgress.currentDocument}`}
              </span>
            )}
            {props.batchReindexProgress.status === "COMPLETED" && (
              <span className="text-emerald-700">
                重建: {props.batchReindexProgress.totalDocuments} 篇文档， 成功{" "}
                <span className="font-semibold">
                  {props.batchReindexProgress.completedDocuments}
                </span>{" "}
                篇， 失败{" "}
                <span className="font-semibold text-rose-600">
                  {props.batchReindexProgress.failedDocuments}
                </span>{" "}
                篇
              </span>
            )}
            {props.batchReindexProgress.status === "FAILED" && (
              <span className="text-rose-600">批量重建失败</span>
            )}
          </div>
          {props.batchReindexProgress.results.length > 0 && (
            <div className="mt-3 max-h-[260px] space-y-1.5 overflow-y-auto border-t border-amber-200 pt-2">
              {props.batchReindexProgress.results.map((result) => (
                <div
                  key={result.documentId}
                  className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                >
                  {result.status === "SUCCESS" ? (
                    <CheckCircleOutlined className="text-emerald-600 shrink-0" />
                  ) : (
                    <CloseCircleOutlined className="text-rose-600 shrink-0" />
                  )}
                  <span
                    className="truncate flex-1 text-ink-800"
                    title={
                      result.status === "FAILED"
                        ? `${result.filename}: ${result.error ?? "未知错误"}`
                        : result.filename
                    }
                  >
                    {result.filename}
                  </span>
                  {result.status === "SUCCESS" && (
                    <Tag className="!m-0 shrink-0 !border-ink-200 !bg-ink-50 !text-ink-600 !text-[11px] !leading-none">
                      {result.segmentCount} 段
                    </Tag>
                  )}
                  {result.status === "FAILED" && (
                    <Button
                      type="text"
                      size="small"
                      className="!h-auto !px-1.5 !py-0 !text-[11px] !text-accent-500 hover:!text-accent-400 shrink-0"
                      icon={<ReloadOutlined className="!text-[11px]" />}
                      onClick={() =>
                        void props.onReindexDocument(result.documentId)
                      }
                    >
                      重试
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-ink-950/8 pt-[18px]">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-ink-900">
          <span>已入库文档</span>
        </div>

        {props.documentsLoading ? (
          <div className="grid min-h-[180px] place-items-center">
            <Spin />
          </div>
        ) : props.documents.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center">
            <Empty
              description={
                props.authenticated ? "还没有文档，先上传一份试试" : "暂无文档"
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-auto pr-1">
            {props.documents.map((item) => (
              <article
                key={item.documentId}
                className="flex items-start gap-3 border-b border-ink-950/8 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-ink-900">
                    {item.filename}
                  </h3>
                  <p className="mt-1 truncate text-xs text-ink-500">
                    文档 ID: {item.documentId}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 max-[720px]:gap-1">
                  <span className="inline-flex bg-ink-950/6 px-2.5 py-0.5 text-[11px] font-medium text-ink-700">
                    {item.segmentCount} 段
                  </span>
                  <Button
                    type="text"
                    size="small"
                    className="!min-h-[32px] !min-w-[32px] !px-2 !text-ink-600 hover:!text-accent-500"
                    icon={<EyeOutlined />}
                    onClick={() => props.onViewDocument(item.documentId)}
                  >
                    查看
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    className="!min-h-[32px] !min-w-[32px] !px-2 !text-ink-600 hover:!text-accent-500"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      props.onShowDownloadLink(item.documentId, item.filename)
                    }
                  >
                    下载
                  </Button>
                  {props.canManageDocuments && (
                    <Popconfirm
                      title="重建索引"
                      description="将删除当前片段并基于原文件重新切分入库。"
                      okText="重建"
                      cancelText="取消"
                      onConfirm={() =>
                        void props.onReindexDocument(item.documentId)
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        className="!min-h-[32px] !min-w-[32px] !px-2 !text-ink-600 hover:!text-accent-500"
                        icon={<ReloadOutlined />}
                        loading={props.reindexingId === item.documentId}
                      >
                        重建
                      </Button>
                    </Popconfirm>
                  )}
                  {props.authenticated && (
                    <Button
                      type="text"
                      size="small"
                      className="!min-h-[32px] !min-w-[32px] !px-2 !text-accent-500 hover:!text-accent-400"
                      icon={<DeleteOutlined />}
                      loading={props.deletingId === item.documentId}
                      onClick={() =>
                        void props.onDeleteDocument(item.documentId)
                      }
                    >
                      删除
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
