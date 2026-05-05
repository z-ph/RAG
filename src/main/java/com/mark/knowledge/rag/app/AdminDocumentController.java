package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.service.DocumentAdminService;
import com.mark.knowledge.rag.service.DocumentService;
import com.mark.knowledge.rag.service.EmbeddingService;
import com.mark.knowledge.rag.service.FileStorageService;
import com.mark.knowledge.rag.service.SegmentAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.InputStream;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/documents")
public class AdminDocumentController {

    private static final Logger log = LoggerFactory.getLogger(AdminDocumentController.class);

    private final SegmentAdminService segmentAdminService;
    private final DocumentService documentService;
    private final EmbeddingService embeddingService;
    private final FileStorageService fileStorageService;
    private final DocumentAdminService documentAdminService;

    public AdminDocumentController(
            SegmentAdminService segmentAdminService,
            DocumentService documentService,
            EmbeddingService embeddingService,
            FileStorageService fileStorageService,
            DocumentAdminService documentAdminService) {
        this.segmentAdminService = segmentAdminService;
        this.documentService = documentService;
        this.embeddingService = embeddingService;
        this.fileStorageService = fileStorageService;
        this.documentAdminService = documentAdminService;
    }

    @GetMapping("/{documentId}/segments")
    public ResponseEntity<?> listSegments(@PathVariable String documentId) {
        try {
            List<SegmentAdminService.SegmentInfo> segments = segmentAdminService.listSegments(documentId);
            return ResponseEntity.ok(Map.of(
                "documentId", documentId,
                "segments", segments,
                "total", segments.size()
            ));
        } catch (Exception e) {
            log.error("获取片段列表失败: documentId={}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("查询失败", e.getMessage()));
        }
    }

    @PutMapping("/{documentId}/segments/{pointId}")
    public ResponseEntity<?> updateSegment(
            @PathVariable String documentId,
            @PathVariable String pointId,
            @RequestBody Map<String, String> request) {
        try {
            String newText = request.get("text");
            if (newText == null || newText.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效请求", "text 不能为空"));
            }

            SegmentAdminService.SegmentInfo updated = segmentAdminService.updateSegment(pointId, newText);
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            log.error("更新片段失败: documentId={}, pointId={}", documentId, pointId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("更新失败", e.getMessage()));
        }
    }

    @DeleteMapping("/{documentId}/segments/{pointId}")
    public ResponseEntity<?> deleteSegment(
            @PathVariable String documentId,
            @PathVariable String pointId) {
        try {
            segmentAdminService.deleteSegment(pointId);
            return ResponseEntity.ok(Map.of("message", "片段删除成功", "pointId", pointId));
        } catch (Exception e) {
            log.error("删除片段失败: documentId={}, pointId={}", documentId, pointId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("删除失败", e.getMessage()));
        }
    }

    @PostMapping("/{documentId}/reindex")
    public ResponseEntity<?> reindexDocument(@PathVariable String documentId) {
        try {
            List<SegmentAdminService.SegmentInfo> segments = segmentAdminService.listSegments(documentId);
            if (segments.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("未找到文档", "documentId=" + documentId + " 没有片段"));
            }

            String filename = resolveFilename(documentId);
            if (filename == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("文件不存在", "无法找到原始文件进行重新索引"));
            }

            int deletedCount = segmentAdminService.deleteByDocumentId(documentId);
            log.info("重新索引: 已删除旧片段 {} 个, documentId={}", deletedCount, documentId);

            Path filePath = fileStorageService.getFilePath(documentId, filename);
            if (filePath == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("文件不存在", "原始文件未找到"));
            }

            try (InputStream is = java.nio.file.Files.newInputStream(filePath)) {
                DocumentService.ProcessedDocument processed = documentService.processDocument(is, filename);
                int newCount = embeddingService.storeSegments(processed.segments());

                return ResponseEntity.ok(Map.of(
                    "message", "重新索引完成",
                    "documentId", documentId,
                    "deletedSegments", deletedCount,
                    "newSegments", newCount
                ));
            }
        } catch (Exception e) {
            log.error("重新索引失败: documentId={}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("重新索引失败", e.getMessage()));
        }
    }

    private String resolveFilename(String documentId) {
        try {
            var detail = documentAdminService.getPublicDocumentDetail(documentId);
            return detail != null ? detail.filename() : null;
        } catch (Exception e) {
            log.debug("通过 DocumentAdminService 解析文件名失败: {}", e.getMessage());
            return null;
        }
    }
}
