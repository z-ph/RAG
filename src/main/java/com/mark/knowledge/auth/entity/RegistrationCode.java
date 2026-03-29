package com.mark.knowledge.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 一次性注册码。
 */
@Entity
@Table(name = "registration_codes")
public class RegistrationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 32)
    private String code;

    @Column(length = 255)
    private String note;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @Column(name = "used_by", length = 64)
    private String usedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "disabled_at")
    private LocalDateTime disabledAt;

    protected RegistrationCode() {
    }

    public RegistrationCode(String code, String note, String createdBy, LocalDateTime expiresAt) {
        this.code = code;
        this.note = note;
        this.createdBy = createdBy;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return expiresAt != null && expiresAt.isBefore(LocalDateTime.now());
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isDisabled() {
        return disabledAt != null;
    }

    public boolean isAvailable() {
        return !isUsed() && !isDisabled() && !isExpired();
    }

    public void markUsedBy(String username) {
        usedBy = username;
        usedAt = LocalDateTime.now();
    }

    public void disable() {
        if (disabledAt == null) {
            disabledAt = LocalDateTime.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getNote() {
        return note;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public String getUsedBy() {
        return usedBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getUsedAt() {
        return usedAt;
    }

    public LocalDateTime getDisabledAt() {
        return disabledAt;
    }
}
