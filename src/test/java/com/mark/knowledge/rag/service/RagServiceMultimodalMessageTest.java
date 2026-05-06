package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.TextContent;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RagServiceMultimodalMessageTest {

    @Test
    void shouldSummarizeMultimodalUserMessageWithoutSingleTextFailure() throws Exception {
        RagService service = new RagService(
            mock(ChatModel.class),
            mock(StreamingChatModel.class),
            mock(EmbeddingModel.class),
            mock(QdrantEmbeddingStoreFactory.class),
            mock(ConversationMemoryService.class),
            mock(Bm25Scorer.class),
            mock(PromptService.class),
            mock(ImageStorageService.class)
        );

        UserMessage message = UserMessage.from(
            TextContent.from("新增文档上下文：\n放大倍数偏低\n包含链接参数 %E6%B5%8B%E8%AF%95"),
            ImageContent.from("data:image/png;base64,AAAA")
        );

        Method method = RagService.class.getDeclaredMethod("summarizeUserMessage", UserMessage.class);
        method.setAccessible(true);

        String summary = assertDoesNotThrow(() -> (String) method.invoke(service, message));

        assertTrue(summary.contains("放大倍数偏低"));
        assertTrue(summary.contains("附带1张图片"));
        assertTrue(summary.contains("%E6%B5%8B%E8%AF%95"));
    }

    @Test
    void shouldRewriteQuestionWithMultimodalHistorySafely() throws Exception {
        ChatModel chatModel = mock(ChatModel.class);
        PromptService promptService = mock(PromptService.class);
        when(promptService.getPrompt("rag_rewrite")).thenReturn("""
            历史对话：
            %s

            当前问题：
            %s""");
        when(chatModel.chat(org.mockito.ArgumentMatchers.anyString())).thenReturn("改写后的问题");

        RagService service = new RagService(
            chatModel,
            mock(StreamingChatModel.class),
            mock(EmbeddingModel.class),
            mock(QdrantEmbeddingStoreFactory.class),
            mock(ConversationMemoryService.class),
            mock(Bm25Scorer.class),
            promptService,
            mock(ImageStorageService.class)
        );

        List<ChatMessage> history = List.of(
            UserMessage.from(
                TextContent.from("新增文档上下文：\n包含 %E6%B5%8B%E8%AF%95"),
                ImageContent.from("data:image/png;base64,AAAA")
            )
        );

        Method method = RagService.class.getDeclaredMethod("rewriteQuestion", String.class, List.class);
        method.setAccessible(true);

        String rewritten = assertDoesNotThrow(() -> (String) method.invoke(service, "放大倍数偏低", history));

        assertEquals("改写后的问题", rewritten);
    }
}
