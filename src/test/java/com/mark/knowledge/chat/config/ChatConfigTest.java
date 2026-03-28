package com.mark.knowledge.chat.config;

import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.ollama.OllamaEmbeddingModel;
import dev.langchain4j.model.ollama.OllamaStreamingChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class ChatConfigTest {

    @Test
    void shouldAllowOllamaForChatAndEmbedding() {
        ChatConfig config = newChatConfig("ollama", "ollama");

        assertInstanceOf(OllamaChatModel.class, config.chatModel());
        assertInstanceOf(OllamaStreamingChatModel.class, config.streamingChatModel());
        assertInstanceOf(OllamaEmbeddingModel.class, config.embeddingModel());
    }

    @Test
    void shouldAllowVllmChatWithOllamaEmbedding() {
        ChatConfig config = newChatConfig("vllm", "ollama");

        assertInstanceOf(OpenAiChatModel.class, config.chatModel());
        assertInstanceOf(OpenAiStreamingChatModel.class, config.streamingChatModel());
        assertInstanceOf(OllamaEmbeddingModel.class, config.embeddingModel());
    }

    @Test
    void shouldAllowOllamaChatWithVllmEmbedding() {
        ChatConfig config = newChatConfig("ollama", "vllm");

        assertInstanceOf(OllamaChatModel.class, config.chatModel());
        assertInstanceOf(OllamaStreamingChatModel.class, config.streamingChatModel());
        assertInstanceOf(OpenAiEmbeddingModel.class, config.embeddingModel());
    }

    @Test
    void shouldAllowSameProviderWithDifferentEndpoints() {
        ChatConfig config = newChatConfig("vllm", "vllm");
        ReflectionTestUtils.setField(config, "vllmChatBaseUrl", "http://chat-host:8000/v1");
        ReflectionTestUtils.setField(config, "vllmEmbeddingBaseUrl", "http://embedding-host:9000/v1");

        assertInstanceOf(OpenAiChatModel.class, config.chatModel());
        assertInstanceOf(OpenAiStreamingChatModel.class, config.streamingChatModel());
        assertInstanceOf(OpenAiEmbeddingModel.class, config.embeddingModel());
    }

    private ChatConfig newChatConfig(String chatProvider, String embeddingProvider) {
        ChatConfig config = new ChatConfig();
        ReflectionTestUtils.setField(config, "chatProvider", chatProvider);
        ReflectionTestUtils.setField(config, "embeddingProvider", embeddingProvider);
        ReflectionTestUtils.setField(config, "llmTimeout", "120s");
        ReflectionTestUtils.setField(config, "ollamaChatBaseUrl", "http://localhost:11434");
        ReflectionTestUtils.setField(config, "ollamaEmbeddingBaseUrl", "http://localhost:11434");
        ReflectionTestUtils.setField(config, "ollamaChatModelName", "qwen2.5:7b");
        ReflectionTestUtils.setField(config, "ollamaEmbeddingModelName", "nomic-embed-text");
        ReflectionTestUtils.setField(config, "ollamaThink", false);
        ReflectionTestUtils.setField(config, "vllmChatBaseUrl", "http://localhost:8000/v1");
        ReflectionTestUtils.setField(config, "vllmEmbeddingBaseUrl", "http://localhost:8000/v1");
        ReflectionTestUtils.setField(config, "vllmChatModelName", "Qwen/Qwen2.5-7B-Instruct");
        ReflectionTestUtils.setField(config, "vllmEmbeddingModelName", "BAAI/bge-base-zh-v1.5");
        ReflectionTestUtils.setField(config, "vllmChatApiKey", "");
        ReflectionTestUtils.setField(config, "vllmEmbeddingApiKey", "");
        return config;
    }
}
