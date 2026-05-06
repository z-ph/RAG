package com.mark.knowledge.rag.service;

import org.apache.poi.hemf.draw.HemfImageRenderer;
import org.apache.poi.hwmf.draw.HwmfImageRenderer;

import javax.imageio.ImageIO;
import java.awt.geom.Dimension2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;

public final class LlmImageSupport {

    private static final String PNG_DATA_URI_PREFIX = "data:image/png;base64,";
    private static final byte[] PNG_SIGNATURE = new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47};
    private static final byte[] JPEG_SIGNATURE = new byte[] {(byte) 0xFF, (byte) 0xD8};
    private static final byte[] GIF_SIGNATURE = new byte[] {0x47, 0x49, 0x46};
    private static final byte[] BMP_SIGNATURE = new byte[] {0x42, 0x4D};
    private static final byte[] RIFF_SIGNATURE = new byte[] {0x52, 0x49, 0x46, 0x46};
    private static final byte[] WEBP_SIGNATURE = new byte[] {0x57, 0x45, 0x42, 0x50};

    private LlmImageSupport() {
    }

    public static Optional<String> toPngDataUri(byte[] bytes) {
        return normalizeToPng(bytes).map(LlmImageSupport::toPngDataUriUnchecked);
    }

    public static Optional<NormalizedImage> normalizeImage(byte[] bytes, String suggestedExtension) {
        if (bytes == null || bytes.length == 0) {
            return Optional.empty();
        }

        String normalizedExtension = normalizeExtension(suggestedExtension);
        if (isRasterBytes(bytes)) {
            String contentType = detectRasterContentType(bytes, normalizedExtension);
            return Optional.of(new NormalizedImage(bytes, extensionFromContentType(contentType), contentType));
        }

        return normalizeToPng(bytes).map(pngBytes -> new NormalizedImage(pngBytes, "png", "image/png"));
    }

    public static Optional<byte[]> normalizeToPng(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return Optional.empty();
        }

        if (hasSignature(bytes, PNG_SIGNATURE)) {
            return Optional.of(bytes);
        }

        try (ByteArrayInputStream input = new ByteArrayInputStream(bytes);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            BufferedImage image = ImageIO.read(input);
            if (image == null) {
                image = renderVectorImage(bytes);
            }
            if (image == null) {
                return Optional.empty();
            }
            if (!ImageIO.write(image, "png", output)) {
                return Optional.empty();
            }
            return Optional.of(output.toByteArray());
        } catch (IOException e) {
            return Optional.empty();
        }
    }

    private static String toPngDataUriUnchecked(byte[] pngBytes) {
        String base64 = Base64.getEncoder().encodeToString(pngBytes);
        return PNG_DATA_URI_PREFIX + base64;
    }

    private static BufferedImage renderVectorImage(byte[] bytes) throws IOException {
        if (looksLikeEmf(bytes)) {
            HemfImageRenderer renderer = new HemfImageRenderer();
            renderer.loadImage(bytes, "image/x-emf");
            return toRenderableImage(renderer.getImage(renderer.getDimension()));
        }
        if (looksLikeWmf(bytes)) {
            HwmfImageRenderer renderer = new HwmfImageRenderer();
            renderer.loadImage(bytes, "image/x-wmf");
            return toRenderableImage(renderer.getImage(renderer.getDimension()));
        }
        return null;
    }

    private static BufferedImage toRenderableImage(BufferedImage image) {
        if (image != null) {
            return image;
        }
        return null;
    }

    private static boolean isRasterBytes(byte[] bytes) {
        return hasSignature(bytes, PNG_SIGNATURE)
            || hasSignature(bytes, JPEG_SIGNATURE)
            || hasSignature(bytes, GIF_SIGNATURE)
            || hasSignature(bytes, BMP_SIGNATURE)
            || looksLikeWebp(bytes);
    }

    private static String detectRasterContentType(byte[] bytes, String fallbackExtension) {
        if (hasSignature(bytes, PNG_SIGNATURE)) {
            return "image/png";
        }
        if (hasSignature(bytes, JPEG_SIGNATURE)) {
            return "image/jpeg";
        }
        if (hasSignature(bytes, GIF_SIGNATURE)) {
            return "image/gif";
        }
        if (hasSignature(bytes, BMP_SIGNATURE)) {
            return "image/bmp";
        }
        if (looksLikeWebp(bytes)) {
            return "image/webp";
        }
        return switch (fallbackExtension) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "bmp" -> "image/bmp";
            case "webp" -> "image/webp";
            default -> "image/png";
        };
    }

    private static String extensionFromContentType(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/gif" -> "gif";
            case "image/bmp" -> "bmp";
            case "image/webp" -> "webp";
            default -> "png";
        };
    }

    private static String normalizeExtension(String suggestedExtension) {
        if (suggestedExtension == null || suggestedExtension.isBlank()) {
            return "png";
        }
        return suggestedExtension.toLowerCase(Locale.ROOT);
    }

    private static boolean looksLikeWmf(byte[] bytes) {
        return bytes.length >= 4
            && (hasSignature(bytes, new byte[] {(byte) 0xD7, (byte) 0xCD, (byte) 0xC6, (byte) 0x9A})
            || hasSignature(bytes, new byte[] {0x01, 0x00, 0x09, 0x00}));
    }

    private static boolean looksLikeEmf(byte[] bytes) {
        return bytes.length >= 44
            && bytes[40] == 0x20
            && bytes[41] == 0x45
            && bytes[42] == 0x4D
            && bytes[43] == 0x46;
    }

    private static boolean looksLikeWebp(byte[] bytes) {
        return bytes.length >= 12
            && hasSignature(bytes, RIFF_SIGNATURE)
            && bytes[8] == WEBP_SIGNATURE[0]
            && bytes[9] == WEBP_SIGNATURE[1]
            && bytes[10] == WEBP_SIGNATURE[2]
            && bytes[11] == WEBP_SIGNATURE[3];
    }

    private static boolean hasSignature(byte[] bytes, byte[] signature) {
        if (bytes.length < signature.length) {
            return false;
        }
        for (int i = 0; i < signature.length; i++) {
            if (bytes[i] != signature[i]) {
                return false;
            }
        }
        return true;
    }

    public record NormalizedImage(
        byte[] bytes,
        String extension,
        String contentType
    ) {
    }
}
