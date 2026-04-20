# Public Document Viewing & Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public (unauthenticated) API endpoints for viewing document listings, document details with all text segments, and downloading original files.

**Architecture:** Extend existing DocumentController and DocumentAdminService. New FileStorageService handles file persistence. New RateLimitFilter provides IP-based rate limiting. Qdrant remains the sole document metadata store.

**Tech Stack:** Java 21, Spring Boot, Spring Security, Qdrant REST API, local filesystem

---

### Task 1: Add file storage config to application.yaml

**Files:**
- Modify: `src/main/resources/application.yaml:66`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add upload storage path config to application.yaml**

After the `rag:` section (after line 66), add:

```yaml
upload:
  storage-path: ${UPLOAD_STORAGE_PATH:/app/uploads}
```

- [ ] **Step 2: Add env var to docker-compose.yml app service**

After the `RAG_STREAM_TIMEOUT_MS` env var (line 84), add:

```yaml
      UPLOAD_STORAGE_PATH: /app/uploads
```

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/application.yaml docker-compose.yml
git commit -m "feat: add file upload storage path configuration"
```

---

### Task 2: Create FileStorageService

**Files:**
- Create: `src/main/java/com/mark/knowledge/rag/service/FileStorageService.java`

- [ ] **Step 1: Create FileStorageService**

```java
package com.mark.knowledge.rag.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.regex.Pattern;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", Pattern.CASE_INSENSITIVE);

    private final Path storageRoot;

    public FileStorageService(@Value("${upload.storage-path:/app/uploads}") String storagePath) {
        this.storageRoot = Paths.get(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageRoot);
            log.info("文件存储目录: {}", this.storageRoot);
        } catch (IOException e) {
            throw new RuntimeException("无法创建文件存储目录: " + this.storageRoot, e);
        }
    }

    public void saveFile(String documentId, String filename, InputStream inputStream) throws IOException {
        validateDocumentId(documentId);
        validateFilename(filename);
        Path docDir = storageRoot.resolve(documentId);
        Files.createDirectories(docDir);
        Path targetFile = docDir.resolve(filename).normalize();
        if (!targetFile.startsWith(docDir)) {
            throw new IllegalArgumentException("非法文件路径");
        }
        Files.copy(inputStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        log.info("文件已保存: {}", targetFile);
    }

    public Path getFilePath(String documentId, String filename) {
        validateDocumentId(documentId);
        validateFilename(filename);
        Path file = storageRoot.resolve(documentId).resolve(filename).normalize();
        if (!file.startsWith(storageRoot)) {
            throw new IllegalArgumentException("非法文件路径");
        }
        if (!Files.isRegularFile(file)) {
            return null;
        }
        return file;
    }

    public void deleteFile(String documentId, String filename) throws IOException {
        Path file = getFilePath(documentId, filename);
        if (file != null) {
            Files.deleteIfExists(file);
            Path docDir = file.getParent();
            if (Files.isDirectory(docDir) && Files.list(docDir).findFirst().isEmpty()) {
                Files.deleteIfExists(docDir);
            }
            log.info("文件已删除: {}", file);
        }
    }

    private void validateDocumentId(String documentId) {
        if (documentId == null || !UUID_PATTERN.matcher(documentId).matches()) {
            throw new IllegalArgumentException("非法的文档ID格式");
        }
    }

    private void validateFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("非法文件名");
        }
    }
}
```

Note: `Pattern` import is `java.util.regex.Pattern`.

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/service/FileStorageService.java
git commit -m "feat: add FileStorageService for persistent file storage"
```

---

### Task 3: Modify upload flow to save original files

**Files:**
- Modify: `src/main/java/com/mark/knowledge/rag/app/DocumentController.java:58-103`
- Modify: `src/main/java/com/mark/knowledge/rag/app/DocumentController.java:111-209`

- [ ] **Step 1: Add FileStorageService dependency to DocumentController**

Add `FileStorageService` as a constructor parameter and field in `DocumentController`:

```java
private final FileStorageService fileStorageService;

public DocumentController(
        DocumentService documentService,
        EmbeddingService embeddingService,
        DocumentAdminService documentAdminService,
        FileStorageService fileStorageService) {
    this.documentService = documentService;
    this.embeddingService = embeddingService;
    this.documentAdminService = documentAdminService;
    this.fileStorageService = fileStorageService;
}
```

- [ ] **Step 2: Modify uploadDocument to save file after processing**

In the `uploadDocument` method (line 58), after `DocumentService.ProcessedDocument processed = ...`, before the log line `log.info("文档处理成功: {} ...`, add file saving. Wrap the existing try block to save the file:

Replace the `try (InputStream inputStream = file.getInputStream()) { ... }` block (lines 80-96) with:

```java
            byte[] fileBytes = file.getBytes();

            try (InputStream processingStream = new java.io.ByteArrayInputStream(fileBytes)) {
                DocumentService.ProcessedDocument processed = documentService.processDocument(
                    processingStream,
                    filename
                );

                int embeddingCount = embeddingService.storeSegments(processed.segments());

                try (InputStream storageStream = new java.io.ByteArrayInputStream(fileBytes)) {
                    fileStorageService.saveFile(processed.documentId(), filename, storageStream);
                }

                log.info("文档处理成功: {} ({} 个片段)", filename, embeddingCount);

                return ResponseEntity.ok(new DocumentResponse(
                    processed.documentId(),
                    filename,
                    "文档处理成功",
                    embeddingCount
                ));
            }
```

- [ ] **Step 3: Modify uploadDocumentStream to save file after processing**

In `uploadDocumentStream` (line 111), similarly read file bytes first. Replace the inner try block that opens `file.getInputStream()` (lines 168-170) with:

```java
                byte[] fileBytes = file.getBytes();
                DocumentService.ProcessedDocument processed;
                try (InputStream processingStream = new java.io.ByteArrayInputStream(fileBytes)) {
                    processed = documentService.processDocument(processingStream, filename, callback);
                }
```

Then after `int embeddingCount = embeddingService.storeSegments(...)` (line 172), add:

```java
                try (InputStream storageStream = new java.io.ByteArrayInputStream(fileBytes)) {
                    fileStorageService.saveFile(processed.documentId(), filename, storageStream);
                }
```

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/app/DocumentController.java
git commit -m "feat: save original files on upload"
```

---

### Task 4: Add public DTOs

**Files:**
- Create: `src/main/java/com/mark/knowledge/rag/dto/PublicDocumentListItem.java`
- Create: `src/main/java/com/mark/knowledge/rag/dto/PublicDocumentListResponse.java`
- Create: `src/main/java/com/mark/knowledge/rag/dto/PublicDocumentDetailResponse.java`
- Create: `src/main/java/com/mark/knowledge/rag/dto/PublicDocumentSegment.java`

- [ ] **Step 1: Create PublicDocumentSegment**

```java
package com.mark.knowledge.rag.dto;

public record PublicDocumentSegment(
    int chunkIndex,
    String text
) {}
```

- [ ] **Step 2: Create PublicDocumentListItem**

```java
package com.mark.knowledge.rag.dto;

public record PublicDocumentListItem(
    String documentId,
    String filename,
    String title,
    String category,
    String documentTime,
    String keywords,
    int segmentCount
) {}
```

- [ ] **Step 3: Create PublicDocumentListResponse**

```java
package com.mark.knowledge.rag.dto;

import java.util.List;

public record PublicDocumentListResponse(
    List<PublicDocumentListItem> documents,
    int total
) {}
```

- [ ] **Step 4: Create PublicDocumentDetailResponse**

```java
package com.mark.knowledge.rag.dto;

import java.util.List;

public record PublicDocumentDetailResponse(
    String documentId,
    String filename,
    String title,
    String category,
    String documentTime,
    String keywords,
    int segmentCount,
    List<PublicDocumentSegment> segments
) {}
```

- [ ] **Step 5: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/dto/PublicDocumentSegment.java \
        src/main/java/com/mark/knowledge/rag/dto/PublicDocumentListItem.java \
        src/main/java/com/mark/knowledge/rag/dto/PublicDocumentListResponse.java \
        src/main/java/com/mark/knowledge/rag/dto/PublicDocumentDetailResponse.java
git commit -m "feat: add public document DTOs"
```

---

### Task 5: Extend DocumentAdminService with public query methods

**Files:**
- Modify: `src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java`

- [ ] **Step 1: Add listPublicDocuments method**

Add a new method that queries Qdrant with extended payload fields (title, category, documentTime, keywords) and returns `PublicDocumentListResponse`:

```java
public PublicDocumentListResponse listPublicDocuments() {
    List<QdrantPoint> points = scrollAllPoints("documentId", "filename", "title", "category", "documentTime", "keywords");
    Map<String, DocumentAggregate> documents = new LinkedHashMap<>();

    for (QdrantPoint point : points) {
        String documentId = extractDocumentId(point.payload());
        if (documentId == null || documentId.isBlank()) {
            continue;
        }
        String filename = extractFilename(point.payload());
        DocumentAggregate aggregate = documents.computeIfAbsent(
            documentId,
            ignored -> new DocumentAggregate(documentId, filename)
        );
        aggregate.increment();
        if ((aggregate.filename == null || aggregate.filename.isBlank())
                && filename != null && !filename.isBlank()) {
            aggregate.filename = filename;
        }
        if (aggregate.title == null && point.payload().get("title") != null) {
            aggregate.title = String.valueOf(point.payload().get("title"));
        }
        if (aggregate.category == null && point.payload().get("category") != null) {
            aggregate.category = String.valueOf(point.payload().get("category"));
        }
        if (aggregate.documentTime == null && point.payload().get("documentTime") != null) {
            aggregate.documentTime = String.valueOf(point.payload().get("documentTime"));
        }
        if (aggregate.keywords == null && point.payload().get("keywords") != null) {
            aggregate.keywords = String.valueOf(point.payload().get("keywords"));
        }
    }

    List<PublicDocumentListItem> items = documents.values().stream()
        .map(item -> new PublicDocumentListItem(
            item.documentId,
            item.filenameOrFallback(),
            item.title != null ? item.title : "",
            item.category != null ? item.category : "",
            item.documentTime != null ? item.documentTime : "",
            item.keywords != null ? item.keywords : "",
            item.segmentCount
        ))
        .toList();

    return new PublicDocumentListResponse(items, items.size());
}
```

- [ ] **Step 2: Add getPublicDocumentDetail method**

```java
public PublicDocumentDetailResponse getPublicDocumentDetail(String documentId) {
    // Use scrollAllWithFullPayload to get ALL payload fields including text content
    List<QdrantPoint> points = scrollAllWithFullPayload();

    List<QdrantPoint> docPoints = points.stream()
        .filter(p -> documentId.equals(extractDocumentId(p.payload())))
        .toList();

    if (docPoints.isEmpty()) {
        return null;
    }

    QdrantPoint first = docPoints.getFirst();
    String filename = extractFilename(first.payload());
    String title = asString(first.payload().get("title"));
    String category = asString(first.payload().get("category"));
    String documentTime = asString(first.payload().get("documentTime"));
    String keywords = asString(first.payload().get("keywords"));

    // langchain4j QdrantEmbeddingStore stores text under "text_content" key by default
    List<PublicDocumentSegment> segments = docPoints.stream()
        .map(p -> {
            String idx = asString(p.payload().get("chunkIndex"));
            String text = extractTextContent(p.payload());
            return new PublicDocumentSegment(
                idx != null ? Integer.parseInt(idx) : 0,
                text
            );
        })
        .filter(s -> s.text() != null && !s.text().isBlank())
        .sorted(java.util.Comparator.comparingInt(PublicDocumentSegment::chunkIndex))
        .toList();

    return new PublicDocumentDetailResponse(
        documentId,
        filename != null ? filename : "",
        title != null ? title : "",
        category != null ? category : "",
        documentTime != null ? documentTime : "",
        keywords != null ? keywords : "",
        docPoints.size(),
        segments
    );
}

private String extractTextContent(Map<String, Object> payload) {
    // Try common langchain4j text payload keys
    for (String key : List.of("text_content", "text", "")) {
        String value = asString(payload.get(key));
        if (value != null && !value.isBlank()) {
            return value;
        }
    }
    return null;
}
```

- [ ] **Step 3: Modify scrollAllPoints to accept payload fields**

Change `scrollAllPoints()` to accept varargs:

```java
private List<QdrantPoint> scrollAllPoints(String... payloadFields) {
    List<QdrantPoint> points = new ArrayList<>();
    Object nextOffset = null;

    do {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("limit", SCROLL_PAGE_SIZE);
        requestBody.put("with_payload", List.of(payloadFields));
        requestBody.put("with_vector", false);
        if (nextOffset != null) {
            requestBody.put("offset", nextOffset);
        }

        Map<String, Object> response = webClient.post()
            .uri("/collections/" + collectionName + "/points/scroll")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        Map<String, Object> result = asMap(response != null ? response.get("result") : null);
        List<Map<String, Object>> pointMaps = asListOfMaps(result.get("points"));
        for (Map<String, Object> pointMap : pointMaps) {
            points.add(new QdrantPoint(pointMap.get("id"), asMap(pointMap.get("payload"))));
        }
        nextOffset = result.get("next_page_offset");
    } while (nextOffset != null);

    return points;
}
```

Also add `scrollAllWithFullPayload()` for the detail endpoint (needs all payload fields including text):

```java
private List<QdrantPoint> scrollAllWithFullPayload() {
    List<QdrantPoint> points = new ArrayList<>();
    Object nextOffset = null;

    do {
        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("limit", SCROLL_PAGE_SIZE);
        requestBody.put("with_payload", true);
        requestBody.put("with_vector", false);
        if (nextOffset != null) {
            requestBody.put("offset", nextOffset);
        }

        Map<String, Object> response = webClient.post()
            .uri("/collections/" + collectionName + "/points/scroll")
            .contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
            .block();

        Map<String, Object> result = asMap(response != null ? response.get("result") : null);
        List<Map<String, Object>> pointMaps = asListOfMaps(result.get("points"));
        for (Map<String, Object> pointMap : pointMaps) {
            points.add(new QdrantPoint(pointMap.get("id"), asMap(pointMap.get("payload"))));
        }
        nextOffset = result.get("next_page_offset");
    } while (nextOffset != null);

    return points;
}
```

Update the existing `listDocuments()` to call `scrollAllPoints("documentId", "filename", "metadata")`.

- [ ] **Step 4: Add missing fields to DocumentAggregate**

Add fields `title`, `category`, `documentTime`, `keywords` to the inner `DocumentAggregate` class.

- [ ] **Step 5: Add necessary imports**

Add imports for `PublicDocumentListItem`, `PublicDocumentListResponse`, `PublicDocumentDetailResponse`, `PublicDocumentSegment`.

- [ ] **Step 6: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java
git commit -m "feat: add public document query methods to DocumentAdminService"
```

---

### Task 6: Add rate limiting filter

**Files:**
- Create: `src/main/java/com/mark/knowledge/config/RateLimitFilter.java`

- [ ] **Step 1: Create RateLimitFilter**

```java
package com.mark.knowledge.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final int PUBLIC_LIST_LIMIT = 30;
    private static final int DOWNLOAD_LIMIT = 10;
    private static final long WINDOW_MS = 60_000;
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private volatile long lastCleanupTime = System.currentTimeMillis();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/documents/public")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        boolean isDownload = path.endsWith("/download");
        int maxTokens = isDownload ? DOWNLOAD_LIMIT : PUBLIC_LIST_LIMIT;
        String key = clientIp + ":" + (isDownload ? "dl" : "list");

        TokenBucket bucket = buckets.computeIfAbsent(key,
            k -> new TokenBucket(maxTokens, WINDOW_MS));

        if (!bucket.tryConsume()) {
            log.warn("请求限流: ip={}, path={}", clientIp, path);
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getOutputStream(), Map.of(
                "error", "请求过于频繁",
                "message", "请稍后再试",
                "timestamp", LocalDateTime.now().toString()
            ));
            return;
        }

        cleanupStaleBuckets();
        filterChain.doFilter(request, response);
    }

    private void cleanupStaleBuckets() {
        long now = System.currentTimeMillis();
        if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
            return;
        }
        lastCleanupTime = now;
        buckets.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            return xfHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class TokenBucket {
        private final int maxTokens;
        private final long windowMs;
        private int tokens;
        private long lastRefillTime;

        TokenBucket(int maxTokens, long windowMs) {
            this.maxTokens = maxTokens;
            this.windowMs = windowMs;
            this.tokens = maxTokens;
            this.lastRefillTime = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            refill();
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTime;
            if (elapsed >= windowMs) {
                tokens = maxTokens;
                lastRefillTime = now;
            }
        }

        boolean isExpired(long now) {
            return (now - lastRefillTime) > windowMs * 2;
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/mark/knowledge/config/RateLimitFilter.java
git commit -m "feat: add IP-based rate limiting for public document endpoints"
```

---

### Task 7: Add public endpoints to DocumentController

**Files:**
- Modify: `src/main/java/com/mark/knowledge/rag/app/DocumentController.java`

- [ ] **Step 1: Add public document listing endpoint**

```java
@GetMapping("/public")
public ResponseEntity<?> listPublicDocuments() {
    try {
        return ResponseEntity.ok(documentAdminService.listPublicDocuments());
    } catch (Exception e) {
        log.error("获取公开文档列表失败", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("查询失败", e.getMessage()));
    }
}
```

- [ ] **Step 2: Add public document detail endpoint**

```java
@GetMapping("/public/{documentId}")
public ResponseEntity<?> getPublicDocumentDetail(@PathVariable String documentId) {
    try {
        PublicDocumentDetailResponse detail = documentAdminService.getPublicDocumentDetail(documentId);
        if (detail == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("未找到文档", "文档不存在"));
        }
        return ResponseEntity.ok(detail);
    } catch (Exception e) {
        log.error("获取公开文档详情失败: {}", documentId, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("查询失败", e.getMessage()));
    }
}
```

- [ ] **Step 3: Add public file download endpoint**

```java
@GetMapping("/public/{documentId}/download")
public ResponseEntity<?> downloadFile(@PathVariable String documentId) {
    try {
        PublicDocumentDetailResponse detail = documentAdminService.getPublicDocumentDetail(documentId);
        if (detail == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("未找到文档", "文档不存在"));
        }

        Path filePath = fileStorageService.getFilePath(documentId, detail.filename());
        if (filePath == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("文件不存在", "原始文件未找到"));
        }

        String contentType = detail.filename().toLowerCase().endsWith(".pdf")
            ? MediaType.APPLICATION_PDF_VALUE
            : MediaType.TEXT_PLAIN_VALUE;

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(contentType))
            .header("Content-Disposition",
                "attachment; filename=\"" + java.net.URLEncoder.encode(detail.filename(), "UTF-8") + "\"")
            .header("Content-Length", String.valueOf(Files.size(filePath)))
            .body(filePath.toFile());
    } catch (Exception e) {
        log.error("文件下载失败: {}", documentId, e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("下载失败", e.getMessage()));
    }
}
```

Add necessary imports: `java.nio.file.Files`, `java.nio.file.Path`, `java.net.URLEncoder`, `PublicDocumentDetailResponse`.

- [ ] **Step 4: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/app/DocumentController.java
git commit -m "feat: add public document viewing and download endpoints"
```

---

### Task 8: Update SecurityConfig for public endpoints

**Files:**
- Modify: `src/main/java/com/mark/knowledge/auth/config/SecurityConfig.java:41-48`

- [ ] **Step 1: Add public document routes to permitAll**

In `SecurityConfig.securityFilterChain`, add a new `requestMatchers` line before the authenticated documents rule:

```java
.requestMatchers("/api/documents/public/**").permitAll()
```

The authorize block should become:

```java
.authorizeHttpRequests(authorize -> authorize
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
    .requestMatchers("/api/rag/**").permitAll()
    .requestMatchers("/api/documents/health").permitAll()
    .requestMatchers("/api/documents/public/**").permitAll()
    .requestMatchers("/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/me").permitAll()
    .requestMatchers("/api/auth/registration-codes/**").hasRole("ADMIN")
    .requestMatchers("/api/documents/**").authenticated()
    .anyRequest().permitAll()
)
```

- [ ] **Step 2: Commit**

```bash
git add src/main/java/com/mark/knowledge/auth/config/SecurityConfig.java
git commit -m "feat: allow unauthenticated access to public document endpoints"
```

---

### Task 9: Update document deletion to clean up stored files

**Files:**
- Modify: `src/main/java/com/mark/knowledge/rag/app/DocumentController.java` (deleteDocument method)

- [ ] **Step 1: Add file cleanup to deleteDocument**

In the `deleteDocument` method, after the delete succeeds and before returning the response, add file cleanup:

```java
DocumentDeleteResponse response = documentAdminService.deleteByDocumentId(documentId);
if (response.deletedSegments() > 0) {
    try {
        fileStorageService.deleteFile(documentId, response.filename());
    } catch (Exception e) {
        log.warn("删除文件失败（非关键）: {}", documentId, e);
    }
}
```

Note: This requires `DocumentDeleteResponse` to carry the `filename`. Check the existing record - if it doesn't have filename, add it.

- [ ] **Step 2: Update DocumentDeleteResponse to include filename**

The existing record at `src/main/java/com/mark/knowledge/rag/dto/DocumentDeleteResponse.java` is:

```java
public record DocumentDeleteResponse(
    String documentId,
    int deletedSegments,
    String message
) {}
```

Add `filename` field:

```java
public record DocumentDeleteResponse(
    String documentId,
    String filename,
    int deletedSegments,
    String message
) {}
```

Then update `DocumentAdminService.deleteByDocumentId()` to return the filename. Before deleting points, capture the filename from the first matching point:

```java
String filename = pointIds.isEmpty() ? null
    : extractFilename(scrollAllPoints("documentId", "filename").stream()
        .filter(p -> documentId.equals(extractDocumentId(p.payload())))
        .findFirst()
        .map(QdrantPoint::payload)
        .orElse(null));
```

And update the return statement:

```java
return new DocumentDeleteResponse(documentId, filename, pointIds.size(), "文档删除成功");
```

Also update the "未找到" return:

```java
return new DocumentDeleteResponse(documentId, null, 0, "未找到对应文档");
```

- [ ] **Step 3: Commit**

```bash
git add src/main/java/com/mark/knowledge/rag/app/DocumentController.java \
        src/main/java/com/mark/knowledge/rag/dto/DocumentDeleteResponse.java \
        src/main/java/com/mark/knowledge/rag/service/DocumentAdminService.java
git commit -m "feat: clean up stored files on document deletion"
```

---

### Task 10: Build and verify

**Files:** None

- [ ] **Step 1: Run Maven build**

```bash
cd /d/git/RAG && mvn compile -q
```

Expected: BUILD SUCCESS

- [ ] **Step 2: Fix any compilation errors**

If compilation fails, read error output and fix. Common issues: missing imports, wrong method signatures.

- [ ] **Step 3: Commit any fixes**
