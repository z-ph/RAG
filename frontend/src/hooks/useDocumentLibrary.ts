import { useEffect, useRef, useState } from "react";
import { ApiError, deleteDocument, listDocuments, uploadDocumentStream } from "../lib/api";
import type { DocumentListItem, UploadProgressEvent } from "../types";

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
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setDocuments([]);
      setDocumentsLoading(false);
      setUploading(false);
      setUploadProgress(null);
      setDeletingId(null);
      // Cancel any ongoing upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      return;
    }

    void refreshDocuments();
  }, [authenticated]);

  async function refreshDocuments() {
    if (!authenticated) {
      setDocuments([]);
      return;
    }

    setDocumentsLoading(true);

    try {
      const response = await listDocuments();
      setDocuments(response.documents);
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

  return {
    documents,
    documentsLoading,
    uploading,
    uploadProgress,
    deletingId,
    refreshDocuments,
    handleUpload,
    cancelUpload,
    handleDeleteDocument
  };
}
