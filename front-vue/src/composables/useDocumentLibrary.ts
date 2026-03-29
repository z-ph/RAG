import { onMounted, ref } from "vue";
import { deleteDocument, listDocuments, uploadDocument } from "../lib/api";
import type { DocumentListItem } from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

export function useDocumentLibrary(messageApi: MessageApi) {
  const documents = ref<DocumentListItem[]>([]);
  const documentsLoading = ref(true);
  const uploading = ref(false);
  const deletingId = ref<string | null>(null);

  onMounted(() => {
    void refreshDocuments();
  });

  async function refreshDocuments() {
    documentsLoading.value = true;

    try {
      const response = await listDocuments();
      documents.value = response.documents;
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载文档失败");
    } finally {
      documentsLoading.value = false;
    }
  }

  async function handleUpload(file: File) {
    uploading.value = true;

    try {
      const response = await uploadDocument(file);
      messageApi.success(
        `${response.filename || file.name} 已入库，切分 ${response.segmentCount} 段`
      );
      await refreshDocuments();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      uploading.value = false;
    }
  }

  async function handleDeleteDocument(documentId: string) {
    deletingId.value = documentId;

    try {
      const response = await deleteDocument(documentId);
      messageApi.success(`${response.message}，删除 ${response.deletedSegments} 段`);
      await refreshDocuments();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      deletingId.value = null;
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
