import { onMounted, ref, watch } from "vue";
import { ApiError, deleteDocument, getDocumentDownloadLink, getPublicDocumentDetail, listDocuments, listPublicDocuments, uploadDocumentStream } from "../lib/api";
import type { DocumentListItem, FileUploadEntry, PublicDocumentDetailResponse } from "../types";

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
  const documents = ref<DocumentListItem[]>([]);
  const documentsLoading = ref(false);
  const uploading = ref(false);
  const fileUploads = ref<FileUploadEntry[]>([]);
  const deletingId = ref<string | null>(null);
  const viewingDocument = ref<PublicDocumentDetailResponse | null>(null);
  const viewingLoading = ref(false);
  const downloadLinkInfo = ref<DownloadLinkInfo | null>(null);
  let abortController: AbortController | null = null;

  onMounted(() => {
    void refreshDocuments();
  });

  watch(() => authenticated, (newAuth) => {
    if (!newAuth) {
      documents.value = [];
      documentsLoading.value = false;
      uploading.value = false;
      fileUploads.value = [];
      deletingId.value = null;
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    } else {
      void refreshDocuments();
    }
  });

  async function refreshDocuments() {
    documentsLoading.value = true;

    try {
      if (authenticated) {
        const response = await listDocuments();
        documents.value = response.documents;
      } else {
        const response = await listPublicDocuments();
        documents.value = response.documents;
      }
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

  async function handleUpload(fileOrFiles: File | File[]) {
    if (!authenticated) {
      return;
    }

    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    if (files.length === 0) return;

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    const initialEntries: FileUploadEntry[] = files.map((f) => ({
      filename: f.name,
      status: "uploading" as const,
      progress: null,
    }));

    uploading.value = true;
    fileUploads.value = initialEntries;

    let successCount = 0;
    const signal = abortController.signal;

    await Promise.allSettled(
      files.map((file, index) =>
        uploadDocumentStream(
          file,
          {
            onProgress: (event) => {
              fileUploads.value = fileUploads.value.map((entry, i) =>
                i === index ? { ...entry, progress: event } : entry
              );
            },
            onComplete: (event) => {
              successCount++;
              fileUploads.value = fileUploads.value.map((entry, i) =>
                i === index ? { ...entry, status: "complete" as const } : entry
              );
              messageApi.success(
                `${event.filename || file.name} 已入库，切分 ${event.segmentCount} 段`
              );
            },
            onError: (errorMessage) => {
              fileUploads.value = fileUploads.value.map((entry, i) =>
                i === index ? { ...entry, status: "error" as const, errorMessage } : entry
              );
              messageApi.error(`${file.name}: ${errorMessage}`);
            }
          },
          signal
        ).catch((error) => {
          if (error instanceof ApiError && error.status === 401) {
            documents.value = [];
            void onUnauthorized();
            abortController?.abort();
          } else if (error instanceof Error && error.name !== "AbortError") {
            fileUploads.value = fileUploads.value.map((entry, i) =>
              i === index ? { ...entry, status: "error" as const, errorMessage: "上传失败" } : entry
            );
            messageApi.error(`${file.name}: 上传失败`);
          }
        })
      )
    );

    uploading.value = false;
    fileUploads.value = [];
    if (successCount > 0) {
      void refreshDocuments();
    }
  }

  function cancelUpload() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    uploading.value = false;
    fileUploads.value = [];
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

  async function handleShowDownloadLink(documentId: string, filename: string) {
    try {
      const response = await getDocumentDownloadLink(documentId);
      const downloadUrl = response.downloadUrl.startsWith("http")
        ? response.downloadUrl
        : `${window.location.origin}${response.downloadUrl}`;
      downloadLinkInfo.value = { documentId, filename, downloadUrl };
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "获取下载链接失败");
    }
  }

  function handleCloseDownloadLink() {
    downloadLinkInfo.value = null;
  }

  return {
    documents,
    documentsLoading,
    uploading,
    fileUploads,
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
