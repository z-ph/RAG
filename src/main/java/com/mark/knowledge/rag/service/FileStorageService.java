package com.mark.knowledge.rag.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.regex.Pattern;

@Service
public class FileStorageService {

    private static final Logger log = LoggerFactory.getLogger(FileStorageService.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", Pattern.CASE_INSENSITIVE);

    private final Path storageRoot;

    public FileStorageService(@Value("${upload.storage-path:/app/uploads}") String storagePath) {
        this.storageRoot = Paths.get(storagePath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.storageRoot);
            log.info("文件存储目录: {}", this.storageRoot);
        } catch (IOException e) {
            throw new RuntimeException("无法创建文件存储目录: " + this.storageRoot, e);
        }
    }

    public void saveFile(String documentId, String filename, InputStream inputStream) throws IOException {
        validateDocumentId(documentId);
        validateFilename(filename);
        Path docDir = storageRoot.resolve(documentId);
        Files.createDirectories(docDir);
        Path targetFile = docDir.resolve(filename).normalize();
        if (!targetFile.startsWith(docDir)) {
            throw new IllegalArgumentException("非法文件路径");
        }
        Files.copy(inputStream, targetFile, StandardCopyOption.REPLACE_EXISTING);
        log.info("文件已保存: {}", targetFile);
    }

    public Path getFilePath(String documentId, String filename) {
        validateDocumentId(documentId);
        validateFilename(filename);
        Path docDir = storageRoot.resolve(documentId);
        Path file = docDir.resolve(filename).normalize();
        if (!file.startsWith(docDir)) {
            throw new IllegalArgumentException("非法文件路径");
        }
        if (!Files.isRegularFile(file)) {
            return null;
        }
        return file;
    }

    public void deleteFile(String documentId, String filename) throws IOException {
        Path file = getFilePath(documentId, filename);
        if (file != null) {
            Files.deleteIfExists(file);
            Path docDir = file.getParent();
            if (Files.isDirectory(docDir)) {
                try (var entries = Files.list(docDir)) {
                    if (entries.findFirst().isEmpty()) {
                        Files.deleteIfExists(docDir);
                    }
                }
            }
            log.info("文件已删除: {}", file);
        }
    }

    private void validateDocumentId(String documentId) {
        if (documentId == null || !UUID_PATTERN.matcher(documentId).matches()) {
            throw new IllegalArgumentException("非法的文档ID格式");
        }
    }

    private void validateFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("文件名不能为空");
        }
        if (filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            throw new IllegalArgumentException("非法文件名");
        }
    }
}
