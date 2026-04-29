package com.mark.knowledge.rag.dto;

import java.time.LocalDateTime;

/**
 * 健康检查 POST 响应。
 */
public record HealthCheckResponse(
    String status,
    String message,
    String echo,
    LocalDateTime timestamp
) {
    public HealthCheckResponse(String status, String message) {
        this(status, message, null, LocalDateTime.now());
    }

    public HealthCheckResponse(String status, String message, String echo) {
        this(status, message, echo, LocalDateTime.now());
    }
}
