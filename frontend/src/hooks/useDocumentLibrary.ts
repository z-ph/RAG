import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  adminReindexDocument,
  deleteDocument,
  getBatchReindexStatus,
  getDocumentDownloadLink,
  getPublicDocumentDetail,
  listDocuments,
  listPublicDocuments,
  startBatchReindex,
  uploadDocumentStream,
} from "../lib/api";
import type { BatchReindexStatus } from "../lib/api";
import type {
  DocumentListItem,
  FileUploadEntry,
  PublicDocumentDetailResponse,
} from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

interface DownloadLinkInfo {
  documentId: string;
  filename: string;
  downloadUrl: string;
}

export function useDocumentLibrary(
  messageApi: MessageApi,
  authenticated: boolean,
  onUnauthorized: () => Promise<void> | void,
) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileUploads, setFileUploads] = useState<FileUploadEntry[]>([]);
  const [documentActionState, setDocumentActionState] = useState<{
    deletingId: string | null;
    reindexingId: string | null;
  }>({
    deletingId: null,
    reindexingId: null,
  });
  const [viewingDocument, setViewingDocument] =
    useState<PublicDocumentDetailResponse | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [downloadLinkInfo, setDownloadLinkInfo] =
    useState<DownloadLinkInfo | null>(null);
  const [batchReindexTaskId, setBatchReindexTaskId] = useState<string | null>(
    null,
  );
  const [batchReindexProgress, setBatchReindexProgress] =
    useState<BatchReindexStatus | null>(null);
  const [batchReindexing, setBatchReindexing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const batchReindexPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const { deletingId, reindexingId } = documentActionState;

  useEffect(() => {
    void refreshDocuments();
  }, [authenticated]);

  async function refreshDocuments() {
    setDocumentsLoading(true);

    try {
      if (authenticated) {
        const response = await listDocuments();
        setDocuments(response.documents);
      } else {
        const response = await listPublicDocuments();
        setDocuments(response.documents);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "加载文档失败");
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function handleUpload(fileOrFiles: File | File[]) {
    if (!authenticated) {
      return;
    }

    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (files.length === 0) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const initialEntries: FileUploadEntry[] = files.map((f) => ({
      filename: f.name,
      status: "uploading" as const,
      progress: null,
    }));

    setUploading(true);
    setFileUploads(initialEntries);

    let successCount = 0;
    const signal = abortControllerRef.current.signal;

    await Promise.allSettled(
      files.map((file, index) =>
        uploadDocumentStream(
          file,
          {
            onProgress: (event) => {
              setFileUploads((prev) =>
                prev.map((entry, i) =>
                  i === index ? { ...entry, progress: event } : entry,
                ),
              );
            },
            onComplete: (event) => {
              successCount++;
              setFileUploads((prev) =>
                prev.map((entry, i) =>
                  i === index
                    ? { ...entry, status: "complete" as const }
                    : entry,
                ),
              );
              messageApi.success(
                `${event.filename || file.name} 已入库，切分 ${event.segmentCount} 段`,
              );
            },
            onError: (errorMessage) => {
              setFileUploads((prev) =>
                prev.map((entry, i) =>
                  i === index
                    ? { ...entry, status: "error" as const, errorMessage }
                    : entry,
                ),
              );
              messageApi.error(`${file.name}: ${errorMessage}`);
            },
          },
          signal,
        ).catch((error) => {
          if (error instanceof ApiError && error.status === 401) {
            setDocuments([]);
            void onUnauthorized();
            abortControllerRef.current?.abort();
          } else if (error instanceof Error && error.name !== "AbortError") {
            setFileUploads((prev) =>
              prev.map((entry, i) =>
                i === index
                  ? {
                      ...entry,
                      status: "error" as const,
                      errorMessage: "上传失败",
                    }
                  : entry,
              ),
            );
            messageApi.error(`${file.name}: 上传失败`);
          }
        }),
      ),
    );

    setUploading(false);
    setFileUploads([]);
    if (successCount > 0) {
      void refreshDocuments();
    }
  }

  function cancelUpload() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setUploading(false);
    setFileUploads([]);
  }

  async function handleDeleteDocument(documentId: string) {
    if (!authenticated) {
      return;
    }

    setDocumentActionState((current) => ({
      ...current,
      deletingId: documentId,
    }));

    try {
      const response = await deleteDocument(documentId);
      messageApi.success(
        `${response.message}，删除 ${response.deletedSegments} 段`,
      );
      await refreshDocuments();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDocumentActionState((current) => ({
        ...current,
        deletingId: null,
      }));
    }
  }

  async function handleReindexDocument(documentId: string) {
    if (!authenticated) {
      return;
    }

    setDocumentActionState((current) => ({
      ...current,
      reindexingId: documentId,
    }));

    try {
      const response = await adminReindexDocument(documentId);
      messageApi.success(
        `${response.message}，删除 ${response.deletedSegments} 段，新增 ${response.newSegments} 段`,
      );
      await refreshDocuments();
      if (viewingDocument?.documentId === documentId) {
        const detail = await getPublicDocumentDetail(documentId);
        setViewingDocument(detail);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "重建索引失败");
    } finally {
      setDocumentActionState((current) => ({
        ...current,
        reindexingId: null,
      }));
    }
  }

  function cancelBatchReindex() {
    if (batchReindexPollRef.current != null) {
      clearInterval(batchReindexPollRef.current);
      batchReindexPollRef.current = null;
    }
    setBatchReindexTaskId(null);
    setBatchReindexProgress(null);
    setBatchReindexing(false);
  }

  async function handleBatchReindex() {
    if (!authenticated) {
      return;
    }

    cancelBatchReindex();

    try {
      setBatchReindexing(true);
      const response = await startBatchReindex();
      setBatchReindexTaskId(response.taskId);
    } catch (error) {
      setBatchReindexing(false);
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }
      messageApi.error(
        error instanceof Error ? error.message : "启动批量重建失败",
      );
    }
  }

  useEffect(() => {
    if (!batchReindexTaskId || !batchReindexing) return;

    const poll = async () => {
      try {
        const status = await getBatchReindexStatus(batchReindexTaskId);
        setBatchReindexProgress(status);

        if (status.status === "COMPLETED" || status.status === "FAILED") {
          cancelBatchReindex();
          if (status.status === "COMPLETED") {
            messageApi.success(
              `批量重建: ${status.totalDocuments} 篇文档，成功 ${status.completedDocuments} 篇，失败 ${status.failedDocuments} 篇`,
            );
          } else {
            messageApi.error("批量重建失败");
          }
          void refreshDocuments();
        }
      } catch (error) {
        cancelBatchReindex();
        messageApi.error(
          error instanceof Error ? error.message : "查询重建进度失败",
        );
      }
    };

    batchReindexPollRef.current = setInterval(poll, 3000);
    void poll(); // immediate first poll

    return () => {
      if (batchReindexPollRef.current != null) {
        clearInterval(batchReindexPollRef.current);
        batchReindexPollRef.current = null;
      }
    };
  }, [batchReindexTaskId, batchReindexing]);

  async function handleViewDocument(documentId: string) {
    setViewingDocument(null);
    setViewingLoading(true);
    try {
      const detail = await getPublicDocumentDetail(documentId);
      setViewingDocument(detail);
    } catch (error) {
      setViewingDocument(null);
      messageApi.error(
        error instanceof Error ? error.message : "获取文档详情失败",
      );
    } finally {
      setViewingLoading(false);
    }
  }

  function handleCloseDocumentDetail() {
    setViewingDocument(null);
  }

  async function handleShowDownloadLink(documentId: string, filename: string) {
    try {
      const response = await getDocumentDownloadLink(documentId);
      const downloadUrl =
        import.meta.env.VITE_BACKEND_URL + response.downloadUrl;
      setDownloadLinkInfo({
        documentId,
        filename: response.filename || filename,
        downloadUrl,
      });
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "获取下载链接失败",
      );
    }
  }

  function handleCloseDownloadLink() {
    setDownloadLinkInfo(null);
  }

  return {
    documents,
    documentsLoading,
    uploading,
    fileUploads,
    deletingId,
    reindexingId,
    batchReindexTaskId,
    batchReindexProgress,
    batchReindexing,
    refreshDocuments,
    handleUpload,
    cancelUpload,
    handleDeleteDocument,
    handleReindexDocument,
    handleBatchReindex,
    cancelBatchReindex,
    handleViewDocument,
    handleShowDownloadLink,
    handleCloseDownloadLink,
    downloadLinkInfo,
    viewingDocument,
    viewingLoading,
    handleCloseDocumentDetail,
  };
}

export type DocumentLibraryState = ReturnType<typeof useDocumentLibrary>;
