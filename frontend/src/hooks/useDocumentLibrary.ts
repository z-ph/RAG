import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, ApiError, deleteDocument, getDocumentDownloadLink, getPublicDocumentDetail, listDocuments, listPublicDocuments, uploadDocumentStream } from "../lib/api";
import type { DocumentListItem, PublicDocumentDetailResponse, UploadProgressEvent } from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
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
  const [viewingDocument, setViewingDocument] = useState<PublicDocumentDetailResponse | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
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

  async function handleUpload(file: File) {
    if (!authenticated) {
      return;
    }

    // Cancel any previous upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setUploading(true);
    setUploadProgress(null);

    try {
      await uploadDocumentStream(
        file,
        {
          onProgress: (event) => {
            setUploadProgress(event);
          },
          onComplete: (event) => {
            setUploadProgress(event);
            messageApi.success(
              `${event.filename || file.name} 已入库，切分 ${event.segmentCount} 段`
            );
            setTimeout(() => {
              setUploading(false);
              setUploadProgress(null);
              void refreshDocuments();
            }, 1000);
          },
          onError: (errorMessage) => {
            messageApi.error(errorMessage);
            setUploading(false);
            setUploadProgress(null);
          }
        },
        abortControllerRef.current.signal
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      if (error instanceof Error && error.name !== "AbortError") {
        messageApi.error(error instanceof Error ? error.message : "上传失败");
      }
      setUploading(false);
      setUploadProgress(null);
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

  async function handleDownloadDocument(documentId: string) {
    try {
      const response = await getDocumentDownloadLink(documentId);
      const downloadUrl = `${API_BASE_URL}${response.downloadUrl}`;

      // 直接跳转下载链接，由浏览器原生处理下载，避免内存问题
      window.location.href = downloadUrl;
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "下载失败");
    }
  }

  return {
    documents,
    documentsLoading,
    uploading,
    uploadProgress,
    deletingId,
    refreshDocuments,
    handleUpload,
    cancelUpload,
    handleDeleteDocument,
    handleViewDocument,
    handleDownloadDocument,
    viewingDocument,
    viewingLoading,
    handleCloseDocumentDetail
  };
}
