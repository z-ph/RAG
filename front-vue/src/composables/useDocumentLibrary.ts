import { onMounted, ref, watch } from "vue";
import { ApiError, deleteDocument, getDocumentDownloadUrl, getPublicDocumentDetail, listDocuments, uploadDocumentStream } from "../lib/api";
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
  const documents = ref<DocumentListItem[]>([]);
  const documentsLoading = ref(false);
  const uploading = ref(false);
  const uploadProgress = ref<UploadProgressEvent | null>(null);
  const deletingId = ref<string | null>(null);
  const viewingDocument = ref<PublicDocumentDetailResponse | null>(null);
  const viewingLoading = ref(false);
  let abortController: AbortController | null = null;

  onMounted(() => {
    if (authenticated) {
      void refreshDocuments();
    }
  });

  // Watch for auth changes
  watch(() => authenticated, (newAuth) => {
    if (!newAuth) {
      documents.value = [];
      documentsLoading.value = false;
      uploading.value = false;
      uploadProgress.value = null;
      deletingId.value = null;
      // Cancel any ongoing upload
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    } else {
      void refreshDocuments();
    }
  });

  async function refreshDocuments() {
    if (!authenticated) {
      documents.value = [];
      return;
    }

    documentsLoading.value = true;

    try {
      const response = await listDocuments();
      documents.value = response.documents;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        documents.value = [];
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "加载文档失败");
    } finally {
      documentsLoading.value = false;
    }
  }

  async function handleUpload(file: File) {
    if (!authenticated) {
      return;
    }

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
      if (error instanceof ApiError && error.status === 401) {
        documents.value = [];
        await onUnauthorized();
        return;
      }

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
    if (!authenticated) {
      return;
    }

    deletingId.value = documentId;

    try {
      const response = await deleteDocument(documentId);
      messageApi.success(`${response.message}，删除 ${response.deletedSegments} 段`);
      await refreshDocuments();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        documents.value = [];
        await onUnauthorized();
        return;
      }

      messageApi.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      deletingId.value = null;
    }
  }

  async function handleViewDocument(documentId: string) {
    viewingLoading.value = true;
    try {
      viewingDocument.value = await getPublicDocumentDetail(documentId);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "获取文档详情失败");
    } finally {
      viewingLoading.value = false;
    }
  }

  function handleCloseDocumentDetail() {
    viewingDocument.value = null;
  }

  function handleDownloadDocument(documentId: string) {
    window.open(getDocumentDownloadUrl(documentId), "_blank");
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
