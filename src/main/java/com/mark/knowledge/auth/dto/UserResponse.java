package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.UserAccount;

import java.time.LocalDateTime;

/**
 * 用户信息响应。
 */
public record UserResponse(
    Long id,
    String username,
    String role,
    String roleName,
    boolean enabled,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static UserResponse from(UserAccount userAccount) {
        return new UserResponse(
            userAccount.getId(),
            userAccount.getUsername(),
            userAccount.getAssignedRole() != null ? userAccount.getAssignedRole().getCode() : userAccount.getRole(),
            userAccount.getAssignedRole() != null ? userAccount.getAssignedRole().getName() : userAccount.getRole(),
            userAccount.isEnabled(),
            userAccount.getCreatedAt(),
            userAccount.getUpdatedAt()
        );
    }
}
