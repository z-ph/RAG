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
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./tokenStorage";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL

export { API_BASE_URL };

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseError(response: Response, fallbackMessage: string) {
  const text = await response.text();

  if (!text) {
    return new ApiError(fallbackMessage, response.status);
  }

  try {
    const payload = JSON.parse(text) as { message?: string; error?: string };
    return new ApiError(payload.message || payload.error || fallbackMessage, response.status);
  } catch {
    return new ApiError(text || fallbackMessage, response.status);
  }
}

async function ensureOk(response: Response, fallbackMessage: string) {
  if (response.ok) {
    return;
  }

  throw await parseError(response, fallbackMessage);
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Concurrent refresh mutex: only one refresh request in flight at a time
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data = await response.json() as { accessToken: string; refreshToken: string };
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers || {})
    }
  });

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
          ...(init?.headers || {})
        }
      });
      await ensureOk(retryResponse, `请求失败: HTTP ${retryResponse.status}`);
      return retryResponse.json() as Promise<T>;
    }
  }

  await ensureOk(response, `请求失败: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {})
    }
  });

  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryResponse = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
          ...authHeaders(),
          ...(init?.headers || {})
        }
      });
      await ensureOk(retryResponse, `请求失败: HTTP ${retryResponse.status}`);
      return retryResponse.text();
    }
  }

  await ensureOk(response, `请求失败: HTTP ${response.status}`);
  return response.text();
}

function parseJsonPayload<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function getAuthStatus() {
  return requestJson<AuthStatusResponse>("/auth/me", {
    method: "GET"
  });
}

export function login(username: string, password: string) {
  return requestJson<AuthSuccessResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function register(username: string, password: string, registrationCode: string) {
  return requestJson<AuthSuccessResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, registrationCode })
  });
}

export function logout() {
  return requestJson<MessageResponse>("/auth/logout", {
    method: "POST"
  });
}

export function listRegistrationCodes() {
  return requestJson<RegistrationCodeListResponse>("/auth/registration-codes", {
    method: "GET"
  });
}

export function createRegistrationCode(request: RegistrationCodeCreateRequest) {
  return requestJson<RegistrationCode>("/auth/registration-codes", {
    method: "POST",
    body: JSON.stringify(request)
  });
}

export function disableRegistrationCode(id: number) {
  return requestJson<RegistrationCode>(`/auth/registration-codes/${id}/disable`, {
    method: "PATCH"
  });
}

export function deleteRegistrationCode(id: number) {
  return requestJson<MessageResponse>(`/auth/registration-codes/${id}`, {
    method: "DELETE"
  });
}

export function listDocuments() {
  return requestJson<DocumentListResponse>("/documents", {
    method: "GET"
  });
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  const baseName = file.name.replace(/^.*[/\\]/, "");
  formData.append("file", file, baseName);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });

  await ensureOk(response, "上传失败");
  return response.json() as Promise<DocumentResponse>;
}

export function deleteDocument(documentId: string) {
  return requestJson<DocumentDeleteResponse>(`/documents/${documentId}`, {
    method: "DELETE"
  });
}

export function getDocumentHealth() {
  return requestText("/documents/health", {
    method: "GET"
  });
}

export function listPublicDocuments() {
  return requestJson<PublicDocumentListResponse>("/documents/public", {
    method: "GET"
  });
}

export function getPublicDocumentDetail(documentId: string) {
  return requestJson<PublicDocumentDetailResponse>(`/documents/public/${documentId}`, {
    method: "GET"
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
    method: "GET"
  });
}

export function getRagHealth() {
  return requestText("/rag/health", {
    method: "GET"
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
    method: "GET"
  });
}

export function adminUpdateSegment(documentId: string, pointId: string, text: string) {
  return requestJson<AdminSegmentInfo>(`/admin/documents/${documentId}/segments/${pointId}`, {
    method: "PUT",
    body: JSON.stringify({ text })
  });
}

export function adminDeleteSegment(documentId: string, pointId: string) {
  return requestJson<{ message: string; pointId: string }>(
    `/admin/documents/${documentId}/segments/${pointId}`,
    { method: "DELETE" }
  );
}

export function adminReindexDocument(documentId: string) {
  return requestJson<{ message: string; documentId: string; deletedSegments: number; newSegments: number }>(
    `/admin/documents/${documentId}/reindex`,
    { method: "POST" }
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
  return requestJson<PromptInfo[]>("/admin/prompts", { method: "GET" });
}

export function updatePrompt(key: string, content: string, description?: string) {
  return requestJson<PromptInfo>(`/admin/prompts/${key}`, {
    method: "PUT",
    body: JSON.stringify({ content, description })
  });
}

export function resetPrompt(key: string) {
  return requestJson<PromptInfo>(`/admin/prompts/${key}/reset`, { method: "POST" });
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

  const response = await fetch(`${API_BASE_URL}/rag/ask/with-image`, {
    method: "POST",
    headers: authHeaders(),
    body: formData
  });

  await ensureOk(response, "图片问答失败");
  return response.json() as Promise<ImageAskResponse>;
}

export function cancelConversation(conversationId: string) {
  return requestText(`/rag/conversations/${conversationId}/cancel`, {
    method: "POST"
  });
}

export function clearConversation(conversationId: string) {
  return requestText(`/rag/conversations/${conversationId}`, {
    method: "DELETE"
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

  const response = await fetch(`${API_BASE_URL}/documents/upload/stream`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
    signal
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
  const response = await fetch(`${API_BASE_URL}/rag/ask/stream`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      ...authHeaders()
    },
    body: JSON.stringify(request),
    signal
  });

  await ensureOk(response, "生成失败");

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
