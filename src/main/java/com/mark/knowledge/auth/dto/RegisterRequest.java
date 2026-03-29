package com.mark.knowledge.auth.dto;

/**
 * 注册请求。
 */
public record RegisterRequest(
    String username,
    String password,
    String registrationCode
) {
}
