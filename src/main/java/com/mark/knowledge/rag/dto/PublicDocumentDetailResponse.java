package com.mark.knowledge.rag.dto;

import java.util.List;

public record PublicDocumentDetailResponse(
    String documentId,
    String filename,
    String title,
    String category,
    String documentTime,
    String keywords,
    int segmentCount,
    List<PublicDocumentSegment> segments
) {}
