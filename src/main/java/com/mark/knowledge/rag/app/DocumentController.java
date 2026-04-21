package com.mark.knowledge.rag.app;


import com.mark.knowledge.rag.dto.DocumentDeleteResponse;
import com.mark.knowledge.rag.dto.DocumentProgressEvent;
import com.mark.knowledge.rag.dto.DocumentResponse;
import com.mark.knowledge.rag.dto.DownloadUrlResponse;
import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.dto.ProgressStage;
import com.mark.knowledge.rag.dto.PublicDocumentDetailResponse;
import com.mark.knowledge.rag.service.DocumentAdminService;
import com.mark.knowledge.rag.service.DocumentProgressCallback;
import com.mark.knowledge.rag.service.DocumentService;
import com.mark.knowledge.rag.service.EmbeddingService;
import com.mark.knowledge.rag.service.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 文档上传和管理控制器
 *
 * @author mark
 */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);

    private final DocumentService documentService;
    private final EmbeddingService embeddingService;
    private final DocumentAdminService documentAdminService;
    private final FileStorageService fileStorageService;
    private final ExecutorService sseExecutor = Executors.newCachedThreadPool();

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

    /**
     * 上传并处理文档
     *
     * @param file 文档文件（PDF 或 TXT 格式）
     * @return 处理结果
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadDocument(@RequestParam("file") MultipartFile file) {
        log.info("收到文档上传请求: {}", file.getOriginalFilename());

        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效文件", "文件为空"));
            }

            String filename = file.getOriginalFilename();
            if (filename == null || filename.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效文件", "文件名缺失"));
            }

            String lowerFilename = filename.toLowerCase(Locale.ROOT);
            if (!lowerFilename.endsWith(".pdf") && !lowerFilename.endsWith(".txt")) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("不支持的文件类型", "仅支持 PDF 和 TXT 文件"));
            }

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

        } catch (Exception e) {
            log.error("文档处理失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("处理失败", e.getMessage()));
        }
    }

    /**
     * 上传并处理文档（SSE 流式进度）
     *
     * @param file 文档文件
     * @return SSE Emitter
     */
    @PostMapping(value = "/upload/stream", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SseEmitter uploadDocumentStream(@RequestParam("file") MultipartFile file) {
        // 1小时超时，足以处理大文件
        SseEmitter emitter = new SseEmitter(3_600_000L);

        sseExecutor.execute(() -> {
            String filename = file.getOriginalFilename();
            log.info("收到 SSE 文档上传请求: {}", filename);

            try {
                if (file.isEmpty()) {
                    emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"message\": \"文件为空\", \"error\": \"无效文件\"}"));
                    emitter.complete();
                    return;
                }

                if (filename == null || filename.isBlank()) {
                    emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"message\": \"文件名缺失\", \"error\": \"无效文件\"}"));
                    emitter.complete();
                    return;
                }

                String lowerFilename = filename.toLowerCase(Locale.ROOT);
                if (!lowerFilename.endsWith(".pdf") && !lowerFilename.endsWith(".txt")) {
                    emitter.send(SseEmitter.event()
                        .name("error")
                        .data("{\"message\": \"仅支持 PDF 和 TXT 文件\", \"error\": \"不支持的文件类型\"}"));
                    emitter.complete();
                    return;
                }

                // 进度回调
                DocumentProgressCallback callback = event -> {
                    try {
                        String json = String.format(
                            "{\"stage\": \"%s\", \"message\": \"%s\", \"current\": %d, \"total\": %d, \"percent\": %d, \"documentId\": %s, \"filename\": %s}",
                            event.stage().name(),
                            event.message().replace("\"", "\\\""),
                            event.current(),
                            event.total(),
                            event.percent(),
                            event.documentId() != null ? "\"" + event.documentId() + "\"" : "null",
                            event.filename() != null ? "\"" + event.filename() + "\"" : "null"
                        );
                        emitter.send(SseEmitter.event()
                            .name("progress")
                            .data(json));
                    } catch (Exception e) {
                        log.warn("发送进度事件失败", e);
                    }
                };

                byte[] fileBytes = file.getBytes();
                DocumentService.ProcessedDocument processed;
                try (InputStream processingStream = new java.io.ByteArrayInputStream(fileBytes)) {
                    processed = documentService.processDocument(processingStream, filename, callback);
                }

                int embeddingCount = embeddingService.storeSegments(processed.segments(), callback);

                try (InputStream storageStream = new java.io.ByteArrayInputStream(fileBytes)) {
                    fileStorageService.saveFile(processed.documentId(), filename, storageStream);
                }

                // 发送完成事件
                String completeJson = String.format(
                    "{\"stage\": \"%s\", \"message\": \"文档处理完成\", \"current\": 100, \"total\": 100, \"percent\": 100, \"documentId\": \"%s\", \"filename\": \"%s\", \"segmentCount\": %d}",
                    ProgressStage.COMPLETE.name(),
                    processed.documentId(),
                    filename,
                    embeddingCount
                );
                emitter.send(SseEmitter.event()
                    .name("complete")
                    .data(completeJson));

                log.info("SSE 文档处理成功: {} ({} 个片段)", filename, embeddingCount);
                emitter.complete();

            } catch (Exception e) {
                log.error("SSE 文档处理失败", e);
                try {
                    String errorJson = String.format(
                        "{\"stage\": \"%s\", \"message\": \"%s\", \"error\": \"%s\"}",
                        ProgressStage.ERROR.name(),
                        e.getMessage().replace("\"", "\\\""),
                        e.getClass().getSimpleName()
                    );
                    emitter.send(SseEmitter.event()
                        .name("error")
                        .data(errorJson));
                } catch (Exception ex) {
                    log.error("发送错误事件失败", ex);
                }
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }
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

    /**
     * 获取临时下载链接（返回 JSON 响应）
     */
    @GetMapping("/public/{documentId}/download-url")
    public ResponseEntity<?> getDownloadUrl(@PathVariable String documentId) {
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

            String downloadUrl = "/documents/public/" + documentId + "/download";
            return ResponseEntity.ok(new DownloadUrlResponse(downloadUrl, detail.filename()));
        } catch (Exception e) {
            log.error("获取下载链接失败：{}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("获取链接失败", e.getMessage()));
        }
    }

    /**
     * 执行文件下载
     */
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

            String contentType = detail.filename().toLowerCase(Locale.ROOT).endsWith(".pdf")
                ? MediaType.APPLICATION_PDF_VALUE
                : MediaType.TEXT_PLAIN_VALUE;

            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header("Content-Disposition",
                    "attachment; filename=\"" + URLEncoder.encode(detail.filename(), "UTF-8") + "\"")
                .header("Content-Length", String.valueOf(Files.size(filePath)))
                .body(filePath.toFile());
        } catch (Exception e) {
            log.error("文件下载失败: {}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("下载失败", e.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> listDocuments() {
        try {
            return ResponseEntity.ok(documentAdminService.listDocuments());
        } catch (Exception e) {
            log.error("获取文档列表失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("查询失败", e.getMessage()));
        }
    }

    /**
     * 删除指定文档
     *
     * @param documentId 文档ID
     * @return 删除结果
     */
    @DeleteMapping("/{documentId}")
    public ResponseEntity<?> deleteDocument(@PathVariable String documentId) {
        try {
            DocumentDeleteResponse response = documentAdminService.deleteByDocumentId(documentId);
            if (response.deletedSegments() == 0) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("未找到文档", "未找到 documentId=" + documentId + " 对应的知识文档"));
            }
            if (response.filename() != null) {
                try {
                    fileStorageService.deleteFile(documentId, response.filename());
                } catch (Exception e) {
                    log.warn("删除文件失败（非关键）: {}", documentId, e);
                }
            }
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("删除文档失败: {}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("删除失败", e.getMessage()));
        }
    }

    /**
     * 健康检查接口
     *
     * @return 健康状态
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("文档服务运行正常");
    }
}
