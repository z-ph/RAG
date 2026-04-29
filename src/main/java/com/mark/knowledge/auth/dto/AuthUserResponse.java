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
        String roleDisplay = userAccount.getAssignedRole() != null
            ? userAccount.getAssignedRole().getName()
            : userAccount.getRole();
        return new AuthUserResponse(userAccount.getUsername(), roleDisplay);
    }
}
