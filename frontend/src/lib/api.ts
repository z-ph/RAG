import type {
  AuthStatusResponse,
  AuthSuccessResponse,
  DocumentDeleteResponse,
  DocumentListResponse,
  DocumentResponse,
  MessageResponse,
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  await ensureOk(response, `请求失败: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init
  });

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
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    credentials: "include",
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

export function getRagHealth() {
  return requestText("/rag/health", {
    method: "GET"
  });
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
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload/stream`, {
    method: "POST",
    credentials: "include",
    body: formData,
    signal
  });

  if (!response.ok) {
    throw await parseError(response, "上传失败");
  }

  if (!response.body) {
    throw new Error("响应体为空");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("event: ")) continue;

        const eventMatch = trimmed.match(/event: (\w+)/);
        const dataMatch = trimmed.match(/data: (.+)/s);

        if (!eventMatch || !dataMatch) continue;

        const eventName = eventMatch[1];
        const data = dataMatch[1];

        if (eventName === "progress") {
          try {
            const event = JSON.parse(data) as UploadProgressEvent;
            handlers.onProgress?.(event);
          } catch {
            // ignore parse error
          }
        } else if (eventName === "complete") {
          try {
            const event = JSON.parse(data) as UploadCompleteEvent;
            handlers.onComplete?.(event);
            return;
          } catch {
            // ignore parse error
          }
        } else if (eventName === "error") {
          try {
            const event = JSON.parse(data) as { message?: string; error?: string };
            handlers.onError?.(event.message || event.error || "上传失败");
            return;
          } catch {
            handlers.onError?.(data || "上传失败");
            return;
          }
        }
      }
    }

    // Process any remaining data
    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith("event: ")) {
        const eventMatch = trimmed.match(/event: (\w+)/);
        const dataMatch = trimmed.match(/data: (.+)/s);

        if (eventMatch && dataMatch && eventMatch[1] === "error") {
          try {
            const event = JSON.parse(dataMatch[1]) as { message?: string };
            handlers.onError?.(event.message || "上传失败");
          } catch {
            handlers.onError?.("上传失败");
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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
    credentials: "include",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json"
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
