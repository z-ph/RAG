package com.mark.knowledge.rag.service.parsers;

public record ImageReference(
    String imageId,
    String documentId,
    String extension,
    String publicUrl,
    byte[] data
) {

    public String fileName() {
        return imageId + "." + extension;
    }

    public String mimeType() {
        return switch (extension.toLowerCase()) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "bmp" -> "image/bmp";
            case "svg" -> "image/svg+xml";
            default -> "image/png";
        };
    }
}
