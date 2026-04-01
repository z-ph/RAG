import type {
  DocumentDeleteResponse,
  DocumentListResponse,
  DocumentResponse,
  RagRequest,
  SourceReference,
  StreamCancelledPayload,
  StreamCompletePayload,
  UploadCompleteEvent,
  UploadProgressEvent
} from "../types";
import { consumeSseStream } from "./sse";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    const fallbackMessage = `请求失败: HTTP ${response.status}`;

    try {
      const payload = await response.json();
      throw new Error(payload.message || payload.error || fallbackMessage);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  return response.json() as Promise<T>;
}

async function requestText(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `请求失败: HTTP ${response.status}`);
  }

  return response.text();
}

function parseJsonPayload<T>(value: string): T {
  return JSON.parse(value) as T;
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
    body: formData
  });

  if (!response.ok) {
    const text = await response.text();

    try {
      const payload = JSON.parse(text);
      throw new Error(payload.message || payload.error || "上传失败");
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(text || "上传失败");
    }
  }

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

interface StreamHandlers {
  onStart?: (payload: { conversationId?: string | null }) => void;
  onSources?: (payload: SourceReference[]) => void;
  onDelta?: (payload: string) => void;
  onComplete?: (payload: StreamCompletePayload) => void;
  onCancelled?: (payload: StreamCancelledPayload) => void;
  onError?: (message: string) => void;
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

export async function streamRagAnswer(
  request: RagRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal
) {
  const response = await fetch(`${API_BASE_URL}/rag/ask/stream`, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    signal
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
