package com.mark.knowledge.auth.dto;

/**
 * 登录/注册成功响应。
 */
public record AuthSuccessResponse(
    String message,
    AuthUserResponse user
) {
}
