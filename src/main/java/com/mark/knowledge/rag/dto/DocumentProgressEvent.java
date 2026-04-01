package com.mark.knowledge.rag.dto;

/**
 * 文档处理进度事件
 *
 * @param stage 当前阶段
 * @param message 进度描述
 * @param current 当前进度值
 * @param total 总进度值
 * @param percent 百分比 (0-100)
 * @param documentId 文档ID（如果有）
 * @param filename 文件名
 */
public record DocumentProgressEvent(
    ProgressStage stage,
    String message,
    int current,
    int total,
    int percent,
    String documentId,
    String filename
) {
    public DocumentProgressEvent {
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
    }

    public static DocumentProgressEvent start(String filename) {
        return new DocumentProgressEvent(
            ProgressStage.PARSE_START,
            "开始解析文档: " + filename,
            0, 100, 0,
            null, filename
        );
    }

    public static DocumentProgressEvent parseComplete(String filename, int charCount) {
        return new DocumentProgressEvent(
            ProgressStage.PARSE_COMPLETE,
            "文档解析完成，共 " + charCount + " 字符",
            10, 100, 10,
            null, filename
        );
    }

    public static DocumentProgressEvent segmentStart(int segmentCount) {
        return new DocumentProgressEvent(
            ProgressStage.SEGMENT_START,
            "开始切分文本...",
            10, 100, 10,
            null, null
        );
    }

    public static DocumentProgressEvent segmentComplete(int segmentCount) {
        return new DocumentProgressEvent(
            ProgressStage.SEGMENT_COMPLETE,
            "文本切分完成，共 " + segmentCount + " 段",
            20, 100, 20,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingGenerateStart(int total) {
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_GENERATE_START,
            "开始生成嵌入向量...",
            20, 100, 20,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingGenerateProgress(int current, int total) {
        int percent = 20 + (int) ((current * 30.0) / total);
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_GENERATE_PROGRESS,
            "生成嵌入向量: " + current + "/" + total,
            current, total, percent,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingGenerateComplete(int count) {
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_GENERATE_COMPLETE,
            "嵌入向量生成完成，共 " + count + " 个",
            50, 100, 50,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingStoreStart(int total) {
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_STORE_START,
            "开始存储到向量数据库...",
            50, 100, 50,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingStoreProgress(int current, int total) {
        int percent = 50 + (int) ((current * 45.0) / total);
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_STORE_PROGRESS,
            "存储向量: " + current + "/" + total,
            current, total, percent,
            null, null
        );
    }

    public static DocumentProgressEvent embeddingStoreComplete(int count) {
        return new DocumentProgressEvent(
            ProgressStage.EMBEDDING_STORE_COMPLETE,
            "向量存储完成，共 " + count + " 个",
            95, 100, 95,
            null, null
        );
    }

    public static DocumentProgressEvent complete(String documentId, String filename, int segmentCount) {
        return new DocumentProgressEvent(
            ProgressStage.COMPLETE,
            "文档处理完成",
            100, 100, 100,
            documentId, filename
        );
    }

    public static DocumentProgressEvent error(String message) {
        return new DocumentProgressEvent(
            ProgressStage.ERROR,
            "处理失败: " + message,
            0, 100, 0,
            null, null
        );
    }
}
