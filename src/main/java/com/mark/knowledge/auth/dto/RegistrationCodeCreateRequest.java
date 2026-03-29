package com.mark.knowledge.auth.dto;

import java.time.LocalDateTime;

/**
 * 创建注册码请求。
 */
public record RegistrationCodeCreateRequest(
    String note,
    LocalDateTime expiresAt
) {
}
