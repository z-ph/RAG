package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.service.BatchReindexService;
import com.mark.knowledge.rag.service.DocumentAdminService;
import com.mark.knowledge.rag.service.SegmentAdminService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin/documents")
public class AdminDocumentController {

    private static final Logger log = LoggerFactory.getLogger(AdminDocumentController.class);

    private final SegmentAdminService segmentAdminService;
    private final DocumentAdminService documentAdminService;
    private final BatchReindexService batchReindexService;

    public AdminDocumentController(
            SegmentAdminService segmentAdminService,
            DocumentAdminService documentAdminService,
            BatchReindexService batchReindexService) {
        this.segmentAdminService = segmentAdminService;
        this.documentAdminService = documentAdminService;
        this.batchReindexService = batchReindexService;
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

    @PostMapping("/reindex-all")
    public ResponseEntity<?> startBatchReindex() {
        try {
            String taskId = batchReindexService.startBatchReindex();
            var progress = batchReindexService.getProgress(taskId);
            return ResponseEntity.ok(Map.of(
                "taskId", taskId,
                "totalDocuments", progress.totalDocuments(),
                "status", progress.status().name()
            ));
        } catch (Exception e) {
            log.error("启动批处理重新索引失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("启动失败", e.getMessage()));
        }
    }

    @GetMapping("/reindex-all/{taskId}/status")
    public ResponseEntity<?> getBatchReindexProgress(@PathVariable String taskId) {
        try {
            var progress = batchReindexService.getProgress(taskId);
            return ResponseEntity.ok(progress);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("任务不存在", e.getMessage()));
        } catch (Exception e) {
            log.error("查询批处理重新索引进度失败: taskId={}", taskId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("查询失败", e.getMessage()));
        }
    }

    @PostMapping("/{documentId}/reindex")
    public ResponseEntity<?> reindexDocument(@PathVariable String documentId) {
        try {
            var result = batchReindexService.reindexSingleDocument(documentId);
            if (result.status() == BatchReindexService.ReindexResultStatus.FAILED) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("重新索引失败", result.error()));
            }
            return ResponseEntity.ok(Map.of(
                "message", "重新索引完成",
                "documentId", result.documentId(),
                "deletedSegments", result.deletedSegments(),
                "newSegments", result.segmentCount()
            ));
        } catch (Exception e) {
            log.error("重新索引失败: documentId={}", documentId, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("重新索引失败", e.getMessage()));
        }
    }

}
