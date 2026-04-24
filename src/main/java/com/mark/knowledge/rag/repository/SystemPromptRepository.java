package com.mark.knowledge.rag.repository;

import com.mark.knowledge.rag.entity.SystemPrompt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SystemPromptRepository extends JpaRepository<SystemPrompt, Long> {
    Optional<SystemPrompt> findByPromptKey(String promptKey);
}
