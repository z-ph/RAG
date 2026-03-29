package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.UserAccount;

/**
 * 当前登录用户信息。
 */
public record AuthUserResponse(
    String username,
    String role
) {
    public static AuthUserResponse from(UserAccount userAccount) {
        return new AuthUserResponse(userAccount.getUsername(), userAccount.getRole().name());
    }
}
