package com.mark.knowledge.rag.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImageStorageServiceTest {

    @TempDir
    Path tempDir;

    @Test
    void shouldDetectActualContentTypeForLegacyFileWithWrongExtension() throws Exception {
        ImageStorageService service = new ImageStorageService(tempDir.toString());
        BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", output);

        Path file = tempDir.resolve("images").resolve("doc-1").resolve("img-1.png");
        Files.createDirectories(file.getParent());
        Files.write(file, output.toByteArray());

        byte[] servedBytes = service.readImage("doc-1", "img-1.png");
        String contentType = service.detectContentType("doc-1", "img-1.png");

        assertEquals("image/jpeg", contentType);
        assertTrue(servedBytes.length > 0);
    }
}
