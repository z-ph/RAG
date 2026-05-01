package com.mark.knowledge.rag.dto;

import java.util.List;

/**
 * RAG 来源片段。
 */
public record SourceReference(
    String filename,
    String excerpt,
    double relevanceScore,
    List<String> images
) {

    public SourceReference(String filename, String excerpt, double relevanceScore) {
        this(filename, excerpt, relevanceScore, List.of());
    }
}
