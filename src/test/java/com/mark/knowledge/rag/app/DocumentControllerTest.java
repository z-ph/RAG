package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.DocumentResponse;
import com.mark.knowledge.rag.service.DocumentAdminService;
import com.mark.knowledge.rag.service.DocumentService;
import com.mark.knowledge.rag.service.EmbeddingService;
import com.mark.knowledge.rag.service.FileStorageService;
import com.mark.knowledge.rag.service.ImageStorageService;
import dev.langchain4j.data.segment.TextSegment;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DocumentControllerTest {

    @Test
    void shouldAllowDocExtension() throws Exception {
        DocumentService documentService = mock(DocumentService.class);
        EmbeddingService embeddingService = mock(EmbeddingService.class);
        DocumentAdminService documentAdminService = mock(DocumentAdminService.class);
        FileStorageService fileStorageService = mock(FileStorageService.class);
        ImageStorageService imageStorageService = mock(ImageStorageService.class);

        DocumentController controller = new DocumentController(
            documentService,
            embeddingService,
            documentAdminService,
            fileStorageService,
            imageStorageService
        );

        MockMultipartFile file = new MockMultipartFile(
            "file",
            "sample.doc",
            "application/msword",
            "hello".getBytes()
        );

        when(documentService.processDocument(any(InputStream.class), eq("sample.doc")))
            .thenReturn(new DocumentService.ProcessedDocument("doc-1", "sample.doc", List.<TextSegment>of()));
        when(embeddingService.storeSegments(List.of())).thenReturn(0);

        ResponseEntity<?> response = controller.uploadDocument(file);
        assertEquals(200, response.getStatusCode().value());
        assertInstanceOf(DocumentResponse.class, response.getBody());
        assertEquals("sample.doc", ((DocumentResponse) response.getBody()).filename());
    }
}
