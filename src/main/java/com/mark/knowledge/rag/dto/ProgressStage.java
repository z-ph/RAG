package com.mark.knowledge.rag.dto;

/**
 * 文档处理进度事件类型
 */
public enum ProgressStage {
    /**
     * 开始解析文档
     */
    PARSE_START,
    /**
     * 文档解析完成
     */
    PARSE_COMPLETE,
    /**
     * 开始文本清洗和分段
     */
    SEGMENT_START,
    /**
     * 文本分段完成
     */
    SEGMENT_COMPLETE,
    /**
     * 开始生成嵌入向量
     */
    EMBEDDING_GENERATE_START,
    /**
     * 嵌入向量生成进度
     */
    EMBEDDING_GENERATE_PROGRESS,
    /**
     * 嵌入向量生成完成
     */
    EMBEDDING_GENERATE_COMPLETE,
    /**
     * 开始存储到向量数据库
     */
    EMBEDDING_STORE_START,
    /**
     * 向量存储进度
     */
    EMBEDDING_STORE_PROGRESS,
    /**
     * 向量存储完成
     */
    EMBEDDING_STORE_COMPLETE,
    /**
     * 处理完成
     */
    COMPLETE,
    /**
     * 处理失败
     */
    ERROR
}
