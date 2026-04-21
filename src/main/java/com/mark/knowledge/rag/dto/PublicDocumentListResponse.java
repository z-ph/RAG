package com.mark.knowledge.rag.dto;

import java.util.List;

public record PublicDocumentListResponse(
    List<PublicDocumentListItem> documents,
    int total
) {}
