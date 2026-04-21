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
