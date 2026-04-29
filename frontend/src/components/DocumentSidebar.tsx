import {
  CheckCircleOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Modal,
  Progress,
  Space,
  Spin,
  Upload,
  type UploadProps
} from "antd";
import { useRef } from "react";
import type { DocumentListItem, FileUploadEntry } from "../types";

interface DocumentSidebarProps {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  fileUploads: FileUploadEntry[];
  deletingId: string | null;
  authenticated: boolean;
  onClose: () => void;
  onRefreshDocuments: () => Promise<void>;
  onUpload: (fileOrFiles: File | File[]) => Promise<void>;
  onCancelUpload: () => void;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onViewDocument: (documentId: string) => void;
  onShowDownloadLink: (documentId: string, filename: string) => void;
}

const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".docx", ".xlsx", ".pptx"];

function isAllowedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  const fileQueue = useRef<File[]>([]);
  const batchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleBeforeUpload(file: File) {
    if (!isAllowedFile(file.name)) return false;
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
    accept: ".pdf,.txt,.docx,.xlsx,.pptx,.jpg,.jpeg,.png",
    multiple: true,
    showUploadList: false,
    beforeUpload: handleBeforeUpload,
  };

  const folderUploadProps: UploadProps = {
    directory: true,
    showUploadList: false,
    beforeUpload: handleBeforeUpload,
  };

  const batchLabel = props.fileUploads.length > 1
    ? `上传中 (${props.fileUploads.filter(f => f.status === "complete").length}/${props.fileUploads.length})...`
    : "上传中...";

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
            文档集合
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-950">
            浏览和下载知识库文档
          </h2>
        </div>
        <Button
          type="text"
          shape="circle"
          className="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          icon={<CloseOutlined />}
          onClick={props.onClose}
          title="关闭文档集合"
        />
      </div>

      {props.authenticated && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Upload {...uploadProps}>
            <Button
              type="primary"
              icon={props.uploading ? <LoadingOutlined /> : <CloudUploadOutlined />}
              loading={props.uploading}
              disabled={props.uploading}
            >
              {props.uploading ? batchLabel : "上传文档"}
            </Button>
          </Upload>
          <Upload {...folderUploadProps}>
            <Button
              icon={props.uploading ? <LoadingOutlined /> : <FolderOpenOutlined />}
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
        </div>
      )}

      {props.uploading && props.fileUploads.length > 0 && (
        <div className="mt-4 rounded-[16px] bg-white/[0.72] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink-900">
              {props.fileUploads.length > 1 && (
                <span className="text-ink-500 mr-2">
                  ({props.fileUploads.filter(f => f.status === "complete").length}/{props.fileUploads.length})
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
                  {entry.status === "uploading" && <LoadingOutlined className="text-blue-500" />}
                  {entry.status === "complete" && <CheckCircleOutlined className="text-green-500" />}
                  {entry.status === "error" && <CloseCircleOutlined className="text-red-500" />}
                  <span className="truncate text-ink-900" title={entry.filename}>
                    {entry.filename}
                  </span>
                  {entry.status === "error" && entry.errorMessage && (
                    <span className="text-red-500">({entry.errorMessage})</span>
                  )}
                </div>
                <Progress
                  percent={entry.status === "complete" ? 100 : (entry.progress?.percent ?? 0)}
                  status={entry.status === "error" ? "exception" : entry.status === "complete" ? "success" : "active"}
                  strokeColor={{ from: "#108ee9", to: "#87d068" }}
                  size="small"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex min-h-0 flex-1 flex-col border-t border-ink-950/8 pt-[18px]">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm font-bold text-ink-900">
          <span>已入库文档</span>
          <Button
            type="text"
            size="small"
            className="!px-0 !text-ink-500 hover:!text-accent-500"
            icon={<ReloadOutlined />}
            onClick={() => void props.onRefreshDocuments()}
          >
            重载
          </Button>
        </div>

        {props.documentsLoading ? (
          <div className="grid min-h-[180px] place-items-center">
            <Spin />
          </div>
        ) : props.documents.length === 0 ? (
          <div className="grid min-h-[180px] place-items-center">
            <Empty
              description={props.authenticated ? "还没有文档，先上传一份试试" : "暂无文档"}
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
                <div className="flex shrink-0 items-center gap-3">
                  <span className="inline-flex rounded-full bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
                    {item.segmentCount} 段
                  </span>
                  <Button
                    type="text"
                    className="!px-0 !text-blue-500 hover:!text-blue-600"
                    icon={<EyeOutlined />}
                    onClick={() => props.onViewDocument(item.documentId)}
                  >
                    查看
                  </Button>
                  <Button
                    type="text"
                    className="!px-0 !text-green-500 hover:!text-green-600"
                    icon={<DownloadOutlined />}
                    onClick={() => props.onShowDownloadLink(item.documentId, item.filename)}
                  >
                    下载
                  </Button>
                  {props.authenticated && (
                    <Button
                      type="text"
                      className="!px-0 !text-rose-500 hover:!text-rose-600"
                      icon={<DeleteOutlined />}
                      loading={props.deletingId === item.documentId}
                      onClick={() => void props.onDeleteDocument(item.documentId)}
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
