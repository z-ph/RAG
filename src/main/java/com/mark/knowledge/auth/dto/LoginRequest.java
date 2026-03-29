package com.mark.knowledge.auth.dto;

/**
 * 登录请求。
 */
public record LoginRequest(
    String username,
    String password
) {
}
