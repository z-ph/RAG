export interface SourceReference {
  filename: string;
  excerpt: string;
  relevanceScore: number;
}

export interface RagRequest {
  question: string;
  conversationId?: string | null;
  maxResults?: number | null;
}

export interface DocumentResponse {
  documentId?: string | null;
  filename?: string | null;
  message: string;
  segmentCount: number;
}

export interface DocumentListItem {
  documentId: string;
  filename: string;
  segmentCount: number;
}

export interface DocumentListResponse {
  documents: DocumentListItem[];
  total: number;
}

export interface DocumentDeleteResponse {
  documentId: string;
  deletedSegments: number;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
}

export interface StreamCompletePayload {
  conversationId?: string | null;
  cancelled?: boolean;
  content?: string | null;
  thinking?: string | null;
}

export interface StreamCancelledPayload {
  reason?: string;
  conversationId?: string | null;
}

export interface StreamThinkingEndPayload {
  conversationId?: string | null;
  thinkingEnded?: boolean;
  reason?: string | null;
}

export type HealthState = "checking" | "ok" | "error";

export type ThinkingStatus = "idle" | "streaming" | "complete";

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  thinking: string;
  thinkingStatus: ThinkingStatus;
  createdAt: string;
  status: "complete" | "streaming" | "error" | "cancelled";
  sources: SourceReference[];
}
