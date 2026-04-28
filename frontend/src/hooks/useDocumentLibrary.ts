import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, ApiError, deleteDocument, getDocumentDownloadLink, getPublicDocumentDetail, listDocuments, listPublicDocuments, uploadDocumentStream } from "../lib/api";
import type { DocumentListItem, PublicDocumentDetailResponse, UploadProgressEvent } from "../types";

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
  onUnauthorized: () => Promise<void> | void
) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressEvent | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCurrent, setBatchCurrent] = useState(0);
  const [viewingDocument, setViewingDocument] = useState<PublicDocumentDetailResponse | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [downloadLinkInfo, setDownloadLinkInfo] = useState<DownloadLinkInfo | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    setUploading(true);
    setUploadProgress(null);
    setBatchTotal(files.length);
    setBatchCurrent(0);

    let successCount = 0;
    const signal = abortControllerRef.current.signal;
    let doneCount = 0;

    await Promise.allSettled(
      files.map((file) =>
        uploadDocumentStream(
          file,
          {
            onProgress: (event) => {
              setUploadProgress(event);
            },
            onComplete: (event) => {
              successCount++;
              messageApi.success(
                `${event.filename || file.name} 已入库，切分 ${event.segmentCount} 段`
              );
            },
            onError: (errorMessage) => {
              messageApi.error(`${file.name}: ${errorMessage}`);
            }
          },
          signal
        ).catch((error) => {
          if (error instanceof ApiError && error.status === 401) {
            setDocuments([]);
            void onUnauthorized();
            abortControllerRef.current?.abort();
          } else if (error instanceof Error && error.name !== "AbortError") {
            messageApi.error(`${file.name}: 上传失败`);
          }
        }).finally(() => {
          doneCount++;
          setBatchCurrent(doneCount);
        })
      )
    );

    setUploading(false);
    setUploadProgress(null);
    setBatchTotal(0);
    setBatchCurrent(0);
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
    setUploadProgress(null);
  }

  async function handleDeleteDocument(documentId: string) {
    if (!authenticated) {
      return;
    }

    setDeletingId(documentId);

    try {
      const response = await deleteDocument(documentId);
      messageApi.success(`${response.message}，删除 ${response.deletedSegments} 段`);
      await refreshDocuments();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleViewDocument(documentId: string) {
    setViewingLoading(true);
    try {
      const detail = await getPublicDocumentDetail(documentId);
      setViewingDocument(detail);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "获取文档详情失败");
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
      // 拼接完整 URL（当前 host + 后端返回的路径）
      const downloadUrl = response.downloadUrl.startsWith("http")
        ? response.downloadUrl
        : `${window.location.origin}${response.downloadUrl}`;
      setDownloadLinkInfo({ documentId, filename, downloadUrl });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "获取下载链接失败");
    }
  }

  function handleCloseDownloadLink() {
    setDownloadLinkInfo(null);
  }

  return {
    documents,
    documentsLoading,
    uploading,
    uploadProgress,
    batchTotal,
    batchCurrent,
    deletingId,
    refreshDocuments,
    handleUpload,
    cancelUpload,
    handleDeleteDocument,
    handleViewDocument,
    handleShowDownloadLink,
    handleCloseDownloadLink,
    downloadLinkInfo,
    viewingDocument,
    viewingLoading,
    handleCloseDocumentDetail
  };
}
