package com.mark.knowledge.rag.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_prompts")
public class SystemPrompt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prompt_key", nullable = false, unique = true, length = 64)
    private String promptKey;

    @Column(name = "prompt_content", nullable = false, columnDefinition = "TEXT")
    private String promptContent;

    @Column(length = 255)
    private String description;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "updated_by", length = 64)
    private String updatedBy;

    protected SystemPrompt() {
    }

    public SystemPrompt(String promptKey, String promptContent, String description) {
        this.promptKey = promptKey;
        this.promptContent = promptContent;
        this.description = description;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getPromptKey() { return promptKey; }
    public String getPromptContent() { return promptContent; }
    public String getDescription() { return description; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public String getUpdatedBy() { return updatedBy; }

    public void setPromptContent(String promptContent) { this.promptContent = promptContent; }
    public void setDescription(String description) { this.description = description; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
}
