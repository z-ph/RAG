package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.DocumentListItemResponse;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 批量文档重新索引服务。
 *
 * <p>支持对所有已索引文档进行批量重建（删除旧片段 → 重新解析文件 → 重新嵌入向量），
 * 并提供异步进度查询。同时封装单个文档的重新索引逻辑，供
 * {@link com.mark.knowledge.rag.app.AdminDocumentController} 复用。</p>
 */
@Service
public class BatchReindexService {

    private static final Logger log = LoggerFactory.getLogger(BatchReindexService.class);

    private final DocumentAdminService documentAdminService;
    private final FileStorageService fileStorageService;
    private final DocumentService documentService;
    private final EmbeddingService embeddingService;
    private final SegmentAdminService segmentAdminService;

    private final ConcurrentHashMap<String, BatchReindexProgress> tasks = new ConcurrentHashMap<>();

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "batch-reindex");
        t.setDaemon(true);
        return t;
    });

    public BatchReindexService(
            DocumentAdminService documentAdminService,
            FileStorageService fileStorageService,
            DocumentService documentService,
            EmbeddingService embeddingService,
            SegmentAdminService segmentAdminService) {
        this.documentAdminService = documentAdminService;
        this.fileStorageService = fileStorageService;
        this.documentService = documentService;
        this.embeddingService = embeddingService;
        this.segmentAdminService = segmentAdminService;
    }

    /**
     * 启动批量重新索引任务。
     *
     * <p>如果已有正在运行的任务，直接返回该任务的 taskId，避免重复启动。</p>
     *
     * @return 任务ID
     */
    public String startBatchReindex() {
        for (var entry : tasks.entrySet()) {
            if (entry.getValue().status() == ReindexStatus.RUNNING) {
                log.info("批处理重新索引任务已在运行中，返回现有 taskId: {}", entry.getKey());
                return entry.getKey();
            }
        }

        var docList = resolveDocumentList();
        String taskId = UUID.randomUUID().toString();
        List<ReindexResult> results = new ArrayList<>();

        var progress = new BatchReindexProgress(
            taskId, ReindexStatus.RUNNING, docList.size(), 0, 0,
            null, results, Instant.now(), null
        );
        tasks.put(taskId, progress);

        var items = List.copyOf(docList);

        executor.submit(() -> {
            try {
                for (var item : items) {
                    ReindexResult result = reindexSingleDocumentInternal(item.documentId());
                    results.add(result);

                    int completed = results.size();
                    int failed = (int) results.stream()
                        .filter(r -> r.status() == ReindexResultStatus.FAILED).count();

                    var updated = new BatchReindexProgress(
                        taskId, ReindexStatus.RUNNING, items.size(), completed, failed,
                        item.filename(), results, progress.startTime(), null
                    );
                    tasks.put(taskId, updated);

                    log.info("批处理重新索引进度: taskId={}, {}/{}, documentId={}, status={}",
                        taskId, completed, items.size(), item.documentId(), result.status());
                }

                int totalFailed = (int) results.stream()
                    .filter(r -> r.status() == ReindexResultStatus.FAILED).count();
                ReindexStatus finalStatus = totalFailed == items.size()
                    ? ReindexStatus.FAILED : ReindexStatus.COMPLETED;

                var finalProgress = new BatchReindexProgress(
                    taskId, finalStatus, items.size(), items.size(), totalFailed,
                    null, results, progress.startTime(), Instant.now()
                );
                tasks.put(taskId, finalProgress);
                log.info("批处理重新索引完成: taskId={}, total={}, failed={}",
                    taskId, items.size(), totalFailed);
            } catch (Exception e) {
                log.error("批处理重新索引异常终止: taskId={}", taskId, e);
                int totalFailed = (int) results.stream()
                    .filter(r -> r.status() == ReindexResultStatus.FAILED).count();
                var failedProgress = new BatchReindexProgress(
                    taskId, ReindexStatus.FAILED, items.size(), results.size(), totalFailed,
                    null, results, progress.startTime(), Instant.now()
                );
                tasks.put(taskId, failedProgress);
            }
        });

        log.info("批处理重新索引已启动: taskId={}, totalDocuments={}", taskId, docList.size());
        return taskId;
    }

    /**
     * 获取待重建的文档列表，Qdrant 无数据时回退到本地文件系统。
     */
    private List<DocumentListItemResponse> resolveDocumentList() {
        var qdrantList = documentAdminService.listDocuments();
        if (qdrantList.total() > 0) {
            return qdrantList.documents();
        }

        List<FileStorageService.StoredDocument> stored = fileStorageService.listStoredDocuments();
        if (stored.isEmpty()) {
            log.warn("Qdrant 和本地文件系统均无文档数据");
            return List.of();
        }

        log.info("Qdrant 无文档数据，从本地文件系统发现 {} 个文档用于重建", stored.size());
        return stored.stream()
            .map(doc -> new DocumentListItemResponse(doc.documentId(), doc.filename(), 0))
            .toList();
    }

    /**
     * 查询批量重新索引任务的进度。
     *
     * @param taskId 任务ID
     * @return 任务进度
     * @throws IllegalArgumentException 如果任务不存在
     */
    public BatchReindexProgress getProgress(String taskId) {
        var progress = tasks.get(taskId);
        if (progress == null) {
            throw new IllegalArgumentException("任务不存在: " + taskId);
        }
        return progress;
    }

    /**
     * 重新索引单个文档。
     *
     * <p>核心流程：解析文件名 → 删除旧片段 → 重新解析原始文件 → 重新嵌入 → 返回结果。</p>
     *
     * @param documentId 文档ID
     * @return 重新索引结果
     */
    public ReindexResult reindexSingleDocument(String documentId) {
        return reindexSingleDocumentInternal(documentId);
    }

    private ReindexResult reindexSingleDocumentInternal(String documentId) {
        try {
            String filename = resolveFilename(documentId);
            if (filename == null || filename.isBlank()) {
                return new ReindexResult(
                    documentId, null, ReindexResultStatus.FAILED, 0, 0,
                    "无法找到原始文件进行重新索引"
                );
            }

            Path filePath = fileStorageService.getFilePath(documentId, filename);
            if (filePath == null) {
                return new ReindexResult(
                    documentId, filename, ReindexResultStatus.FAILED, 0, 0,
                    "原始文件未找到"
                );
            }

            List<SegmentAdminService.SegmentInfo> segments = segmentAdminService.listSegments(documentId);
            int deletedCount = 0;
            if (!segments.isEmpty()) {
                deletedCount = segmentAdminService.deleteByDocumentId(documentId);
                log.info("重新索引: 已删除旧片段 {} 个, documentId={}", deletedCount, documentId);
            } else {
                log.info("重新索引: documentId={} 当前无旧片段，直接按原文档ID恢复", documentId);
            }

            try (InputStream is = Files.newInputStream(filePath)) {
                DocumentService.ProcessedDocument processed = documentService.processDocument(
                    is, filename, documentId
                );
                int newCount = embeddingService.storeSegments(processed.segments());
                log.info("重新索引完成: documentId={}, deletedSegments={}, newSegments={}",
                    documentId, deletedCount, newCount);
                return new ReindexResult(
                    documentId, filename, ReindexResultStatus.SUCCESS, deletedCount, newCount, null
                );
            }
        } catch (Exception e) {
            log.error("重新索引失败: documentId={}", documentId, e);
            return new ReindexResult(
                documentId, null, ReindexResultStatus.FAILED, 0, 0, e.getMessage()
            );
        }
    }

    private String resolveFilename(String documentId) {
        try {
            var detail = documentAdminService.getPublicDocumentDetail(documentId);
            if (detail != null && detail.filename() != null && !detail.filename().isBlank()) {
                return detail.filename();
            }
        } catch (Exception e) {
            log.debug("通过 DocumentAdminService 解析文件名失败: {}", e.getMessage());
        }
        return fileStorageService.findStoredFilename(documentId);
    }

    @PreDestroy
    public void shutdown() {
        executor.shutdownNow();
    }

    // ---- 状态枚举 ----

    public enum ReindexStatus {
        RUNNING, COMPLETED, FAILED
    }

    public enum ReindexResultStatus {
        SUCCESS, FAILED
    }

    // ---- 记录类 ----

    /**
     * 批量重新索引任务进度。
     *
     * @param taskId             任务ID
     * @param status             任务状态
     * @param totalDocuments     总文档数
     * @param completedDocuments 已完成文档数
     * @param failedDocuments    失败文档数
     * @param currentDocument    当前正在处理的文档文件名
     * @param results            每个文档的处理结果
     * @param startTime          任务开始时间
     * @param endTime            任务结束时间（未完成时为 null）
     */
    public record BatchReindexProgress(
        String taskId,
        ReindexStatus status,
        int totalDocuments,
        int completedDocuments,
        int failedDocuments,
        String currentDocument,
        List<ReindexResult> results,
        Instant startTime,
        Instant endTime
    ) {}

    /**
     * 单个文档重新索引结果。
     *
     * @param documentId     文档ID
     * @param filename       文件名
     * @param status         处理状态
     * @param deletedSegments 已删除的旧片段数
     * @param segmentCount   新创建的片段数
     * @param error          错误信息（成功时为 null）
     */
    public record ReindexResult(
        String documentId,
        String filename,
        ReindexResultStatus status,
        int deletedSegments,
        int segmentCount,
        String error
    ) {}
}
