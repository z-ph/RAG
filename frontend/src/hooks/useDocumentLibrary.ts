import { useEffect, useState } from "react";
import { deleteDocument, listDocuments, uploadDocument } from "../lib/api";
import type { DocumentListItem } from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

export function useDocumentLibrary(messageApi: MessageApi) {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void refreshDocuments();
  }, []);

  async function refreshDocuments() {
    setDocumentsLoading(true);

    try {
      const response = await listDocuments();
      setDocuments(response.documents);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载文档失败");
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);

    try {
      const response = await uploadDocument(file);
      messageApi.success(`${response.filename || file.name} 已入库，切分 ${response.segmentCount} 段`);
      await refreshDocuments();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDocument(documentId: string) {
    setDeletingId(documentId);

    try {
      const response = await deleteDocument(documentId);
      messageApi.success(`${response.message}，删除 ${response.deletedSegments} 段`);
      await refreshDocuments();
    } catch (error) {
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
