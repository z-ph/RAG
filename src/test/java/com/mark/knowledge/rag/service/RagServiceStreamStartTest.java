package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.RagRequest;
import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.lang.reflect.Field;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

class RagServiceStreamStartTest {

    @Test
    void shouldReturnEmitterBeforeSendingStartEvent() throws Exception {
        TestableRagService service = new TestableRagService();
        RagRequest request = new RagRequest("test", "conv-1", null);

        SseEmitter emitter = service.askStream(request);

        assertNotNull(emitter);
        assertFalse(service.startSent.get(), "start event should not be sent before askStream returns");
        assertNotNull(service.capturedTask, "stream task should be scheduled asynchronously");
    }

    private static final class TestableRagService extends RagService {
        private final AtomicBoolean startSent = new AtomicBoolean(false);
        private Runnable capturedTask;

        private TestableRagService() throws Exception {
            super(
                mock(ChatModel.class),
                mock(StreamingChatModel.class),
                mock(EmbeddingModel.class),
                mock(QdrantEmbeddingStoreFactory.class),
                mock(ConversationMemoryService.class),
                mock(Bm25Scorer.class),
                mock(PromptService.class),
                mock(ImageStorageService.class)
            );
            setStreamTimeoutMs(1_000L);
        }

        @Override
        protected void emitStartEvent(Object generation, String conversationId) {
            startSent.set(true);
        }

        @Override
        protected CompletableFuture<Void> submitStreamTask(Runnable task) {
            capturedTask = task;
            return CompletableFuture.completedFuture(null);
        }

        private void setStreamTimeoutMs(long value) throws Exception {
            Field field = RagService.class.getDeclaredField("streamTimeoutMs");
            field.setAccessible(true);
            field.setLong(this, value);
        }
    }

}
