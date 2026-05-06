package com.mark.knowledge.rag.service;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class DocumentServiceFixedDocumentIdTest {

    @Test
    void shouldPreserveProvidedDocumentId() {
        DocumentService service = new DocumentService(mock(ImageStorageService.class));

        DocumentService.ProcessedDocument processed = service.processDocument(
            new ByteArrayInputStream("第一段文本\n\n第二段文本".getBytes()),
            "sample.txt",
            "c34e1009-df03-41f1-a3cc-8546869840bd"
        );

        assertEquals("c34e1009-df03-41f1-a3cc-8546869840bd", processed.documentId());
    }
}
