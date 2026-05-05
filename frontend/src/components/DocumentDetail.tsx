import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileTextOutlined,
  LoadingOutlined,
  TagOutlined
} from "@ant-design/icons";
import { Button, Spin } from "antd";
import type { PublicDocumentDetailResponse } from "../types";

interface DocumentDetailProps {
  detail: PublicDocumentDetailResponse | null;
  loading: boolean;
  onClose: () => void;
  onDownload: (documentId: string, filename: string) => void;
}

export function DocumentDetail(props: DocumentDetailProps) {
  if (props.loading) {
    return (
      <div className="grid h-full min-h-[300px] place-items-center">
        <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} />} />
      </div>
    );
  }

  if (!props.detail) {
    return null;
  }

  const { detail } = props;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
            文档详情
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-950 truncate">
            {detail.title || detail.filename}
          </h2>
        </div>
        <Button
          type="text"
          shape="circle"
          className="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          icon={<ArrowLeftOutlined />}
          onClick={props.onClose}
          title="返回文档列表"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
          <FileTextOutlined />
          {detail.filename}
        </span>
        {detail.category && (
          <span className="inline-flex items-center gap-1.5 bg-accent-100 px-3 py-1 text-xs font-medium text-accent-500">
            {detail.category}
          </span>
        )}
        <span className="inline-flex bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-700">
          {detail.segmentCount} 段
        </span>
        {detail.documentTime && (
          <span className="inline-flex bg-ink-950/6 px-3 py-1 text-xs font-medium text-ink-500">
            {detail.documentTime}
          </span>
        )}
        <Button
          type="text"
          size="small"
          className="!text-ink-600 hover:!text-accent-500"
          icon={<DownloadOutlined />}
          onClick={() => props.onDownload(detail.documentId, detail.filename)}
        >
          下载原文件
        </Button>
      </div>

      {detail.keywords && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <TagOutlined className="text-xs text-ink-500" />
          {detail.keywords.split(",").map((kw, i) => (
            <span
              key={i}
              className="bg-sky-100 px-2 py-0.5 text-xs text-sky-700"
            >
              {kw.trim()}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex-1 min-h-0 overflow-auto border-t border-ink-950/8 pt-4">
        <div className="flex flex-col gap-3">
          {detail.segments.map((segment) => (
            <div
              key={segment.chunkIndex}
              className="min-w-0 border border-ink-300 bg-white px-4 py-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex bg-ink-950/6 px-2 py-0.5 text-[10px] font-medium text-ink-500">
                  #{segment.chunkIndex}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-ink-900 whitespace-pre-wrap break-words">
                {segment.text}
              </p>
            </div>
          ))}
          {detail.segments.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-500">
              暂无段落内容（文档需重新上传以启用文本存储）
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
