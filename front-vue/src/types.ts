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
}

export interface StreamCancelledPayload {
  reason?: string;
  conversationId?: string | null;
}

export type UploadProgressStage =
  | "PARSE_START"
  | "PARSE_COMPLETE"
  | "SEGMENT_START"
  | "SEGMENT_COMPLETE"
  | "EMBEDDING_GENERATE_START"
  | "EMBEDDING_GENERATE_PROGRESS"
  | "EMBEDDING_GENERATE_COMPLETE"
  | "EMBEDDING_STORE_START"
  | "EMBEDDING_STORE_PROGRESS"
  | "EMBEDDING_STORE_COMPLETE"
  | "COMPLETE"
  | "ERROR";

export interface UploadProgressEvent {
  stage: UploadProgressStage;
  message: string;
  current: number;
  total: number;
  percent: number;
  documentId?: string | null;
  filename?: string | null;
}

export interface UploadCompleteEvent extends UploadProgressEvent {
  segmentCount: number;
}

export type HealthState = "checking" | "ok" | "error";


export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  status: "complete" | "streaming" | "error" | "cancelled";
  sources: SourceReference[];
}
