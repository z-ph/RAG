package com.mark.knowledge.rag.service.parsers;

import java.util.List;

public record DocParseResult(
    String text,
    List<ImageReference> imageReferences
) {
}
