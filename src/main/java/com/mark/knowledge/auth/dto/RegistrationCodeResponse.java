package com.mark.knowledge.auth.dto;

import com.mark.knowledge.auth.entity.RegistrationCode;

import java.time.LocalDateTime;

/**
 * 注册码详情。
 */
public record RegistrationCodeResponse(
    Long id,
    String code,
    String note,
    String createdBy,
    LocalDateTime createdAt,
    LocalDateTime expiresAt,
    LocalDateTime usedAt,
    String usedBy,
    LocalDateTime disabledAt,
    String status
) {
    public static RegistrationCodeResponse from(RegistrationCode registrationCode) {
        String status = "AVAILABLE";
        if (registrationCode.isUsed()) {
            status = "USED";
        } else if (registrationCode.isDisabled()) {
            status = "DISABLED";
        } else if (registrationCode.isExpired()) {
            status = "EXPIRED";
        }

        return new RegistrationCodeResponse(
            registrationCode.getId(),
            registrationCode.getCode(),
            registrationCode.getNote(),
            registrationCode.getCreatedBy(),
            registrationCode.getCreatedAt(),
            registrationCode.getExpiresAt(),
            registrationCode.getUsedAt(),
            registrationCode.getUsedBy(),
            registrationCode.getDisabledAt(),
            status
        );
    }
}
