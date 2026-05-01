package com.mark.knowledge.rag.service.parsers;

import java.util.List;

public record DocxParseResult(
    String text,
    List<ImageReference> imageReferences
) {

    public static DocxParseResult textOnly(String text) {
        return new DocxParseResult(text, List.of());
    }
}
