package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.UserAccount;

/**
 * 当前登录用户信息。
 */
public record AuthUserResponse(
    String username,
    String role,
    String roleCode
) {
    public static AuthUserResponse from(UserAccount userAccount) {
        String roleName = userAccount.getAssignedRole() != null
            ? userAccount.getAssignedRole().getName()
            : userAccount.getRole();
        String roleCode = userAccount.getAssignedRole() != null
            ? userAccount.getAssignedRole().getCode()
            : userAccount.getRole();
        return new AuthUserResponse(userAccount.getUsername(), roleName, roleCode);
    }
}
