import {
  CloudUploadOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  LoadingOutlined,
  MenuFoldOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Spin,
  Upload,
  type UploadProps
} from "antd";
import type { DocumentListItem, HealthState } from "../types";
import { HealthBadge } from "./HealthBadge";

interface DocumentSidebarProps {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  deletingId: string | null;
  ragHealth: HealthState;
  documentHealth: HealthState;
  refreshingHealth: boolean;
  onToggleCollapse: () => void;
  onRefreshDocuments: () => Promise<void>;
  onRefreshHealth: () => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export function DocumentSidebar(props: DocumentSidebarProps) {
  const uploadProps: UploadProps = {
    accept: ".pdf,.txt",
    multiple: false,
    showUploadList: false,
    beforeUpload(file) {
      void props.onUpload(file);
      return false;
    }
  };

  const refreshing = props.documentsLoading || props.refreshingHealth;

  function refreshAll() {
    void props.onRefreshDocuments();
    void props.onRefreshHealth();
  }

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[32px] border border-ink-950/10 bg-white/[0.74] p-6 shadow-panel backdrop-blur-[18px] max-[1120px]:h-auto max-[720px]:rounded-3xl max-[720px]:p-[18px]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          icon={<ReloadOutlined />}
          onClick={refreshAll}
          loading={refreshing}
        >
          刷新
        </Button>
        <Upload {...uploadProps}>
          <Button
            type="primary"
            icon={props.uploading ? <LoadingOutlined /> : <CloudUploadOutlined />}
            loading={props.uploading}
          >
            上传文档
          </Button>
        </Upload>
        <Button
          type="text"
          shape="circle"
          className="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          icon={<MenuFoldOutlined />}
          onClick={props.onToggleCollapse}
          title="收起文档侧边栏"
        />
      </div>

      <div className="my-[18px] flex flex-wrap items-center gap-3">
        <HealthBadge label="RAG" state={props.ragHealth} />
        <HealthBadge label="文档" state={props.documentHealth} />
        <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.72] px-3 py-1 text-sm font-medium text-ink-700 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
          <DatabaseOutlined />
          {props.documents.length} 份文档
        </span>
      </div>

      <div className="mt-[18px] flex min-h-0 flex-1 flex-col border-t border-ink-950/8 pt-[18px]">
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
              description="还没有文档，先上传一份试试"
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
                    className="!px-0 !text-rose-500 hover:!text-rose-600"
                    icon={<DeleteOutlined />}
                    loading={props.deletingId === item.documentId}
                    onClick={() => void props.onDeleteDocument(item.documentId)}
                  >
                    删除
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
