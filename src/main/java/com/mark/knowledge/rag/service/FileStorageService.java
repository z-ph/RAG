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
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
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

    public String findStoredFilename(String documentId) {
        validateDocumentId(documentId);
        Path docDir = storageRoot.resolve(documentId).normalize();
        if (!docDir.startsWith(storageRoot) || !Files.isDirectory(docDir)) {
            return null;
        }

        try (Stream<Path> files = Files.list(docDir)) {
            return files
                .filter(Files::isRegularFile)
                .map(path -> path.getFileName().toString())
                .findFirst()
                .orElse(null);
        } catch (IOException e) {
            log.warn("读取文档目录失败: {}", docDir, e);
            return null;
        }
    }

    /**
     * 从本地文件系统扫描所有已上传的文档。
     *
     * @return 文档信息列表（documentId + filename），当 Qdrant 不可用时作为回退数据源
     */
    public List<StoredDocument> listStoredDocuments() {
        List<StoredDocument> documents = new ArrayList<>();
        if (!Files.isDirectory(storageRoot)) {
            return documents;
        }

        try (Stream<Path> dirs = Files.list(storageRoot)) {
            dirs.filter(Files::isDirectory).forEach(dir -> {
                String documentId = dir.getFileName().toString();
                if (!UUID_PATTERN.matcher(documentId).matches()) {
                    return;
                }
                String filename = findStoredFilename(documentId);
                if (filename != null) {
                    documents.add(new StoredDocument(documentId, filename));
                }
            });
        } catch (IOException e) {
            log.warn("扫描文件存储目录失败: {}", storageRoot, e);
        }

        return documents;
    }

    /**
     * 本地文件系统中存储的文档信息。
     */
    public record StoredDocument(String documentId, String filename) {}

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
