# Public Document Viewing & Download Design

## Overview

Allow unauthenticated users to view document listings, full document details, and download original files via public API endpoints.

## Background

Currently all document APIs (`/api/documents/**`) require authentication. Uploaded files are processed in-memory and discarded — only text segments and vectors persist in Qdrant. No file download capability exists.

## Design

### 1. File Persistence on Upload

When a document is uploaded via `POST /api/documents/upload` or the SSE variant:

- Generate a UUID `documentId`
- Save the original file to `/app/uploads/{documentId}/{filename}`
- Sanitize filename: reject paths containing `..`, `/`, `\`
- Then proceed with existing parsing/chunking/embedding pipeline as before

The `/app/uploads` directory is already configured as a Docker volume in `docker-compose.yml`.

### 2. Public API Endpoints

All three endpoints are `permitAll` in `SecurityConfig`.

#### GET /api/documents/public

Returns a list of all documents with metadata.

Response:
```json
{
  "documents": [
    {
      "documentId": "uuid",
      "filename": "report.pdf",
      "title": "Annual Report",
      "category": "Finance",
      "keywords": ["revenue", "growth"],
      "segmentCount": 42,
      "uploadTime": "2026-04-20T10:00:00Z"
    }
  ]
}
```

Implementation: Query Qdrant via scroll API, group by `documentId`, aggregate metadata. Reuse existing `DocumentAdminService.listDocuments()` logic.

#### GET /api/documents/public/{documentId}

Returns full document details including all text segments.

Response:
```json
{
  "documentId": "uuid",
  "filename": "report.pdf",
  "title": "Annual Report",
  "category": "Finance",
  "keywords": ["revenue", "growth"],
  "documentTime": "2026-01-15",
  "uploadTime": "2026-04-20T10:00:00Z",
  "segments": [
    {
      "chunkIndex": 0,
      "text": "First paragraph content..."
    }
  ]
}
```

Implementation: Query Qdrant filtered by `documentId`, return all segments sorted by `chunkIndex`.

#### GET /api/documents/public/{documentId}/download

Downloads the original file.

- Validates `documentId` is a valid UUID format
- Looks up file path from Qdrant metadata (filename)
- Serves file with `Content-Disposition: attachment; filename="..."` header
- Returns 404 if file not found on disk

### 3. Security Measures

#### Rate Limiting

IP-based token bucket rate limiter implemented as a Spring filter:

| Endpoint group | Limit |
|----------------|-------|
| Public listing & detail (`/api/documents/public/**` except download) | 30 requests/IP/minute |
| File download (`/api/documents/public/*/download`) | 10 requests/IP/minute |

Excess requests return HTTP 429 with JSON body `{"error": "请求过于频繁，请稍后再试"}`.

Implementation: Simple in-memory `ConcurrentHashMap<String, TokenBucket>` with scheduled cleanup of expired entries.

#### Path Traversal Prevention

- `documentId` must match UUID regex `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`
- Filename from Qdrant metadata is validated — must not contain `..`, `/`, `\`
- Constructed path is canonicalized and verified to be under `/app/uploads/`

#### File Serving Safety

- Check file exists and is a regular file
- Check file size does not exceed 50MB (configurable)
- Set `Content-Disposition: attachment` to force download
- Set appropriate `Content-Type` based on extension (`application/pdf`, `text/plain`)

### 4. Changes Required

| File | Change |
|------|--------|
| `SecurityConfig.java` | Add `/api/documents/public/**` to `permitAll` |
| `DocumentController.java` | Add 3 public endpoints |
| `DocumentService.java` | Modify upload to save original file to disk |
| New: `RateLimitFilter.java` | IP-based rate limiting filter |
| New: `FileStorageService.java` | File save/read/delete operations with path validation |
| `DocumentAdminService.java` | Add method to get document details with segments |

### 5. Out of Scope

- Per-document visibility control
- User-level download quotas
- Audit logging of public access
- CDN or cache layer for file serving
