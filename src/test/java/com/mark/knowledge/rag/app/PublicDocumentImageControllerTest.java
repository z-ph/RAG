package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.service.ImageStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PublicDocumentImageControllerTest {

    @Test
    void shouldServeImageFromCanonicalRoute() {
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        PublicDocumentImageController controller = new PublicDocumentImageController(imageStorageService);
        byte[] imageBytes = new byte[] {1, 2, 3};

        when(imageStorageService.readImage("doc-1", "image.png")).thenReturn(imageBytes);
        when(imageStorageService.detectContentType("doc-1", "image.png")).thenReturn("image/png");

        ResponseEntity<?> response = controller.serveImage("doc-1", "image.png");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("image/png", response.getHeaders().getContentType().toString());
        assertEquals("public, max-age=86400", response.getHeaders().getCacheControl());
        assertArrayEquals(imageBytes, (byte[]) response.getBody());
    }

    @Test
    void shouldReturnNotFoundForMissingImage() {
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        PublicDocumentImageController controller = new PublicDocumentImageController(imageStorageService);

        when(imageStorageService.readImage("doc-1", "missing.png"))
            .thenThrow(new RuntimeException("图片不存在: doc-1/missing.png"));

        ResponseEntity<?> response = controller.serveImage("doc-1", "missing.png");

        assertEquals(404, response.getStatusCode().value());
        assertInstanceOf(ErrorResponse.class, response.getBody());
        assertEquals("图片不存在", ((ErrorResponse) response.getBody()).error());
    }
}
