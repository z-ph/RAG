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
  filename?: string | null;
  deletedSegments: number;
  message: string;
}

export interface PublicDocumentSegment {
  chunkIndex: number;
  text: string;
}

export interface PublicDocumentListItem {
  documentId: string;
  filename: string;
  title: string;
  category: string;
  documentTime: string;
  keywords: string;
  segmentCount: number;
}

export interface PublicDocumentListResponse {
  documents: PublicDocumentListItem[];
  total: number;
}

export interface PublicDocumentDetailResponse {
  documentId: string;
  filename: string;
  title: string;
  category: string;
  documentTime: string;
  keywords: string;
  segmentCount: number;
  segments: PublicDocumentSegment[];
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

export type ThinkingStatus = "idle" | "streaming" | "complete";

export type FileUploadStatus = "uploading" | "complete" | "error";

export interface FileUploadEntry {
  filename: string;
  status: FileUploadStatus;
  progress: UploadProgressEvent | null;
  errorMessage?: string;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  imageUrl?: string;
  thinking: string;
  thinkingStatus: ThinkingStatus;
  thinkingDurationMs: number;
  createdAt: string;
  status: "complete" | "streaming" | "error" | "cancelled";
  sources: SourceReference[];
}

// Auth types
export interface AuthUser {
  username: string;
  role: string;
  roleCode: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  user?: AuthUser | null;
}

export interface AuthSuccessResponse {
  message: string;
  user: AuthUser;
}

export interface RegistrationCode {
  id: number;
  code: string;
  note?: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt?: string | null;
  usedAt?: string | null;
  usedBy?: string | null;
  disabledAt?: string | null;
  status: string;
}

export interface RegistrationCodeListResponse {
  codes: RegistrationCode[];
  total: number;
}

export interface RegistrationCodeCreateRequest {
  note?: string | null;
  expiresAt?: string | null;
}

export interface MessageResponse {
  message: string;
}
