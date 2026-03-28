package com.mark.knowledge.rag.service;

import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;

/**
 * 嵌入服务 - 使用当前配置的嵌入模型生成和管理嵌入向量
 *
 * 服务职责：
 * - 为文本块生成嵌入向量
 * - 将嵌入向量存储到Qdrant向量数据库
 * - 批量处理和进度跟踪
 * - 性能监控和日志记录
 */
@Service
public class EmbeddingService {

    private static final Logger log = LoggerFactory.getLogger(EmbeddingService.class);

    private final EmbeddingModel embeddingModel;
    private final QdrantEmbeddingStoreFactory embeddingStoreFactory;

    @Value("${rag.embedding-request.batch-size:10}")
    private int embeddingRequestBatchSize;

    @Value("${rag.embedding-store.batch-size:32}")
    private int embeddingStoreBatchSize;

    @Value("${rag.embedding-store.max-retries:3}")
    private int embeddingStoreMaxRetries;

    @Value("${rag.embedding-store.retry-backoff-ms:1000}")
    private long embeddingStoreRetryBackoffMs;

    /**
     * 构造函数
     *
     * @param embeddingModel 当前配置的嵌入模型
     * @param embeddingStore Qdrant向量存储
     */
    public EmbeddingService(
            EmbeddingModel embeddingModel,
            QdrantEmbeddingStoreFactory embeddingStoreFactory) {
        this.embeddingModel = embeddingModel;
        this.embeddingStoreFactory = embeddingStoreFactory;
    }

    /**
     * 为文本块生成并存储嵌入向量
     *
     * 处理流程：
     * 1. 使用当前配置的模型生成嵌入向量
     * 2. 批量存储到Qdrant（批次大小可配置）
     * 3. 记录进度和性能指标
     *
     * @param segments 文本块列表
     * @return 成功创建的嵌入向量数量
     */
    public int storeSegments(List<TextSegment> segments) {
        long startTime = System.currentTimeMillis();

        if (segments == null || segments.isEmpty()) {
            throw new IllegalArgumentException("没有可存储的文本块，可能已被短文本或重复文本过滤");
        }

        log.info("==========================================");
        log.info("嵌入向量存储开始");
        log.info("  待处理文本块总数: {}", segments.size());
        log.info("==========================================");

        try {
            // 步骤1：生成嵌入向量
            log.info("🔢 [步骤1/2] 为 {} 个文本块生成嵌入向量...", segments.size());
            long embedStart = System.currentTimeMillis();
            int requestBatchSize = Math.max(1, embeddingRequestBatchSize);
            log.info("  Embedding请求批次大小: {}", requestBatchSize);

            List<Embedding> embeddings = generateEmbeddings(segments, requestBatchSize);

            long embedTime = System.currentTimeMillis() - embedStart;
            log.info("✓ 嵌入向量生成成功，耗时: {} ms", embedTime);
            log.info("  向量维度: {}", embeddings.getFirst().dimension());

            // 步骤2：存储嵌入向量
            log.info("💾 [步骤2/2] 存储嵌入向量到Qdrant...");
            long storeStart = System.currentTimeMillis();

            int batchSize = Math.max(1, embeddingStoreBatchSize);
            int retryCount = Math.max(0, embeddingStoreMaxRetries);
            long retryBackoffMs = Math.max(0L, embeddingStoreRetryBackoffMs);
            int totalStored = 0;
            QdrantEmbeddingStore activeStore = embeddingStoreFactory.createStore();

            log.info("  Qdrant目标: {}", embeddingStoreFactory.describeTarget());
            log.info("  写入批次大小: {}", batchSize);
            log.info("  单批最大重试次数: {}", retryCount);

            try {
                for (int i = 0; i < segments.size(); i += batchSize) {
                    int endIndex = Math.min(i + batchSize, segments.size());
                    int batchCount = endIndex - i;

                    List<Embedding> embeddingBatch = embeddings.subList(i, endIndex);
                    List<TextSegment> segmentBatch = segments.subList(i, endIndex);

                    activeStore = writeBatchWithRetry(
                        activeStore,
                        embeddingBatch,
                        segmentBatch,
                        i,
                        endIndex,
                        segments.size(),
                        retryCount,
                        retryBackoffMs
                    );
                    totalStored += batchCount;

                    double progress = (endIndex * 100.0) / segments.size();
                    log.info("  进度: {}/{} 文本块 ({}%) 已存储",
                             endIndex, segments.size(), String.format("%.1f", progress));
                }
            } finally {
                closeQuietly(activeStore);
            }

            long storeTime = System.currentTimeMillis() - storeStart;
            log.info("✓ 所有嵌入向量存储成功，耗时: {} ms", storeTime);

            long totalTime = System.currentTimeMillis() - startTime;
            log.info("==========================================");
            log.info("嵌入向量存储完成");
            log.info("  已存储嵌入向量总数: {}", totalStored);
            log.info("  嵌入生成耗时: {} ms", embedTime);
            log.info("  向量存储耗时: {} ms", storeTime);
            log.info("  总耗时: {} ms", totalTime);
            log.info("  平均每个嵌入耗时: {} ms",
                     String.format("%.2f", (double)totalTime / totalStored));
            log.info("==========================================");

            return totalStored;

        } catch (Exception e) {
            long totalTime = System.currentTimeMillis() - startTime;
            log.error("==========================================");
            log.error("嵌入向量存储失败");
            log.error("  待处理文本块数: {}", segments.size());
            log.error("  已用时间: {} ms", totalTime);
            log.error("  错误: {}", e.getMessage(), e);
            log.error("==========================================");
            throw new RuntimeException("嵌入向量存储失败: " + e.getMessage(), e);
        }
    }

    private List<Embedding> generateEmbeddings(List<TextSegment> segments, int requestBatchSize) {
        List<Embedding> embeddings = new ArrayList<>(segments.size());

        for (int i = 0; i < segments.size(); i += requestBatchSize) {
            int endIndex = Math.min(i + requestBatchSize, segments.size());
            List<TextSegment> segmentBatch = segments.subList(i, endIndex);

            Response<List<Embedding>> response = embeddingModel.embedAll(segmentBatch);
            if (response == null) {
                throw new IllegalStateException(
                    "嵌入模型未返回响应: range=%d-%d/%d".formatted(i + 1, endIndex, segments.size())
                );
            }

            List<Embedding> embeddingBatch = response.content();
            if (embeddingBatch == null || embeddingBatch.size() != segmentBatch.size()) {
                int actualSize = embeddingBatch == null ? 0 : embeddingBatch.size();
                throw new IllegalStateException(
                    "嵌入向量数量不匹配: range=%d-%d/%d, expected=%d, actual=%d"
                        .formatted(i + 1, endIndex, segments.size(), segmentBatch.size(), actualSize)
                );
            }

            embeddings.addAll(embeddingBatch);

            if (segments.size() > requestBatchSize) {
                double progress = (endIndex * 100.0) / segments.size();
                log.info("  Embedding进度: {}/{} 文本块 ({}%) 已生成",
                    endIndex, segments.size(), String.format("%.1f", progress));
            }
        }

        return embeddings;
    }

    private QdrantEmbeddingStore writeBatchWithRetry(
            QdrantEmbeddingStore activeStore,
            List<Embedding> embeddingBatch,
            List<TextSegment> segmentBatch,
            int startIndex,
            int endIndex,
            int totalSegments,
            int maxRetries,
            long retryBackoffMs) {
        int maxAttempts = Math.max(1, maxRetries + 1);
        QdrantEmbeddingStore currentStore = activeStore;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (currentStore == null) {
                    currentStore = embeddingStoreFactory.createStore();
                }
                currentStore.addAll(embeddingBatch, segmentBatch);
                return currentStore;
            } catch (Exception e) {
                Throwable rootCause = rootCause(e);
                boolean retryable = isRetryableStoreException(e);
                log.warn(
                    "Qdrant批次写入失败: range={}-{} / {}, batchSize={}, attempt={}/{}, endpoint={}, retryable={}, errorType={}, rootCause={}",
                    startIndex + 1,
                    endIndex,
                    totalSegments,
                    embeddingBatch.size(),
                    attempt,
                    maxAttempts,
                    embeddingStoreFactory.describeTarget(),
                    retryable,
                    e.getClass().getSimpleName(),
                    safeMessage(rootCause),
                    e
                );

                closeQuietly(currentStore);
                currentStore = null;

                if (!retryable || attempt >= maxAttempts) {
                    throw new RuntimeException(
                        "Qdrant批次写入失败: range=%d-%d/%d, attempt=%d/%d, cause=%s"
                            .formatted(startIndex + 1, endIndex, totalSegments, attempt, maxAttempts, safeMessage(rootCause)),
                        e
                    );
                }

                sleepBeforeRetry(retryBackoffMs, attempt, startIndex, endIndex, totalSegments, maxAttempts);
            }
        }

        throw new IllegalStateException("未命中的重试终止条件");
    }

    private boolean isRetryableStoreException(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (current instanceof StatusRuntimeException statusRuntimeException) {
                Status.Code code = statusRuntimeException.getStatus().getCode();
                if (code == Status.Code.UNAVAILABLE
                    || code == Status.Code.DEADLINE_EXCEEDED
                    || code == Status.Code.RESOURCE_EXHAUSTED
                    || code == Status.Code.INTERNAL) {
                    return true;
                }
            }

            String message = current.getMessage();
            if (message != null) {
                String normalized = message.toLowerCase(Locale.ROOT);
                if (normalized.contains("connection reset")
                    || normalized.contains("connection refused")
                    || normalized.contains("broken pipe")
                    || normalized.contains("io exception")
                    || normalized.contains("channel shutdown")
                    || normalized.contains("goaway")
                    || normalized.contains("unavailable")) {
                    return true;
                }
            }

            current = current.getCause();
        }
        return false;
    }

    private Throwable rootCause(Throwable error) {
        Throwable current = error;
        while (current != null && current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current == null ? error : current;
    }

    private String safeMessage(Throwable error) {
        if (error == null || error.getMessage() == null || error.getMessage().isBlank()) {
            return "unknown";
        }
        return error.getMessage();
    }

    private void sleepBeforeRetry(
            long retryBackoffMs,
            int attempt,
            int startIndex,
            int endIndex,
            int totalSegments,
            int maxAttempts) {
        long sleepMs = Math.max(0L, retryBackoffMs) * attempt;
        if (sleepMs == 0L) {
            log.info("重建Qdrant连接后立即重试批次: range={}-{} / {}, nextAttempt={}/{}",
                startIndex + 1, endIndex, totalSegments, attempt + 1, maxAttempts);
            return;
        }

        log.info("等待 {} ms 后重试Qdrant批次写入: range={}-{} / {}, nextAttempt={}/{}",
            sleepMs, startIndex + 1, endIndex, totalSegments, attempt + 1, maxAttempts);
        try {
            Thread.sleep(sleepMs);
        } catch (InterruptedException interruptedException) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("Qdrant批次重试等待被中断", interruptedException);
        }
    }

    private void closeQuietly(QdrantEmbeddingStore store) {
        if (store == null) {
            return;
        }
        try {
            store.close();
        } catch (Exception e) {
            log.debug("关闭Qdrant store时忽略异常: {}", e.getMessage());
        }
    }
}
