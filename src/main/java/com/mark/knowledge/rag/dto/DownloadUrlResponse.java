package com.mark.knowledge.rag.dto;

/**
 * 临时下载链接响应
 */
public class DownloadUrlResponse {
    private final String downloadUrl;
    private final String filename;

    public DownloadUrlResponse(String downloadUrl, String filename) {
        this.downloadUrl = downloadUrl;
        this.filename = filename;
    }

    public String getDownloadUrl() {
        return downloadUrl;
    }

    public String getFilename() {
        return filename;
    }
}
