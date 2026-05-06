import type {
  AuthStatusResponse,
  AuthSuccessResponse,
  DocumentDeleteResponse,
  DocumentListResponse,
  DocumentResponse,
  ImageAskResponse,
  MessageResponse,
  PublicDocumentDetailResponse,
  PublicDocumentListResponse,
  RagRequest,
  RegistrationCodeCreateRequest,
  RegistrationCodeListResponse,
  RegistrationCode,
  SourceReference,
  StreamCancelledPayload,
  StreamCompletePayload,
  StreamThinkingEndPayload,
  UploadProgressEvent,
  UploadCompleteEvent
} from "../types";
import { consumeSseStream } from "./sse";
import {
  API_BASE_URL,
  ApiError,
  ensureOkResponse,
  requestJson,
  requestResponse,
  requestText
} from "./httpClient";

export { API_BASE_URL, ApiError };

function parseJsonPayload<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function getAuthStatus() {
  return requestJson<AuthStatusResponse>("/auth/me", {
    method: "GET",
    auth: "required",
    fallbackMessage: "鉴权状态检查失败"
  });
}

export function login(username: string, password: string) {
  return requestJson<AuthSuccessResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    auth: "none",
    fallbackMessage: "登录失败"
  });
}

export function register(username: string, password: string, registrationCode: string) {
  return requestJson<AuthSuccessResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, registrationCode }),
    auth: "none",
    fallbackMessage: "注册失败"
  });
}

export function logout() {
  return requestJson<MessageResponse>("/auth/logout", {
    method: "POST",
    auth: "required",
    fallbackMessage: "退出失败"
  });
}

export function listRegistrationCodes() {
  return requestJson<RegistrationCodeListResponse>("/auth/registration-codes", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载注册码失败"
  });
}

export function createRegistrationCode(request: RegistrationCodeCreateRequest) {
  return requestJson<RegistrationCode>("/auth/registration-codes", {
    method: "POST",
    body: JSON.stringify(request),
    auth: "required",
    fallbackMessage: "创建注册码失败"
  });
}

export function disableRegistrationCode(id: number) {
  return requestJson<RegistrationCode>(`/auth/registration-codes/${id}/disable`, {
    method: "PATCH",
    auth: "required",
    fallbackMessage: "禁用注册码失败"
  });
}

export function deleteRegistrationCode(id: number) {
  return requestJson<MessageResponse>(`/auth/registration-codes/${id}`, {
    method: "DELETE",
    auth: "required",
    fallbackMessage: "删除注册码失败"
  });
}

export function listDocuments() {
  return requestJson<DocumentListResponse>("/documents", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载文档失败"
  });
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  const baseName = file.name.replace(/^.*[/\\]/, "");
  formData.append("file", file, baseName);

  const response = await requestResponse("/documents/upload", {
    method: "POST",
    body: formData,
    auth: "required",
    fallbackMessage: "上传失败"
  });

  await ensureOkResponse(response, "上传失败");
  return response.json() as Promise<DocumentResponse>;
}

export function deleteDocument(documentId: string) {
  return requestJson<DocumentDeleteResponse>(`/documents/${documentId}`, {
    method: "DELETE",
    auth: "required",
    fallbackMessage: "删除失败"
  });
}

export function getDocumentHealth() {
  return requestText("/documents/health", {
    method: "GET",
    auth: "none",
    fallbackMessage: "文档服务不可用"
  });
}

export function listPublicDocuments() {
  return requestJson<PublicDocumentListResponse>("/documents/public", {
    method: "GET",
    auth: "none",
    fallbackMessage: "加载公开文档失败"
  });
}

export function getPublicDocumentDetail(documentId: string) {
  return requestJson<PublicDocumentDetailResponse>(`/documents/public/${documentId}`, {
    method: "GET",
    auth: "none",
    fallbackMessage: "获取文档详情失败"
  });
}

export function getDocumentDownloadUrl(documentId: string) {
  return `${API_BASE_URL}/documents/public/${documentId}/download`;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  filename: string;
}

export function getDocumentDownloadLink(documentId: string) {
  return requestJson<DownloadUrlResponse>(`/documents/public/${documentId}/download-url`, {
    method: "GET",
    auth: "none",
    fallbackMessage: "获取下载链接失败"
  });
}

export function getRagHealth() {
  return requestText("/rag/health", {
    method: "GET",
    auth: "none",
    fallbackMessage: "RAG 服务不可用"
  });
}

// Admin Document API

export interface AdminSegmentInfo {
  pointId: string;
  text: string;
  chunkIndex: number;
  title: string;
  category: string;
  keywords: string;
}

export interface AdminSegmentListResponse {
  documentId: string;
  segments: AdminSegmentInfo[];
  total: number;
}

export function adminListSegments(documentId: string) {
  return requestJson<AdminSegmentListResponse>(`/admin/documents/${documentId}/segments`, {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载切片失败"
  });
}

export function adminUpdateSegment(documentId: string, pointId: string, text: string) {
  return requestJson<AdminSegmentInfo>(`/admin/documents/${documentId}/segments/${pointId}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
    auth: "required",
    fallbackMessage: "更新切片失败"
  });
}

export function adminDeleteSegment(documentId: string, pointId: string) {
  return requestJson<{ message: string; pointId: string }>(
    `/admin/documents/${documentId}/segments/${pointId}`,
    {
      method: "DELETE",
      auth: "required",
      fallbackMessage: "删除切片失败"
    }
  );
}

export function adminReindexDocument(documentId: string) {
  return requestJson<{ message: string; documentId: string; deletedSegments: number; newSegments: number }>(
    `/admin/documents/${documentId}/reindex`,
    {
      method: "POST",
      auth: "required",
      fallbackMessage: "重建索引失败"
    }
  );
}

// Prompt Management API

export interface PromptInfo {
  id: number;
  promptKey: string;
  promptContent: string;
  description: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export function listPrompts() {
  return requestJson<PromptInfo[]>("/admin/prompts", {
    method: "GET",
    auth: "required",
    fallbackMessage: "加载提示词失败"
  });
}

export function updatePrompt(key: string, content: string, description?: string) {
  return requestJson<PromptInfo>(`/admin/prompts/${key}`, {
    method: "PUT",
    body: JSON.stringify({ content, description }),
    auth: "required",
    fallbackMessage: "更新提示词失败"
  });
}

export function resetPrompt(key: string) {
  return requestJson<PromptInfo>(`/admin/prompts/${key}/reset`, {
    method: "POST",
    auth: "required",
    fallbackMessage: "重置提示词失败"
  });
}

export async function askWithImage(
  image: File,
  question: string,
  options?: { conversationId?: string; maxResults?: number; minScore?: number }
) {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("question", question);
  if (options?.conversationId) {
    formData.append("conversationId", options.conversationId);
  }
  if (typeof options?.maxResults === "number") {
    formData.append("maxResults", String(options.maxResults));
  }
  if (typeof options?.minScore === "number") {
    formData.append("minScore", String(options.minScore));
  }

  const response = await requestResponse("/rag/ask/with-image", {
    method: "POST",
    body: formData,
    auth: "none",
    fallbackMessage: "图片问答失败"
  });

  await ensureOkResponse(response, "图片问答失败");
  return response.json() as Promise<ImageAskResponse>;
}

export function cancelConversation(conversationId: string) {
  return requestText(`/rag/conversations/${conversationId}/cancel`, {
    method: "POST",
    auth: "none",
    fallbackMessage: "取消请求失败"
  });
}

export function clearConversation(conversationId: string) {
  return requestText(`/rag/conversations/${conversationId}`, {
    method: "DELETE",
    auth: "none",
    fallbackMessage: "清空会话失败"
  });
}

export async function uploadDocumentStream(
  file: File,
  handlers: {
    onProgress?: (event: UploadProgressEvent) => void;
    onComplete?: (event: UploadCompleteEvent) => void;
    onError?: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();
  const baseName = file.name.replace(/^.*[/\\]/, "");
  formData.append("file", file, baseName);

  const response = await requestResponse("/documents/upload/stream", {
    method: "POST",
    body: formData,
    signal,
    auth: "required",
    fallbackMessage: "上传失败"
  });

  await consumeSseStream(response, ({ event, data }) => {
    if (event === "progress") {
      try {
        const payload = parseJsonPayload<UploadProgressEvent>(data);
        handlers.onProgress?.(payload);
      } catch {
        // ignore parse error
      }
      return;
    }

    if (event === "complete") {
      try {
        const payload = parseJsonPayload<UploadCompleteEvent>(data);
        handlers.onComplete?.(payload);
      } catch {
        // ignore parse error
      }
      return;
    }

    if (event === "error") {
      try {
        const payload = parseJsonPayload<{ message?: string; error?: string }>(data);
        handlers.onError?.(payload.message || payload.error || "上传失败");
      } catch {
        handlers.onError?.(data || "上传失败");
      }
    }
  });
}

interface StreamHandlers {
  onStart?: (payload: { conversationId?: string | null }) => void;
  onSources?: (payload: SourceReference[]) => void;
  onThinkingDelta?: (payload: string) => void;
  onThinkingEnd?: (payload: StreamThinkingEndPayload) => void;
  onDelta?: (payload: string) => void;
  onComplete?: (payload: StreamCompletePayload) => void;
  onCancelled?: (payload: StreamCancelledPayload) => void;
  onError?: (message: string) => void;
}

export async function streamRagAnswer(
  request: RagRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal
) {
  const response = await requestResponse("/rag/ask/stream", {
    method: "POST",
    headers: {
      Accept: "text/event-stream"
    },
    body: JSON.stringify(request),
    signal,
    auth: "none",
    contentType: "json",
    fallbackMessage: "生成失败"
  });

  await consumeSseStream(response, ({ event, data }) => {
    if (event === "start") {
      handlers.onStart?.(parseJsonPayload<{ conversationId?: string | null }>(data));
      return;
    }

    if (event === "sources") {
      handlers.onSources?.(parseJsonPayload<SourceReference[]>(data));
      return;
    }

    if (event === "thinking_delta") {
      handlers.onThinkingDelta?.(data);
      return;
    }

    if (event === "thinking_end") {
      handlers.onThinkingEnd?.(parseJsonPayload<StreamThinkingEndPayload>(data));
      return;
    }

    if (event === "delta") {
      handlers.onDelta?.(data);
      return;
    }

    if (event === "complete") {
      handlers.onComplete?.(parseJsonPayload<StreamCompletePayload>(data));
      return;
    }

    if (event === "cancelled") {
      handlers.onCancelled?.(parseJsonPayload<StreamCancelledPayload>(data));
      return;
    }

    if (event === "error") {
      try {
        const payload = parseJsonPayload<{ message?: string; error?: string }>(data);
        handlers.onError?.(payload.message || payload.error || "生成失败");
      } catch {
        handlers.onError?.(data || "生成失败");
      }
    }
  });
}
