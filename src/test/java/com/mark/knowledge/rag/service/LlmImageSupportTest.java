package com.mark.knowledge.rag.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LlmImageSupportTest {

    @Test
    void shouldConvertReadableImageBytesToPngDataUri() throws Exception {
        BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", output);

        var result = LlmImageSupport.toPngDataUri(output.toByteArray());

        assertTrue(result.isPresent());
        assertTrue(result.get().startsWith("data:image/png;base64,"));
    }

    @Test
    void shouldRejectUnreadableImageBytes() {
        var result = LlmImageSupport.toPngDataUri("not-an-image".getBytes());

        assertFalse(result.isPresent());
    }

    @Test
    void shouldDetectActualRasterFormatEvenIfSuggestedExtensionIsWrong() throws Exception {
        BufferedImage image = new BufferedImage(1, 1, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "jpg", output);

        var normalized = LlmImageSupport.normalizeImage(output.toByteArray(), "png");

        assertTrue(normalized.isPresent());
        assertEquals("image/jpeg", normalized.get().contentType());
        assertEquals("jpg", normalized.get().extension());
    }
}
