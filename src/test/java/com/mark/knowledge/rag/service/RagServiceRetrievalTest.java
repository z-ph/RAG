package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.RagRequest;
import com.mark.knowledge.rag.dto.RagResponse;
import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RagServiceRetrievalTest {

    @Test
    void shouldUseRequestMinScoreForSearchAndFilterLowScoreChunksFromContext() {
        ChatModel chatModel = mock(ChatModel.class);
        EmbeddingModel embeddingModel = mock(EmbeddingModel.class);
        QdrantEmbeddingStoreFactory embeddingStoreFactory = mock(QdrantEmbeddingStoreFactory.class);
        QdrantEmbeddingStore embeddingStore = mock(QdrantEmbeddingStore.class);
        ConversationMemoryService memoryService = mock(ConversationMemoryService.class);
        PromptService promptService = mock(PromptService.class);

        when(memoryService.getMessages("conv-1")).thenReturn(List.of());
        when(memoryService.getUsedChunkHashes("conv-1")).thenReturn(Set.of());
        when(promptService.getPrompt("rag_system")).thenReturn("system prompt");
        when(embeddingModel.embed("test question")).thenReturn(Response.from(Embedding.from(new float[] {1f, 2f})));
        when(embeddingStoreFactory.createStore()).thenReturn(embeddingStore);
        when(embeddingStore.search(any(EmbeddingSearchRequest.class))).thenReturn(new EmbeddingSearchResult<>(List.of(
            new EmbeddingMatch<>(0.91, "high", null, segment("High score chunk", "doc-a.txt", "hash-a")),
            new EmbeddingMatch<>(0.45, "low", null, segment("Low score chunk", "doc-b.txt", "hash-b"))
        )));
        when(chatModel.chat(any(List.class))).thenAnswer(invocation -> {
            @SuppressWarnings("unchecked")
            List<ChatMessage> messages = invocation.getArgument(0, List.class);
            UserMessage contextMessage = messages.stream()
                .filter(UserMessage.class::isInstance)
                .map(UserMessage.class::cast)
                .filter(UserMessage::hasSingleText)
                .filter(message -> message.singleText().startsWith("新增文档上下文：\n"))
                .findFirst()
                .orElseThrow();

            assertTrue(contextMessage.singleText().contains("High score chunk"));
            assertFalse(contextMessage.singleText().contains("Low score chunk"));
            return ChatResponse.builder()
                .aiMessage(dev.langchain4j.data.message.AiMessage.from("answer"))
                .build();
        });

        RagService service = new RagService(
            chatModel,
            mock(StreamingChatModel.class),
            embeddingModel,
            embeddingStoreFactory,
            memoryService,
            new Bm25Scorer(),
            promptService,
            mock(ImageStorageService.class)
        );
        ReflectionTestUtils.setField(service, "maxResults", 5);
        ReflectionTestUtils.setField(service, "rerankCandidateMultiplier", 1);
        ReflectionTestUtils.setField(service, "vectorWeight", 1.0);
        ReflectionTestUtils.setField(service, "bm25Weight", 0.0);
        ReflectionTestUtils.setField(service, "chunkDedupEnabled", true);

        RagResponse response = service.ask(new RagRequest("test question", "conv-1", 4, 0.5));

        assertEquals("answer", response.answer());
        assertEquals(1, response.sources().size());
        assertEquals("doc-a.txt", response.sources().getFirst().filename());
        assertEquals(0.91, response.sources().getFirst().relevanceScore(), 0.0001);

        ArgumentCaptor<EmbeddingSearchRequest> requestCaptor = ArgumentCaptor.forClass(EmbeddingSearchRequest.class);
        verify(embeddingStore).search(requestCaptor.capture());
        assertEquals(0.5, requestCaptor.getValue().minScore(), 0.0001);
        assertEquals(4, requestCaptor.getValue().maxResults());
        verify(chatModel).chat(any(List.class));
        verify(memoryService).recordUsedChunkHashes(any(), any());
    }

    @Test
    void shouldReturnEmptyMatchAnswerWhenAllMatchesFallBelowRequestedMinScore() {
        ChatModel chatModel = mock(ChatModel.class);
        EmbeddingModel embeddingModel = mock(EmbeddingModel.class);
        QdrantEmbeddingStoreFactory embeddingStoreFactory = mock(QdrantEmbeddingStoreFactory.class);
        QdrantEmbeddingStore embeddingStore = mock(QdrantEmbeddingStore.class);
        ConversationMemoryService memoryService = mock(ConversationMemoryService.class);

        when(memoryService.getMessages("conv-2")).thenReturn(List.of());
        when(embeddingModel.embed("test question")).thenReturn(Response.from(Embedding.from(new float[] {1f, 2f})));
        when(embeddingStoreFactory.createStore()).thenReturn(embeddingStore);
        when(embeddingStore.search(any(EmbeddingSearchRequest.class))).thenReturn(new EmbeddingSearchResult<>(List.of(
            new EmbeddingMatch<>(0.49, "low", null, segment("Low score chunk", "doc-b.txt", "hash-b"))
        )));

        RagService service = new RagService(
            chatModel,
            mock(StreamingChatModel.class),
            embeddingModel,
            embeddingStoreFactory,
            memoryService,
            new Bm25Scorer(),
            mock(PromptService.class),
            mock(ImageStorageService.class)
        );
        ReflectionTestUtils.setField(service, "maxResults", 5);
        ReflectionTestUtils.setField(service, "rerankCandidateMultiplier", 1);
        ReflectionTestUtils.setField(service, "vectorWeight", 1.0);
        ReflectionTestUtils.setField(service, "bm25Weight", 0.0);

        RagResponse response = service.ask(new RagRequest("test question", "conv-2", 4, 0.5));

        assertEquals("未在已上传文档中检索到足够相关的内容，请根据文档内容重新提问。", response.answer());
        assertTrue(response.sources().isEmpty());
        verify(chatModel, never()).chat(any(List.class));
    }

    private static TextSegment segment(String text, String filename, String chunkHash) {
        Metadata metadata = new Metadata()
            .put("filename", filename)
            .put("chunkHash", chunkHash);
        return TextSegment.from(text, metadata);
    }
}
