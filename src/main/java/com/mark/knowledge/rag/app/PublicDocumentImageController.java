package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.service.ImageStorageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicDocumentImageController {

    private final ImageStorageService imageStorageService;

    public PublicDocumentImageController(ImageStorageService imageStorageService) {
        this.imageStorageService = imageStorageService;
    }

    @GetMapping({"/documents/images/{documentId}/{imageId:.+}", "/rag/documents/images/{documentId}/{imageId:.+}"})
    public ResponseEntity<?> serveImage(
            @PathVariable String documentId,
            @PathVariable String imageId) {
        try {
            byte[] imageBytes = imageStorageService.readImage(documentId, imageId);
            String contentType = imageStorageService.detectContentType(documentId, imageId);
            return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header("Cache-Control", "public, max-age=86400")
                .contentLength(imageBytes.length)
                .body(imageBytes);
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ErrorResponse("非法请求", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("图片不存在", e.getMessage()));
        }
    }
}
