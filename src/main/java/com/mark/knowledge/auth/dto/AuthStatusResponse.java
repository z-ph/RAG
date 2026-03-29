package com.mark.knowledge.auth.dto;

/**
 * 当前登录状态。
 */
public record AuthStatusResponse(
    boolean authenticated,
    AuthUserResponse user
) {
}
