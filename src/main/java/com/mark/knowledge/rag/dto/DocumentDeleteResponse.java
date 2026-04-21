package com.mark.knowledge.rag.dto;

/**
 * 文档删除响应。
 */
public record DocumentDeleteResponse(
    String documentId,
    String filename,
    int deletedSegments,
    String message
) {
}
