package com.mark.knowledge.rag.service;

import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 基于内存的会话上下文服务，使用 langchain4j ChatMessage 管理消息列表。
 */
@Service
public class ConversationMemoryService {

    private static final Logger log = LoggerFactory.getLogger(ConversationMemoryService.class);

    private final int memoryWindow;
    private final long sessionTtlSeconds;
    private final ConcurrentHashMap<String, ConversationSession> sessions = new ConcurrentHashMap<>();

    public ConversationMemoryService(
            @Value("${rag.memory-window:6}") int memoryWindow,
            @Value("${rag.session-ttl-seconds:1800}") long sessionTtlSeconds) {
        this.memoryWindow = memoryWindow;
        this.sessionTtlSeconds = sessionTtlSeconds;
    }

    public List<ChatMessage> getMessages(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) {
            return List.of();
        }
        ConversationSession session = sessions.get(conversationId);
        if (session == null) {
            return List.of();
        }
        session.touch();
        return session.snapshot();
    }

    public void appendUserMessage(String conversationId, String content) {
        appendMessage(conversationId, UserMessage.from(content));
    }

    public void appendAiMessage(String conversationId, String content) {
        appendMessage(conversationId, AiMessage.from(content));
    }

    public void appendAiMessage(String conversationId, String content, String thinking) {
        AiMessage aiMessage = AiMessage.builder().text(content).thinking(thinking).build();
        appendMessage(conversationId, aiMessage);
    }

    public void clear(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) {
            return;
        }
        sessions.remove(conversationId);
    }

    public Set<String> getUsedChunkHashes(String conversationId) {
        if (conversationId == null || conversationId.isBlank()) {
            return Set.of();
        }
        ConversationSession session = sessions.get(conversationId);
        if (session == null) {
            return Set.of();
        }
        return session.snapshotUsedChunkHashes();
    }

    public void recordUsedChunkHashes(String conversationId, Set<String> chunkHashes) {
        if (conversationId == null || conversationId.isBlank()) {
            return;
        }
        if (chunkHashes == null || chunkHashes.isEmpty()) {
            return;
        }
        ConversationSession session = sessions.computeIfAbsent(conversationId, ignored -> new ConversationSession());
        session.addUsedChunkHashes(chunkHashes);
    }

    @Scheduled(fixedDelayString = "${rag.memory-cleanup-interval-ms:300000}")
    public void cleanupExpiredSessions() {
        Instant expireBefore = Instant.now().minusSeconds(sessionTtlSeconds);
        int before = sessions.size();
        sessions.entrySet().removeIf(entry -> entry.getValue().lastAccessTime().isBefore(expireBefore));
        int removed = before - sessions.size();
        if (removed > 0) {
            log.info("已清理 {} 个过期会话", removed);
        }
    }

    private void appendMessage(String conversationId, ChatMessage message) {
        if (conversationId == null || conversationId.isBlank()) {
            return;
        }
        ConversationSession session = sessions.computeIfAbsent(conversationId, ignored -> new ConversationSession());
        session.add(message, memoryWindow);
    }

    private static final class ConversationSession {
        private final List<ChatMessage> messages = new ArrayList<>();
        private final Set<String> usedChunkHashes = ConcurrentHashMap.newKeySet();
        private Instant lastAccessTime = Instant.now();

        private synchronized void add(ChatMessage message, int memoryWindow) {
            messages.add(message);
            trimToWindow(memoryWindow);
            touch();
        }

        private synchronized List<ChatMessage> snapshot() {
            return List.copyOf(messages);
        }

        private synchronized void addUsedChunkHashes(Set<String> hashes) {
            usedChunkHashes.addAll(hashes);
            touch();
        }

        private synchronized Set<String> snapshotUsedChunkHashes() {
            return Set.copyOf(usedChunkHashes);
        }

        private synchronized void trimToWindow(int memoryWindow) {
            int maxMessages = Math.max(memoryWindow, 1) * 2;
            while (messages.size() > maxMessages) {
                messages.remove(0);
            }
        }

        private synchronized void touch() {
            lastAccessTime = Instant.now();
        }

        private synchronized Instant lastAccessTime() {
            return lastAccessTime;
        }
    }
}
