package com.mark.knowledge.rag.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.stream.Stream;

@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);

    private final Path storageRoot;

    public ImageStorageService(@Value("${upload.storage-path:./uploads}") String storagePath) {
        this.storageRoot = Paths.get(storagePath).resolve("images").toAbsolutePath().normalize();
        try {
            Files.createDirectories(storageRoot);
        } catch (IOException e) {
            throw new RuntimeException("无法创建图片存储目录: " + storageRoot, e);
        }
        log.info("图片存储目录: {}", storageRoot);
    }

    public void saveImage(String documentId, String imageId, String extension, byte[] data) {
        Path dir = storageRoot.resolve(sanitize(documentId));
        try {
            Files.createDirectories(dir);
            LlmImageSupport.NormalizedImage normalized = LlmImageSupport.normalizeImage(data, extension)
                .orElseGet(() -> new LlmImageSupport.NormalizedImage(
                    data,
                    sanitize(extension),
                    "application/octet-stream"
                ));
            Path file = dir.resolve(sanitize(imageId) + "." + sanitize(normalized.extension()));
            Files.write(file, normalized.bytes());
            log.debug("图片已保存: {}/{} ({} bytes)", documentId, file.getFileName(), data.length);
        } catch (IOException e) {
            log.error("保存图片失败: documentId={}, imageId={}", documentId, imageId, e);
            throw new RuntimeException("保存图片失败: " + e.getMessage(), e);
        }
    }

    public byte[] readImage(String documentId, String imageFileName) {
        Path file = resolveAndValidate(documentId, imageFileName);
        try {
            byte[] rawBytes = Files.readAllBytes(file);
            return LlmImageSupport.normalizeImage(rawBytes, extensionOf(file.getFileName().toString()))
                .map(LlmImageSupport.NormalizedImage::bytes)
                .orElse(rawBytes);
        } catch (IOException e) {
            throw new RuntimeException("读取图片失败: " + e.getMessage(), e);
        }
    }

    public String detectContentType(String documentId, String imageFileName) {
        Path file = resolveAndValidate(documentId, imageFileName);
        try {
            byte[] rawBytes = Files.readAllBytes(file);
            var normalized = LlmImageSupport.normalizeImage(rawBytes, extensionOf(file.getFileName().toString()));
            if (normalized.isPresent()) {
                return normalized.get().contentType();
            }
            String contentType = Files.probeContentType(file);
            return contentType != null ? contentType : "application/octet-stream";
        } catch (IOException e) {
            return "application/octet-stream";
        }
    }

    public void deleteImages(String documentId) {
        Path dir = storageRoot.resolve(sanitize(documentId));
        if (!Files.exists(dir)) {
            return;
        }
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(java.util.Comparator.reverseOrder())
                .forEach(p -> {
                    try {
                        Files.delete(p);
                    } catch (IOException e) {
                        log.warn("删除图片文件失败: {}", p, e);
                    }
                });
            log.info("已清理文档 {} 的图片目录", documentId);
        } catch (IOException e) {
            log.error("清理文档图片失败: documentId={}", documentId, e);
        }
    }

    private Path resolveAndValidate(String documentId, String imageFileName) {
        String safeDocId = sanitize(documentId);
        String safeFileName = sanitize(imageFileName);
        Path file = storageRoot.resolve(safeDocId).resolve(safeFileName).normalize();

        if (!file.startsWith(storageRoot)) {
            throw new SecurityException("非法图片路径: " + documentId + "/" + imageFileName);
        }
        if (!Files.exists(file)) {
            throw new RuntimeException("图片不存在: " + documentId + "/" + imageFileName);
        }
        return file;
    }

    private String sanitize(String input) {
        if (input == null || input.isBlank()) {
            throw new IllegalArgumentException("参数不能为空");
        }
        String sanitized = input.replaceAll("[.]{2,}", "").replaceAll("[/\\\\]", "");
        if (sanitized.isBlank()) {
            throw new IllegalArgumentException("参数清理后为空: " + input);
        }
        return sanitized;
    }

    private String extensionOf(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == filename.length() - 1) {
            return "png";
        }
        return filename.substring(dotIndex + 1);
    }
}
