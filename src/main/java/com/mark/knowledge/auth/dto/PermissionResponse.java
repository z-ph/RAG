package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.Permission;

import java.time.LocalDateTime;

/**
 * 权限信息响应。
 */
public record PermissionResponse(
    Long id,
    String code,
    String name,
    String description,
    String module,
    LocalDateTime createdAt
) {
    public static PermissionResponse from(Permission permission) {
        return new PermissionResponse(
            permission.getId(),
            permission.getCode(),
            permission.getName(),
            permission.getDescription(),
            permission.getModule(),
            permission.getCreatedAt()
        );
    }
}
