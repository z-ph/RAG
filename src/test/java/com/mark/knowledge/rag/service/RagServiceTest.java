package com.mark.knowledge.rag.service;

import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.response.PartialThinking;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class RagServiceTest {

    @Test
    void shouldEmitThinkingEndBeforeAnswerDelta() throws Exception {
        PromptService promptService = new PromptService(null) {
            @Override void initDefaults() {}
            @Override public String getPrompt(String key) {
                if ("rag_system".equals(key)) return "你是RAG助手";
                if ("rag_rewrite".equals(key)) return "历史对话：%s\n当前问题：%s";
                return "";
            }
        };
        RagService service = new RagService(
            null,
            null,
            null,
            null,
            new ConversationMemoryService(6, 1800),
            new Bm25Scorer(),
            promptService
        );
        CapturingSseEmitter emitter = new CapturingSseEmitter();
        Object generation = newGeneration("request-1", "conversation-1", "问题", emitter);
        StreamingChatResponseHandler handler = newStreamingHandler(service, generation, "conversation-1", "");

        handler.onPartialThinking(new PartialThinking("先梳理命中的片段。"), null);
        handler.onPartialResponse("答案");
        handler.onCompleteResponse(null);

        assertEquals(
            List.of("thinking_delta", "thinking_end", "delta", "complete"),
            emitter.eventNames()
        );
    }

    @Test
    void shouldEmitThinkingEndWhenStreamCompletesWithoutAnswerDelta() throws Exception {
        PromptService promptService = new PromptService(null) {
            @Override void initDefaults() {}
            @Override public String getPrompt(String key) {
                if ("rag_system".equals(key)) return "你是RAG助手";
                if ("rag_rewrite".equals(key)) return "历史对话：%s\n当前问题：%s";
                return "";
            }
        };
        RagService service = new RagService(
            null,
            null,
            null,
            null,
            new ConversationMemoryService(6, 1800),
            new Bm25Scorer(),
            promptService
        );
        CapturingSseEmitter emitter = new CapturingSseEmitter();
        Object generation = newGeneration("request-2", "conversation-2", "问题", emitter);
        StreamingChatResponseHandler handler = newStreamingHandler(service, generation, "conversation-2", "");

        handler.onPartialThinking(new PartialThinking("先确认上下文范围。"), null);
        handler.onCompleteResponse(null);

        assertEquals(
            List.of("thinking_delta", "thinking_end", "complete"),
            emitter.eventNames()
        );
    }

    @Test
    void shouldBuildNewContextExcludingUsedChunks() throws Exception {
        ConversationMemoryService memoryService = new ConversationMemoryService(6, 1800);
        RagService service = new RagService(null, null, null, null, memoryService, new Bm25Scorer(), null);
        setChunkDedupEnabled(service, true);
        memoryService.recordUsedChunkHashes("test-conv-1", Set.of("hash1", "hash2"));

        List<Object> matches = createHybridMatches(Map.of(
            "hash1", "text1", "hash2", "text2", "hash3", "text3"
        ));

        String result = invokeBuildNewContext(service, "test-conv-1", matches);

        assertTrue(result.contains("text3"));
        assertFalse(result.contains("text1"));
        assertFalse(result.contains("text2"));
    }

    @Test
    void shouldReturnAllContextWhenDedupDisabled() throws Exception {
        ConversationMemoryService memoryService = new ConversationMemoryService(6, 1800);
        RagService service = new RagService(null, null, null, null, memoryService, new Bm25Scorer(), null);
        setChunkDedupEnabled(service, false);
        memoryService.recordUsedChunkHashes("test-conv-2", Set.of("hash1"));

        List<Object> matches = createHybridMatches(Map.of(
            "hash1", "text1", "hash2", "text2"
        ));

        String result = invokeBuildNewContext(service, "test-conv-2", matches);

        assertTrue(result.contains("text1"));
        assertTrue(result.contains("text2"));
    }

    @Test
    void shouldPreserveMatchesWithNullChunkHash() throws Exception {
        ConversationMemoryService memoryService = new ConversationMemoryService(6, 1800);
        RagService service = new RagService(null, null, null, null, memoryService, new Bm25Scorer(), null);
        setChunkDedupEnabled(service, true);
        memoryService.recordUsedChunkHashes("test-conv-3", Set.of("hash1"));

        Class<?> hybridMatchClass = findInnerClass("HybridMatch");
        Constructor<?> ctor = hybridMatchClass.getDeclaredConstructor(
            TextSegment.class, double.class, double.class, double.class
        );
        ctor.setAccessible(true);

        TextSegment seg1 = TextSegment.from("text-no-hash", new Metadata(Map.of()));
        TextSegment seg2 = TextSegment.from("text-with-hash", new Metadata(Map.of("chunkHash", "hash1")));

        Object m1 = ctor.newInstance(seg1, 0.9, 0.8, 0.85);
        Object m2 = ctor.newInstance(seg2, 0.8, 0.7, 0.75);

        String result = invokeBuildNewContext(service, "test-conv-3", List.of(m1, m2));

        assertTrue(result.contains("text-no-hash"));
        assertFalse(result.contains("text-with-hash"));
    }

    @Test
    void shouldReturnAllContextWhenNoUsedHashes() throws Exception {
        ConversationMemoryService memoryService = new ConversationMemoryService(6, 1800);
        RagService service = new RagService(null, null, null, null, memoryService, new Bm25Scorer(), null);
        setChunkDedupEnabled(service, true);

        List<Object> matches = createHybridMatches(Map.of(
            "hash1", "text1", "hash2", "text2", "hash3", "text3"
        ));

        String result = invokeBuildNewContext(service, "test-conv-4", matches);

        assertTrue(result.contains("text1"));
        assertTrue(result.contains("text2"));
        assertTrue(result.contains("text3"));
    }

    private List<Object> createHybridMatches(Map<String, String> hashToText) throws Exception {
        Class<?> hybridMatchClass = findInnerClass("HybridMatch");
        Constructor<?> ctor = hybridMatchClass.getDeclaredConstructor(
            TextSegment.class, double.class, double.class, double.class
        );
        ctor.setAccessible(true);

        List<Object> matches = new ArrayList<>();
        double score = 0.9;
        for (Map.Entry<String, String> entry : hashToText.entrySet()) {
            TextSegment seg = TextSegment.from(entry.getValue(), new Metadata(Map.of("chunkHash", entry.getKey())));
            matches.add(ctor.newInstance(seg, score, score - 0.1, score - 0.05));
            score -= 0.1;
        }
        return matches;
    }

    private String invokeBuildNewContext(RagService service, String conversationId, List<Object> matches) throws Exception {
        Method method = RagService.class.getDeclaredMethod("buildNewContext", String.class, List.class);
        method.setAccessible(true);
        return (String) method.invoke(service, conversationId, matches);
    }

    private void setChunkDedupEnabled(RagService service, boolean enabled) throws Exception {
        Field field = RagService.class.getDeclaredField("chunkDedupEnabled");
        field.setAccessible(true);
        field.setBoolean(service, enabled);
    }

    private Object newGeneration(
            String requestId,
            String conversationId,
            String question,
            SseEmitter emitter) throws Exception {
        Class<?> generationClass = findInnerClass("InFlightGeneration");
        Constructor<?> constructor = generationClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            SseEmitter.class
        );
        constructor.setAccessible(true);
        return constructor.newInstance(requestId, conversationId, question, emitter);
    }

    private StreamingChatResponseHandler newStreamingHandler(
            RagService service,
            Object generation,
            String conversationId,
            String newContext) throws Exception {
        Class<?> handlerClass = findInnerClass("RagStreamingResponseHandler");
        Constructor<?> constructor = handlerClass.getDeclaredConstructor(
            RagService.class,
            generation.getClass(),
            String.class,
            long.class,
            String.class
        );
        constructor.setAccessible(true);
        return (StreamingChatResponseHandler) constructor.newInstance(service, generation, conversationId, 0L, newContext);
    }

    private Class<?> findInnerClass(String simpleName) {
        for (Class<?> innerClass : RagService.class.getDeclaredClasses()) {
            if (innerClass.getSimpleName().equals(simpleName)) {
                return innerClass;
            }
        }
        throw new IllegalArgumentException("未找到内部类: " + simpleName);
    }

    private static final class CapturingSseEmitter extends SseEmitter {

        private static final Pattern EVENT_PATTERN = Pattern.compile("event:([^\\n]+)");

        private final List<String> eventNames = new ArrayList<>();

        @Override
        public synchronized void send(SseEventBuilder builder) throws IOException {
            StringBuilder serialized = new StringBuilder();
            for (ResponseBodyEmitter.DataWithMediaType item : builder.build()) {
                Object data = item.getData();
                if (data instanceof String text) {
                    serialized.append(text);
                }
            }

            Matcher matcher = EVENT_PATTERN.matcher(serialized);
            if (matcher.find()) {
                eventNames.add(matcher.group(1).trim());
            }
        }

        private List<String> eventNames() {
            return List.copyOf(eventNames);
        }
    }
}
