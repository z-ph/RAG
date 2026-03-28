package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmbeddingServiceTest {

    @Test
    void shouldRetryUnavailableWriteWithFreshStore() {
        EmbeddingModel embeddingModel = mock(EmbeddingModel.class);
        QdrantEmbeddingStoreFactory storeFactory = mock(QdrantEmbeddingStoreFactory.class);
        QdrantEmbeddingStore firstStore = mock(QdrantEmbeddingStore.class);
        QdrantEmbeddingStore secondStore = mock(QdrantEmbeddingStore.class);
        @SuppressWarnings("unchecked")
        Response<List<Embedding>> response = (Response<List<Embedding>>) mock(Response.class);
        Embedding embedding1 = mock(Embedding.class);
        Embedding embedding2 = mock(Embedding.class);

        List<TextSegment> segments = List.of(
            TextSegment.from("segment-1"),
            TextSegment.from("segment-2")
        );

        when(response.content()).thenReturn(List.of(embedding1, embedding2));
        when(embedding1.dimension()).thenReturn(1024);
        when(embeddingModel.embedAll(segments)).thenReturn(response);
        when(storeFactory.createStore()).thenReturn(firstStore, secondStore);
        when(storeFactory.describeTarget()).thenReturn("127.0.0.1:6334/knowledge-base");

        when(firstStore.addAll(anyList(), anyList()))
            .thenThrow(new RuntimeException(new StatusRuntimeException(Status.UNAVAILABLE)));
        when(secondStore.addAll(anyList(), anyList()))
            .thenReturn(List.of("id-1", "id-2"));

        EmbeddingService embeddingService = new EmbeddingService(embeddingModel, storeFactory);
        ReflectionTestUtils.setField(embeddingService, "embeddingStoreBatchSize", 2);
        ReflectionTestUtils.setField(embeddingService, "embeddingStoreMaxRetries", 1);
        ReflectionTestUtils.setField(embeddingService, "embeddingStoreRetryBackoffMs", 0L);

        int storedCount = embeddingService.storeSegments(segments);

        assertEquals(2, storedCount);
        verify(storeFactory, times(2)).createStore();
        verify(firstStore, times(1)).close();
        verify(secondStore, times(1)).close();
    }
}
