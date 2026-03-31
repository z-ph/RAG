import {
  CloseOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  LoadingOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Spin,
  Upload,
  type UploadProps
} from "antd";
import type { DocumentListItem } from "../types";

interface DocumentSidebarProps {
  documents: DocumentListItem[];
  documentsLoading: boolean;
  uploading: boolean;
  deletingId: string | null;
  authenticated: boolean;
  onClose: () => void;
  onRefreshDocuments: () => Promise<void>;
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

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
            文档控制台
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-950">
            管理知识库文档
          </h2>
        </div>
        <Button
          type="text"
          shape="circle"
          className="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          icon={<CloseOutlined />}
          onClick={props.onClose}
          title="关闭文档控制台"
        />
      </div>

      {props.authenticated && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            icon={<ReloadOutlined />}
            onClick={() => void props.onRefreshDocuments()}
            loading={props.documentsLoading}
          >
            刷新
          </Button>
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
