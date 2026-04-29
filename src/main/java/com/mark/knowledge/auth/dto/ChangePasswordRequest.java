package com.mark.knowledge.auth.dto;

/**
 * 修改密码请求。
 */
public record ChangePasswordRequest(
    String currentPassword,
    String newPassword
) {
}
