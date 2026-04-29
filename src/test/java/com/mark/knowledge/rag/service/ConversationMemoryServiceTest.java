package com.mark.knowledge.rag.service;

import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ConversationMemoryServiceTest {

    private final ConversationMemoryService service = new ConversationMemoryService(6, 1800);

    @Test
    void getUsedChunkHashesShouldReturnEmptyForNullConversationId() {
        assertTrue(service.getUsedChunkHashes(null).isEmpty());
    }

    @Test
    void getUsedChunkHashesShouldReturnEmptyForBlankConversationId() {
        assertTrue(service.getUsedChunkHashes("").isEmpty());
        assertTrue(service.getUsedChunkHashes("   ").isEmpty());
    }

    @Test
    void getUsedChunkHashesShouldReturnEmptyForNonExistentSession() {
        assertTrue(service.getUsedChunkHashes("session-does-not-exist").isEmpty());
    }

    @Test
    void shouldRecordAndRetrieveUsedChunkHashes() {
        String conversationId = "conv-record-retrieve";
        Set<String> hashes = Set.of("hash-001", "hash-002", "hash-003");

        service.recordUsedChunkHashes(conversationId, hashes);

        assertEquals(hashes, service.getUsedChunkHashes(conversationId));
        service.clear(conversationId);
    }

    @Test
    void shouldAccumulateChunkHashesAcrossMultipleRecordings() {
        String conversationId = "conv-accumulate";

        service.recordUsedChunkHashes(conversationId, Set.of("hash-a", "hash-b"));
        service.recordUsedChunkHashes(conversationId, Set.of("hash-c"));

        assertEquals(
                Set.of("hash-a", "hash-b", "hash-c"),
                service.getUsedChunkHashes(conversationId)
        );
        service.clear(conversationId);
    }

    @Test
    void shouldNotDuplicateRepeatedChunkHashes() {
        String conversationId = "conv-dedup";

        service.recordUsedChunkHashes(conversationId, Set.of("hash-x", "hash-y"));
        service.recordUsedChunkHashes(conversationId, Set.of("hash-x", "hash-z"));

        Set<String> retrieved = service.getUsedChunkHashes(conversationId);
        assertEquals(Set.of("hash-x", "hash-y", "hash-z"), retrieved);
        assertEquals(3, retrieved.size());
        service.clear(conversationId);
    }

    @Test
    void clearShouldRemoveAllHashes() {
        String conversationId = "conv-clear-test";

        service.recordUsedChunkHashes(conversationId, Set.of("hash-to-clear"));
        assertFalse(service.getUsedChunkHashes(conversationId).isEmpty());

        service.clear(conversationId);

        assertTrue(service.getUsedChunkHashes(conversationId).isEmpty());
    }

    @Test
    void recordShouldAutoCreateSessionWhenItDoesNotExist() {
        String conversationId = "conv-auto-create";

        assertTrue(service.getUsedChunkHashes(conversationId).isEmpty());

        service.recordUsedChunkHashes(conversationId, Set.of("auto-created-hash"));

        assertEquals(
                Set.of("auto-created-hash"),
                service.getUsedChunkHashes(conversationId)
        );

        // After clear, session is gone
        service.clear(conversationId);
        assertTrue(service.getUsedChunkHashes(conversationId).isEmpty());
    }

    @Test
    void hashesShouldRemainAfterAppendingMessages() {
        String conversationId = "conv-append-msg";

        service.recordUsedChunkHashes(conversationId, Set.of("hash-persist"));
        service.appendUserMessage(conversationId, "Hello");
        service.appendAssistantMessage(conversationId, "Hi there");

        assertEquals(
                Set.of("hash-persist"),
                service.getUsedChunkHashes(conversationId)
        );
        assertEquals(2, service.getRecentMessages(conversationId).size());
        service.clear(conversationId);
    }

    @Test
    void snapshotShouldNotReflectSubsequentModifications() {
        String conversationId = "conv-snapshot";

        service.recordUsedChunkHashes(conversationId, Set.of("hash-1", "hash-2"));
        Set<String> snapshot = service.getUsedChunkHashes(conversationId);

        service.recordUsedChunkHashes(conversationId, Set.of("hash-3"));

        assertAll(
                () -> assertEquals(Set.of("hash-1", "hash-2"), snapshot),
                () -> assertEquals(
                        Set.of("hash-1", "hash-2", "hash-3"),
                        service.getUsedChunkHashes(conversationId)
                )
        );
        service.clear(conversationId);
    }
}
