import { useEffect, useState } from "react";
import { ApiError, deleteDocument, listDocuments, uploadDocument } from "../lib/api";
import type { DocumentListItem } from "../types";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setDocuments([]);
      setDocumentsLoading(false);
      setUploading(false);
      setDeletingId(null);
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

    setUploading(true);

    try {
      const response = await uploadDocument(file);
      messageApi.success(`${response.filename || file.name} 已入库，切分 ${response.segmentCount} 段`);
      await refreshDocuments();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setDocuments([]);
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
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
    deletingId,
    refreshDocuments,
    handleUpload,
    handleDeleteDocument
  };
}
