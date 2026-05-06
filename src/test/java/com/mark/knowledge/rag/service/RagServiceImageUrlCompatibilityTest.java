package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.SourceReference;
import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RagServiceImageUrlCompatibilityTest {

    @Test
    void shouldExtractLegacyAndCanonicalImageUrlsFromChunk() throws Exception {
        RagService service = createService(mock(ImageStorageService.class));
        Method method = RagService.class.getDeclaredMethod("extractImageUrls", String.class);
        method.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<String> urls = (List<String>) method.invoke(
            service,
            """
            第一张 ![图片](/rag/documents/images/doc-1/legacy.png)
            第二张 ![图片](/documents/images/doc-1/current.png)
            """
        );

        assertIterableEquals(
            List.of("/rag/documents/images/doc-1/legacy.png", "/documents/images/doc-1/current.png"),
            urls
        );
    }

    @Test
    void shouldReadImagesFromLegacyAndCanonicalUrls() throws Exception {
        ImageStorageService imageStorageService = mock(ImageStorageService.class);
        RagService service = createService(imageStorageService);
        Method method = RagService.class.getDeclaredMethod("readImageFromUrl", String.class);
        method.setAccessible(true);

        byte[] legacyBytes = new byte[] {1};
        byte[] canonicalBytes = new byte[] {2};
        when(imageStorageService.readImage("doc-1", "legacy.png")).thenReturn(legacyBytes);
        when(imageStorageService.readImage("doc-1", "current.png")).thenReturn(canonicalBytes);

        assertEquals(legacyBytes[0], ((byte[]) method.invoke(service, "/rag/documents/images/doc-1/legacy.png"))[0]);
        assertEquals(canonicalBytes[0], ((byte[]) method.invoke(service, "/documents/images/doc-1/current.png"))[0]);
    }

    @Test
    void shouldKeepSourceReferenceImagesForLegacyAndCanonicalUrls() throws Exception {
        RagService service = createService(mock(ImageStorageService.class));
        Method method = RagService.class.getDeclaredMethod("extractImageUrls", String.class);
        method.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<String> images = (List<String>) method.invoke(
            service,
            "![图1](/rag/documents/images/doc-1/legacy.png)\n![图2](/documents/images/doc-1/current.png)"
        );
        SourceReference reference = new SourceReference("sample.docx", "excerpt", 0.9, images);

        assertIterableEquals(
            List.of("/rag/documents/images/doc-1/legacy.png", "/documents/images/doc-1/current.png"),
            reference.images()
        );
    }

    private RagService createService(ImageStorageService imageStorageService) {
        return new RagService(
            mock(ChatModel.class),
            mock(StreamingChatModel.class),
            mock(EmbeddingModel.class),
            mock(QdrantEmbeddingStoreFactory.class),
            mock(ConversationMemoryService.class),
            mock(Bm25Scorer.class),
            mock(PromptService.class),
            imageStorageService
        );
    }
}
