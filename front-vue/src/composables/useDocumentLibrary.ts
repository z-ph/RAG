import { onMounted, ref } from "vue";
import { deleteDocument, listDocuments, uploadDocumentStream } from "../lib/api";
import type { DocumentListItem, UploadProgressEvent } from "../types";

interface MessageApi {
  error: (content: string) => void;
  success: (content: string) => void;
}

export function useDocumentLibrary(messageApi: MessageApi) {
  const documents = ref<DocumentListItem[]>([]);
  const documentsLoading = ref(true);
  const uploading = ref(false);
  const uploadProgress = ref<UploadProgressEvent | null>(null);
  const deletingId = ref<string | null>(null);
  let abortController: AbortController | null = null;

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
    // Cancel any previous upload
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    uploading.value = true;
    uploadProgress.value = null;

    try {
      await uploadDocumentStream(
        file,
        {
          onProgress: (event) => {
            uploadProgress.value = event;
          },
          onComplete: (event) => {
            uploadProgress.value = event;
            messageApi.success(
              `${event.filename || file.name} 已入库，切分 ${event.segmentCount} 段`
            );
            setTimeout(() => {
              uploading.value = false;
              uploadProgress.value = null;
              void refreshDocuments();
            }, 1000);
          },
          onError: (errorMessage) => {
            messageApi.error(errorMessage);
            uploading.value = false;
            uploadProgress.value = null;
          }
        },
        abortController.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        messageApi.error(error instanceof Error ? error.message : "上传失败");
      }
      uploading.value = false;
      uploadProgress.value = null;
    }
  }

  function cancelUpload() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    uploading.value = false;
    uploadProgress.value = null;
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
    uploadProgress,
    deletingId,
    refreshDocuments,
    handleUpload,
    cancelUpload,
    handleDeleteDocument
  };
}
