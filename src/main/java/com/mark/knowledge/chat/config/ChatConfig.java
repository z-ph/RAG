package com.mark.knowledge.chat.config;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.ollama.OllamaChatModel;
import dev.langchain4j.model.ollama.OllamaEmbeddingModel;
import dev.langchain4j.model.ollama.OllamaStreamingChatModel;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiEmbeddingModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.Locale;

/**
 * 本地 RAG 核心配置。
 */
@Configuration
public class ChatConfig {

    private static final Logger log = LoggerFactory.getLogger(ChatConfig.class);
    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(120);

    @Value("${llm.chat-provider:ollama}")
    private String chatProvider;

    @Value("${llm.embedding-provider:ollama}")
    private String embeddingProvider;

    @Value("${llm.timeout:120s}")
    private String llmTimeout;

    @Value("${llm.ollama.chat-base-url:http://localhost:11434}")
    private String ollamaChatBaseUrl;

    @Value("${llm.ollama.embedding-base-url:http://localhost:11434}")
    private String ollamaEmbeddingBaseUrl;

    @Value("${llm.ollama.chat-model:qwen2.5:7b}")
    private String ollamaChatModelName;

    @Value("${llm.ollama.embedding-model:bge-base-zh}")
    private String ollamaEmbeddingModelName;

    @Value("${llm.ollama.think:${ollama.think:false}}")
    private Boolean ollamaThink;

    @Value("${llm.vllm.chat-base-url:http://localhost:8000/v1}")
    private String vllmChatBaseUrl;

    @Value("${llm.vllm.embedding-base-url:http://localhost:8000/v1}")
    private String vllmEmbeddingBaseUrl;

    @Value("${llm.vllm.chat-model:Qwen/Qwen2.5-7B-Instruct}")
    private String vllmChatModelName;

    @Value("${llm.vllm.embedding-model:BAAI/bge-base-zh-v1.5}")
    private String vllmEmbeddingModelName;

    @Value("${llm.vllm.chat-api-key:}")
    private String vllmChatApiKey;

    @Value("${llm.vllm.embedding-api-key:}")
    private String vllmEmbeddingApiKey;

    @Bean
    public ChatModel chatModel() {
        Duration timeout = parseTimeout(llmTimeout);
        return switch (normalizedChatProvider()) {
            case "ollama" -> createOllamaChatModel(timeout);
            case "vllm" -> createVllmChatModel(timeout);
            default -> throw unsupportedProvider("llm.chat-provider", chatProvider);
        };
    }

    @Bean
    public EmbeddingModel embeddingModel() {
        Duration timeout = parseTimeout(llmTimeout);
        return switch (normalizedEmbeddingProvider()) {
            case "ollama" -> createOllamaEmbeddingModel(timeout);
            case "vllm" -> createVllmEmbeddingModel(timeout);
            default -> throw unsupportedProvider("llm.embedding-provider", embeddingProvider);
        };
    }

    @Bean
    public StreamingChatModel streamingChatModel() {
        Duration timeout = parseTimeout(llmTimeout);
        return switch (normalizedChatProvider()) {
            case "ollama" -> createOllamaStreamingChatModel(timeout);
            case "vllm" -> createVllmStreamingChatModel(timeout);
            default -> throw unsupportedProvider("llm.chat-provider", chatProvider);
        };
    }

    private ChatModel createOllamaChatModel(Duration timeout) {
        log.info("初始化聊天模型: provider=ollama, baseUrl={}, model={}, think={}", ollamaChatBaseUrl, ollamaChatModelName, ollamaThink);
        return OllamaChatModel.builder()
                .baseUrl(ollamaChatBaseUrl)
                .modelName(ollamaChatModelName)
                .temperature(0.7)
                .think(Boolean.TRUE.equals(ollamaThink))
                .timeout(timeout)
                .build();
    }

    private EmbeddingModel createOllamaEmbeddingModel(Duration timeout) {
        log.info("初始化嵌入模型: provider=ollama, baseUrl={}, model={}", ollamaEmbeddingBaseUrl, ollamaEmbeddingModelName);
        return OllamaEmbeddingModel.builder()
                .baseUrl(ollamaEmbeddingBaseUrl)
                .modelName(ollamaEmbeddingModelName)
                .timeout(timeout)
                .build();
    }

    private StreamingChatModel createOllamaStreamingChatModel(Duration timeout) {
        log.info("初始化流式聊天模型: provider=ollama, baseUrl={}, model={}, think={}", ollamaChatBaseUrl, ollamaChatModelName, ollamaThink);
        return OllamaStreamingChatModel.builder()
                .baseUrl(ollamaChatBaseUrl)
                .modelName(ollamaChatModelName)
                .temperature(0.7)
                .think(Boolean.TRUE.equals(ollamaThink))
                .timeout(timeout)
                .build();
    }

    private ChatModel createVllmChatModel(Duration timeout) {
        log.info("初始化聊天模型: provider=vllm, baseUrl={}, model={}", vllmChatBaseUrl, vllmChatModelName);
        var builder = OpenAiChatModel.builder()
                .baseUrl(vllmChatBaseUrl)
                .modelName(vllmChatModelName)
                .temperature(0.7)
                .timeout(timeout);
        if (StringUtils.hasText(vllmChatApiKey)) {
            builder.apiKey(vllmChatApiKey);
        }
        return builder.build();
    }

    private StreamingChatModel createVllmStreamingChatModel(Duration timeout) {
        log.info("初始化流式聊天模型: provider=vllm, baseUrl={}, model={}", vllmChatBaseUrl, vllmChatModelName);
        var builder = OpenAiStreamingChatModel.builder()
                .baseUrl(vllmChatBaseUrl)
                .modelName(vllmChatModelName)
                .temperature(0.7)
                .timeout(timeout);
        if (StringUtils.hasText(vllmChatApiKey)) {
            builder.apiKey(vllmChatApiKey);
        }
        return builder.build();
    }

    private EmbeddingModel createVllmEmbeddingModel(Duration timeout) {
        log.info("初始化嵌入模型: provider=vllm, baseUrl={}, model={}", vllmEmbeddingBaseUrl, vllmEmbeddingModelName);
        var builder = OpenAiEmbeddingModel.builder()
                .baseUrl(vllmEmbeddingBaseUrl)
                .modelName(vllmEmbeddingModelName)
                .timeout(timeout);
        if (StringUtils.hasText(vllmEmbeddingApiKey)) {
            builder.apiKey(vllmEmbeddingApiKey);
        }
        return builder.build();
    }

    private String normalizedChatProvider() {
        return normalizedProvider(chatProvider, "llm.chat-provider");
    }

    private String normalizedEmbeddingProvider() {
        return normalizedProvider(embeddingProvider, "llm.embedding-provider");
    }

    private String normalizedProvider(String providerValue, String propertyName) {
        String provider = providerValue == null ? "" : providerValue.trim().toLowerCase(Locale.ROOT);
        if ("ollama".equals(provider) || "vllm".equals(provider)) {
            return provider;
        }
        throw unsupportedProvider(propertyName, providerValue);
    }

    private IllegalArgumentException unsupportedProvider(String propertyName, String propertyValue) {
        return new IllegalArgumentException("不支持的 " + propertyName + "=" + propertyValue + "，仅支持 ollama 或 vllm");
    }

    private Duration parseTimeout(String timeout) {
        try {
            if (!StringUtils.hasText(timeout)) {
                return DEFAULT_TIMEOUT;
            }
            String value = timeout.trim().toLowerCase(Locale.ROOT);
            if (value.endsWith("ms")) {
                long milliseconds = Long.parseLong(value.substring(0, value.length() - 2));
                return Duration.ofMillis(milliseconds);
            }
            if (value.endsWith("s")) {
                long seconds = Long.parseLong(value.substring(0, value.length() - 1));
                return Duration.ofSeconds(seconds);
            }
            if (value.endsWith("m")) {
                long minutes = Long.parseLong(value.substring(0, value.length() - 1));
                return Duration.ofMinutes(minutes);
            }
            return Duration.parse(timeout);
        } catch (Exception e) {
            log.warn("解析 llm.timeout 失败，使用默认值 {}: {}", DEFAULT_TIMEOUT, timeout);
            return DEFAULT_TIMEOUT;
        }
    }
}
