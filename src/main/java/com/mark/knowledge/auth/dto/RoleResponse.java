package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.Role;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 角色信息响应。
 */
public record RoleResponse(
    Long id,
    String code,
    String name,
    String description,
    List<PermissionResponse> permissions,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
    public static RoleResponse from(Role role) {
        return new RoleResponse(
            role.getId(),
            role.getCode(),
            role.getName(),
            role.getDescription(),
            role.getPermissions().stream().map(PermissionResponse::from).toList(),
            role.getCreatedAt(),
            role.getUpdatedAt()
        );
    }
}
