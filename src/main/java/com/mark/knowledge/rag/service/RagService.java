package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.RagRequest;
import com.mark.knowledge.rag.dto.RagResponse;
import com.mark.knowledge.rag.dto.SourceReference;
import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.StreamingChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import dev.langchain4j.model.chat.response.PartialResponse;
import dev.langchain4j.model.chat.response.PartialResponseContext;
import dev.langchain4j.model.chat.response.PartialThinking;
import dev.langchain4j.model.chat.response.PartialThinkingContext;
import dev.langchain4j.model.chat.response.StreamingChatResponseHandler;
import dev.langchain4j.model.chat.response.StreamingHandle;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

/**
 * RAG 问答服务。
 */
@Service
public class RagService {

    private static final Logger log = LoggerFactory.getLogger(RagService.class);
    private static final String EMPTY_MATCH_ANSWER = "未在已上传文档中检索到足够相关的内容，请根据文档内容重新提问。";

    @Value("${rag.max-results:5}")
    private int maxResults;

    @Value("${rag.min-score:0.5}")
    private double minScore;

    @Value("${rag.stream-timeout-ms:300000}")
    private long streamTimeoutMs;

    @Value("${rag.rerank.candidate-multiplier:4}")
    private int rerankCandidateMultiplier;

    @Value("${rag.rerank.vector-weight:0.6}")
    private double vectorWeight;

    @Value("${rag.rerank.bm25-weight:0.4}")
    private double bm25Weight;

    private final ChatModel chatModel;
    private final StreamingChatModel streamingChatModel;
    private final EmbeddingModel embeddingModel;
    private final QdrantEmbeddingStoreFactory embeddingStoreFactory;
    private final ConversationMemoryService conversationMemoryService;
    private final Bm25Scorer bm25Scorer;
    private final ConcurrentHashMap<String, InFlightGeneration> inFlightGenerations = new ConcurrentHashMap<>();

    public RagService(
            ChatModel chatModel,
            StreamingChatModel streamingChatModel,
            EmbeddingModel embeddingModel,
            QdrantEmbeddingStoreFactory embeddingStoreFactory,
            ConversationMemoryService conversationMemoryService,
            Bm25Scorer bm25Scorer) {
        this.chatModel = chatModel;
        this.streamingChatModel = streamingChatModel;
        this.embeddingModel = embeddingModel;
        this.embeddingStoreFactory = embeddingStoreFactory;
        this.conversationMemoryService = conversationMemoryService;
        this.bm25Scorer = bm25Scorer;
    }

    public RagResponse ask(RagRequest request) {
        log.info("处理 RAG 问题: {}", request.question());

        try {
            String conversationId = normalizeConversationId(request.conversationId());
            if (StringUtils.hasText(conversationId)) {
                cancelGenerationInternal(conversationId, "同步请求到达，取消已有流式生成");
            }

            List<ConversationMemoryService.ConversationMessage> history = conversationMemoryService
                .getRecentMessages(conversationId);
            String rewrittenQuestion = rewriteQuestion(request.question(), history);
            int requestedMaxResults = resolveRequestedMaxResults(request);

            long questionEmbeddingStart = System.nanoTime();
            var questionEmbedding = embeddingModel.embed(rewrittenQuestion).content();
            log.info("获取问题向量耗时: {} ms", elapsedMillis(questionEmbeddingStart));

            EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(questionEmbedding)
                .maxResults(resolveCandidateMaxResults(requestedMaxResults))
                .minScore(minScore)
                .build();

            log.info("问题向量维度: {}", questionEmbedding.dimension());

            EmbeddingSearchResult<TextSegment> searchResult = searchEmbeddingStore(searchRequest);
            List<EmbeddingMatch<TextSegment>> vectorMatches = searchResult.matches();

            log.info("向量检索召回 {} 条候选片段，最小分数阈值: {}", vectorMatches.size(), minScore);

            if (vectorMatches.isEmpty()) {
                conversationMemoryService.appendUserMessage(conversationId, request.question());
                conversationMemoryService.appendAssistantMessage(conversationId, EMPTY_MATCH_ANSWER);
                return new RagResponse(
                    EMPTY_MATCH_ANSWER,
                    null,
                    conversationId,
                    new ArrayList<>()
                );
            }

            long rerankStart = System.nanoTime();
            List<HybridMatch> matches = rerankMatches(rewrittenQuestion, vectorMatches, requestedMaxResults);
            log.info("BM25 重排耗时: {} ms，最终保留 {} 条片段", elapsedMillis(rerankStart), matches.size());

            matches = enrichWithCrossDocumentResults(request, matches, requestedMaxResults);

            String context = matches.stream()
                .map(match -> match.segment().text())
                .collect(Collectors.joining("\n\n---\n\n"));

            String prompt = buildPrompt(history, context, request.question());
            long answerStart = System.nanoTime();
            GeneratedAnswer generatedAnswer = generateAnswer(prompt);
            log.info("AI 基于知识库生成答案耗时: {} ms", elapsedMillis(answerStart));

            conversationMemoryService.appendUserMessage(conversationId, request.question());
            conversationMemoryService.appendAssistantMessage(conversationId, generatedAnswer.answer());

            return new RagResponse(
                generatedAnswer.answer(),
                generatedAnswer.thinking(),
                conversationId,
                toSourceReferences(matches)
            );
        } catch (Exception e) {
            log.error("RAG 处理失败", e);
            throw new RuntimeException("问题处理失败: " + e.getMessage(), e);
        }
    }

    public SseEmitter askStream(RagRequest request) {
        if (request.question() == null || request.question().trim().isEmpty()) {
            throw new IllegalArgumentException("问题不能为空");
        }

        String conversationId = resolveConversationIdForStream(request.conversationId());
        cancelGenerationInternal(conversationId, "同会话新请求到达，取消旧请求");

        SseEmitter emitter = new SseEmitter(streamTimeoutMs);
        InFlightGeneration generation = new InFlightGeneration(
            UUID.randomUUID().toString(),
            conversationId,
            request.question(),
            emitter
        );
        inFlightGenerations.put(conversationId, generation);

        emitter.onCompletion(() -> {
            cleanupGeneration(generation);
            log.debug("SSE 连接完成: conversationId={}, requestId={}", conversationId, generation.requestId());
        });
        emitter.onTimeout(() -> {
            log.warn("SSE 连接超时: conversationId={}, requestId={}", conversationId, generation.requestId());
            generation.markCancelled();
            generation.cancelHandle();
            emitThinkingEndIfNeeded(generation, "timeout");
            sendEvent(generation, "cancelled", Map.of("conversationId", conversationId, "reason", "timeout"));
            completeGeneration(generation);
        });
        emitter.onError(error -> {
            log.warn("SSE 连接错误: conversationId={}, requestId={}, error={}",
                conversationId, generation.requestId(), error == null ? "unknown" : error.getMessage());
            generation.markCancelled();
            generation.cancelHandle();
            completeGeneration(generation);
        });

        sendEvent(generation, "start", Map.of("conversationId", conversationId));

        CompletableFuture.runAsync(() -> processStreamRequest(request, generation));
        return emitter;
    }

    private void processStreamRequest(RagRequest request, InFlightGeneration generation) {
        String conversationId = generation.conversationId();

        try {
            if (shouldAbort(generation)) {
                return;
            }

            List<ConversationMemoryService.ConversationMessage> history = conversationMemoryService
                .getRecentMessages(conversationId);
            String rewrittenQuestion = rewriteQuestion(request.question(), history);
            if (shouldAbort(generation)) {
                return;
            }

            int requestedMaxResults = resolveRequestedMaxResults(request);
            long questionEmbeddingStart = System.nanoTime();
            var questionEmbedding = embeddingModel.embed(rewrittenQuestion).content();
            log.info("流式获取问题向量耗时: conversationId={}, elapsedMs={}",
                conversationId, elapsedMillis(questionEmbeddingStart));
            if (shouldAbort(generation)) {
                return;
            }

            EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(questionEmbedding)
                .maxResults(resolveCandidateMaxResults(requestedMaxResults))
                .minScore(minScore)
                .build();

            log.info("流式问题向量维度: conversationId={}, dimension={}", conversationId, questionEmbedding.dimension());

            EmbeddingSearchResult<TextSegment> searchResult = searchEmbeddingStore(searchRequest);
            List<EmbeddingMatch<TextSegment>> vectorMatches = searchResult.matches();
            log.info("流式向量检索召回: conversationId={}, matches={}, minScore={}",
                conversationId, vectorMatches.size(), minScore);

            long rerankStart = System.nanoTime();
            List<HybridMatch> matches = rerankMatches(rewrittenQuestion, vectorMatches, requestedMaxResults);
            log.info("流式 BM25 重排耗时: conversationId={}, elapsedMs={}, retained={}",
                conversationId, elapsedMillis(rerankStart), matches.size());

            matches = enrichWithCrossDocumentResults(request, matches, requestedMaxResults);

            sendEvent(generation, "sources", toSourceReferences(matches));
            if (shouldAbort(generation)) {
                return;
            }

            if (matches.isEmpty()) {
                sendEvent(generation, "delta", EMPTY_MATCH_ANSWER);
                conversationMemoryService.appendUserMessage(conversationId, request.question());
                conversationMemoryService.appendAssistantMessage(conversationId, EMPTY_MATCH_ANSWER);
                sendEvent(generation, "complete", buildCompletePayload(conversationId, false, EMPTY_MATCH_ANSWER, null));
                completeGeneration(generation);
                return;
            }

            String context = matches.stream()
                .map(match -> match.segment().text())
                .collect(Collectors.joining("\n\n---\n\n"));
            String prompt = buildPrompt(history, context, request.question());
            streamingChatModel.chat(prompt, new RagStreamingResponseHandler(generation, conversationId));
        } catch (Exception e) {
            if (generation.isCancelled() || generation.isCompleted()) {
                completeGeneration(generation);
                return;
            }
            log.error("流式 RAG 处理失败: conversationId={}", conversationId, e);
            sendEvent(generation, "error", Map.of("message", safeErrorMessage(e)));
            completeWithError(generation, e);
        }
    }

    public boolean cancelGeneration(String conversationId) {
        String normalizedConversationId = normalizeConversationId(conversationId);
        if (!StringUtils.hasText(normalizedConversationId)) {
            return false;
        }
        return cancelGenerationInternal(normalizedConversationId, "用户主动取消");
    }

    private boolean cancelGenerationInternal(String conversationId, String reason) {
        InFlightGeneration generation = inFlightGenerations.get(conversationId);
        if (generation == null) {
            return false;
        }
        if (!generation.markCancelled()) {
            return false;
        }

        log.info("取消流式生成: conversationId={}, requestId={}, reason={}", conversationId, generation.requestId(), reason);
        generation.cancelHandle();
        emitThinkingEndIfNeeded(generation, reason);
        sendEvent(generation, "cancelled", Map.of("conversationId", conversationId, "reason", reason));
        completeGeneration(generation);
        return true;
    }

    private void completeGeneration(InFlightGeneration generation) {
        if (!generation.markCompleted()) {
            return;
        }
        cleanupGeneration(generation);
        try {
            generation.emitter().complete();
        } catch (Exception e) {
            log.debug("结束 SSE 连接时忽略异常: conversationId={}, requestId={}, message={}",
                generation.conversationId(), generation.requestId(), e.getMessage());
        }
    }

    private void completeWithError(InFlightGeneration generation, Throwable error) {
        if (!generation.markCompleted()) {
            return;
        }
        cleanupGeneration(generation);
        try {
            generation.emitter().completeWithError(error);
        } catch (Exception e) {
            log.debug("结束异常 SSE 连接时忽略异常: conversationId={}, requestId={}, message={}",
                generation.conversationId(), generation.requestId(), e.getMessage());
        }
    }

    private void cleanupGeneration(InFlightGeneration generation) {
        inFlightGenerations.compute(generation.conversationId(), (conversationId, current) -> {
            if (current == null) {
                return null;
            }
            return generation.requestId().equals(current.requestId()) ? null : current;
        });
    }

    private void sendEvent(InFlightGeneration generation, String eventName, Object data) {
        if (generation.isCompleted()) {
            return;
        }
        try {
            generation.emitter().send(SseEmitter.event().name(eventName).data(data));
        } catch (IOException e) {
            log.warn("发送 SSE 事件失败: conversationId={}, requestId={}, event={}",
                generation.conversationId(), generation.requestId(), eventName);
            generation.markCancelled();
            generation.cancelHandle();
            completeGeneration(generation);
        }
    }

    private boolean shouldAbort(InFlightGeneration generation) {
        return generation.isCancelled()
            || generation.isCompleted()
            || inFlightGenerations.get(generation.conversationId()) != generation;
    }

    private long elapsedMillis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    private EmbeddingSearchResult<TextSegment> searchEmbeddingStore(EmbeddingSearchRequest searchRequest) {
        QdrantEmbeddingStore embeddingStore = embeddingStoreFactory.createStore();
        try {
            return embeddingStore.search(searchRequest);
        } finally {
            closeQuietly(embeddingStore);
        }
    }

    private int resolveRequestedMaxResults(RagRequest request) {
        int configuredMaxResults = Math.max(1, maxResults);
        if (request.maxResults() == null || request.maxResults() < 1) {
            return configuredMaxResults;
        }
        return Math.min(request.maxResults(), configuredMaxResults);
    }

    private int resolveCandidateMaxResults(int requestedMaxResults) {
        int candidateMultiplier = Math.max(1, rerankCandidateMultiplier);
        return Math.max(requestedMaxResults, requestedMaxResults * candidateMultiplier);
    }

    private List<HybridMatch> rerankMatches(
            String query,
            List<EmbeddingMatch<TextSegment>> candidates,
            int limit) {
        if (candidates.isEmpty()) {
            return List.of();
        }

        List<String> candidateTexts = candidates.stream()
            .map(match -> match.embedded().text())
            .collect(Collectors.toList());
        List<Double> bm25Scores = bm25Scorer.score(query, candidateTexts);
        List<Double> normalizedVectorScores = normalizeScores(candidates.stream()
            .map(EmbeddingMatch::score)
            .collect(Collectors.toList()));
        List<Double> normalizedBm25Scores = normalizeScores(bm25Scores);

        double safeVectorWeight = Math.max(0.0, vectorWeight);
        double safeBm25Weight = Math.max(0.0, bm25Weight);
        double totalWeight = safeVectorWeight + safeBm25Weight;
        double normalizedVectorWeight = totalWeight == 0.0 ? 0.5 : safeVectorWeight / totalWeight;
        double normalizedBm25Weight = totalWeight == 0.0 ? 0.5 : safeBm25Weight / totalWeight;

        List<HybridMatch> rerankedMatches = new ArrayList<>(candidates.size());
        for (int i = 0; i < candidates.size(); i++) {
            EmbeddingMatch<TextSegment> candidate = candidates.get(i);
            double finalScore = normalizedVectorScores.get(i) * normalizedVectorWeight
                + normalizedBm25Scores.get(i) * normalizedBm25Weight;
            rerankedMatches.add(new HybridMatch(
                candidate.embedded(),
                candidate.score(),
                bm25Scores.get(i),
                finalScore
            ));
        }

        Comparator<HybridMatch> scoreComparator = Comparator
            .comparingDouble(HybridMatch::finalScore).reversed()
            .thenComparing(Comparator.comparingDouble(HybridMatch::semanticScore).reversed())
            .thenComparing(Comparator.comparingDouble(HybridMatch::bm25Score).reversed());

        return rerankedMatches.stream()
            .sorted(scoreComparator)
            .limit(limit)
            .collect(Collectors.toList());
    }

    private List<Double> normalizeScores(List<Double> scores) {
        if (scores.isEmpty()) {
            return List.of();
        }

        double min = scores.stream().mapToDouble(Double::doubleValue).min().orElse(0.0);
        double max = scores.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);

        if (Double.compare(max, min) == 0) {
            double normalizedValue = max > 0.0 ? 1.0 : 0.0;
            return scores.stream()
                .map(score -> normalizedValue)
                .collect(Collectors.toList());
        }

        double range = max - min;
        return scores.stream()
            .map(score -> (score - min) / range)
            .collect(Collectors.toList());
    }

    /**
     * 从上下文中提取被引用的文档名
     * 匹配模式如："见《XX管理办法》"、"参见XX规定"、"详见XX"
     */
    private List<String> extractReferencedDocuments(String context) {
        List<String> refs = new ArrayList<>();
        Pattern[] patterns = {
            Pattern.compile("\u89c1[\u300a\u300c]([^\u300b\u300d]+)[\u300b\u300d]"),
            Pattern.compile("\u53c2\u89c1[\u300a\u300c]?([^\u300b\u300d\\s]+(?:\u529e\u6cd5|\u89c4\u5b9a|\u5236\u5ea6|\u7ec6\u5219))[\u300b\u300d]?"),
            Pattern.compile("\u8be6\u89c1[\u300a\u300c]?([^\u300b\u300d\\s]+(?:\u529e\u6cd5|\u89c4\u5b9a|\u5236\u5ea6|\u7ec6\u5219))[\u300b\u300d]?"),
            Pattern.compile("\u6309\u7167?[\u300a\u300c]([^\u300b\u300d]+)[\u300b\u300d]"),
        };
        for (Pattern p : patterns) {
            Matcher m = p.matcher(context);
            while (m.find()) {
                refs.add(m.group(1));
            }
        }
        return refs;
    }

    /**
     * 基于引用的文档名进行二次检索
     */
    private List<HybridMatch> crossDocumentSearch(
            String question,
            List<String> referencedDocs,
            int maxResults) {
        String enhancedQuery = question + " " + String.join(" ", referencedDocs);
        var embedding = embeddingModel.embed(enhancedQuery).content();

        EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
            .queryEmbedding(embedding)
            .maxResults(resolveCandidateMaxResults(maxResults))
            .minScore(minScore * 0.8)
            .build();

        EmbeddingSearchResult<TextSegment> result = searchEmbeddingStore(searchRequest);
        return rerankMatches(enhancedQuery, result.matches(), maxResults);
    }

    /**
     * 对首次检索结果执行跨文档关联检测和二次检索，合并结果
     */
    private List<HybridMatch> enrichWithCrossDocumentResults(
            RagRequest request,
            List<HybridMatch> matches,
            int requestedMaxResults) {
        String initialContext = matches.stream()
            .map(m -> m.segment().text())
            .collect(Collectors.joining("\n\n"));
        List<String> refs = extractReferencedDocuments(initialContext);

        if (refs.isEmpty()) {
            return matches;
        }

        log.info("检测到跨文档引用: {}", refs);
        List<HybridMatch> crossMatches = crossDocumentSearch(
            request.question(), refs, requestedMaxResults);

        if (crossMatches.isEmpty()) {
            return matches;
        }

        Set<String> existingHashes = matches.stream()
            .map(m -> m.segment().metadata().getString("chunkHash"))
            .collect(Collectors.toSet());

        List<HybridMatch> merged = new ArrayList<>(matches);
        for (HybridMatch cm : crossMatches) {
            String hash = cm.segment().metadata().getString("chunkHash");
            if (!existingHashes.contains(hash)) {
                merged.add(cm);
                existingHashes.add(hash);
            }
        }

        log.info("跨文档关联检索完成，合并后共 {} 条片段", merged.size());
        return merged.stream()
            .sorted(Comparator.comparingDouble(HybridMatch::finalScore).reversed())
            .limit(requestedMaxResults)
            .collect(Collectors.toList());
    }

    private String rewriteQuestion(String question, List<ConversationMemoryService.ConversationMessage> history) {
        if (history.isEmpty()) {
            return question;
        }

        String historyText = formatHistory(history);
        String rewritePrompt = String.format("""
            你需要结合历史对话，把用户当前问题改写成一个完整、独立、可用于知识库检索的问题。
            如果当前问题本身已经完整，直接原样返回，不要增加解释。
            只输出改写后的问题，不要输出其它内容。

            历史对话：
            %s

            当前问题：
            %s
            """, historyText, question);

        String rewritten = chatModel.chat(rewritePrompt);
        return rewritten != null && !rewritten.isBlank() ? rewritten.trim() : question;
    }

    private String buildPrompt(
            List<ConversationMemoryService.ConversationMessage> history,
            String context,
            String question) {        String historyText = history.isEmpty() ? "无" : formatHistory(history);

        return String.format("""
            你是一个企业制度文档智能问答助手，基于提供的文档内容回答用户问题。

            ## 回答原则

            1. **语义理解与语境区分**：
               - 准确理解制度条文在特定语境下的含义
               - 区分相似但不同的概念（如"烟酒"指烟类和酒类产品，不等同于化学"酒精"；医用酒精不属于烟酒范畴）
               - 识别具体品牌或产品的归属类别（如"茅台"、"五粮液"属于"酒类"，应适用烟酒相关限制）
               - 遇到歧义时，优先采用制度文件中的定义，而非日常用语

            2. **引导式回答**：
               - 如果用户的问题过于笼统（如"怎么报销"、"有什么规定"），必须主动追问以明确具体场景
               - 追问要简洁具体，提供2-4个选项供用户选择
               - 例如："请问您咨询的是哪类费用的报销？（差旅费 / 接待费 / 办公费 / 其他）"
               - 仅在问题确实模糊不清时才追问，已有足够上下文时直接回答

            3. **举例说明**：
               - 在解释抽象制度条文时，用贴近实际工作场景的具体例子帮助理解
               - 用"例如："前缀标注举例内容，与正式条文区分
               - 举例应涵盖常见场景和边界情况

            4. **严格依据文档**：
               - 答案必须基于下方提供的文档上下文
               - 如果文档中没有相关信息，明确告知"根据已上传文档，暂未找到相关规定"
               - 不编造、不推测文档之外的内容

            ## 格式要求
            - 使用中文回答
            - 引用制度原文时用引号标注
            - 列举多项时使用编号列表

            历史对话：
            %s

            文档上下文：
            %s

            用户当前问题：%s

            请直接回答：""", historyText, context, question);
    }

    private String formatHistory(List<ConversationMemoryService.ConversationMessage> history) {
        return history.stream()
            .map(message -> (message.role() == ConversationMemoryService.ConversationRole.USER ? "用户：" : "助手：")
                + message.content())
            .collect(Collectors.joining("\n"));
    }

    private List<SourceReference> toSourceReferences(List<HybridMatch> matches) {
        return matches.stream()
            .map(match -> {
                TextSegment segment = match.segment();
                String filename = segment.metadata() != null
                    ? segment.metadata().getString("filename")
                    : "unknown";
                return new SourceReference(filename, segment.text(), match.finalScore());
            })
            .collect(Collectors.toList());
    }

    private GeneratedAnswer generateAnswer(String prompt) {
        ChatResponse response = chatModel.chat(UserMessage.from(prompt));
        if (response == null || response.aiMessage() == null) {
            return new GeneratedAnswer("", null);
        }

        String answer = response.aiMessage().text();
        return new GeneratedAnswer(answer == null ? "" : answer, response.aiMessage().thinking());
    }

    private String resolveConversationIdForStream(String conversationId) {
        String normalized = normalizeConversationId(conversationId);
        if (StringUtils.hasText(normalized)) {
            return normalized;
        }
        return "rag-" + UUID.randomUUID();
    }

    private String normalizeConversationId(String conversationId) {
        if (!StringUtils.hasText(conversationId)) {
            return null;
        }
        return conversationId.trim();
    }

    private String safeErrorMessage(Throwable error) {
        if (error == null || !StringUtils.hasText(error.getMessage())) {
            return "未知错误";
        }
        return error.getMessage();
    }

    private Map<String, Object> buildCompletePayload(
            String conversationId,
            boolean cancelled,
            String content,
            String thinking) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("conversationId", conversationId);
        payload.put("cancelled", cancelled);
        putIfHasLength(payload, "content", content);
        putIfHasLength(payload, "thinking", thinking);
        return payload;
    }

    private Map<String, Object> buildThinkingEndPayload(String conversationId, String reason) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("conversationId", conversationId);
        payload.put("thinkingEnded", true);
        putIfHasLength(payload, "reason", reason);
        return payload;
    }

    private void putIfHasLength(Map<String, Object> payload, String key, String value) {
        if (StringUtils.hasLength(value)) {
            payload.put(key, value);
        }
    }

    private void emitThinkingEndIfNeeded(InFlightGeneration generation, String reason) {
        if (generation == null || generation.isCompleted()) {
            return;
        }
        if (!generation.hasThinking() || !generation.markThinkingEnded()) {
            return;
        }
        sendEvent(generation, "thinking_end", buildThinkingEndPayload(generation.conversationId(), reason));
    }

    private void closeQuietly(QdrantEmbeddingStore embeddingStore) {
        QdrantStoreUtils.closeQuietly(embeddingStore);
    }

    private final class RagStreamingResponseHandler implements StreamingChatResponseHandler {

        private final InFlightGeneration generation;
        private final String conversationId;

        private RagStreamingResponseHandler(InFlightGeneration generation, String conversationId) {
            this.generation = generation;
            this.conversationId = conversationId;
        }

        @Override
        public void onPartialResponse(String partialResponse) {
            handlePartialText(partialResponse);
        }

        @Override
        public void onPartialResponse(PartialResponse partialResponse, PartialResponseContext context) {
            if (context != null) {
                generation.captureHandle(context.streamingHandle());
            }
            if (partialResponse != null) {
                handlePartialText(partialResponse.text());
            }
        }

        @Override
        public void onPartialThinking(PartialThinking partialThinking, PartialThinkingContext context) {
            if (context != null) {
                generation.captureHandle(context.streamingHandle());
            }
            if (partialThinking != null) {
                handlePartialThinking(partialThinking.text());
            }
        }

        @Override
        public void onCompleteResponse(ChatResponse response) {
            if (generation.isCompleted()) {
                return;
            }

            String finalAnswer = generation.answer();
            String finalThinking = generation.thinking();
            if (response != null && response.aiMessage() != null) {
                if (StringUtils.hasLength(response.aiMessage().text())) {
                    finalAnswer = response.aiMessage().text();
                }
                if (StringUtils.hasLength(response.aiMessage().thinking())) {
                    finalThinking = response.aiMessage().thinking();
                }
            }
            if (StringUtils.hasLength(finalThinking)) {
                generation.syncThinking(finalThinking);
            }
            emitThinkingEndIfNeeded(generation, "complete");

            if (!generation.isCancelled()) {
                if (StringUtils.hasText(finalAnswer)) {
                    conversationMemoryService.appendUserMessage(conversationId, generation.question());
                    conversationMemoryService.appendAssistantMessage(conversationId, finalAnswer);
                }
                sendEvent(generation, "complete", buildCompletePayload(conversationId, false, finalAnswer, finalThinking));
            } else {
                sendEvent(generation, "complete", buildCompletePayload(conversationId, true, finalAnswer, finalThinking));
            }
            completeGeneration(generation);
        }

        @Override
        public void onError(Throwable error) {
            if (generation.isCancelled()) {
                emitThinkingEndIfNeeded(generation, "cancelled");
                sendEvent(generation, "complete",
                    buildCompletePayload(conversationId, true, generation.answer(), generation.thinking()));
                completeGeneration(generation);
                return;
            }

            log.error("流式模型响应失败: conversationId={}, requestId={}", conversationId, generation.requestId(), error);
            emitThinkingEndIfNeeded(generation, "error");
            sendEvent(generation, "error", Map.of("message", safeErrorMessage(error)));
            completeWithError(generation, error);
        }

        private void handlePartialText(String text) {
            if (!StringUtils.hasText(text) || generation.isCancelled() || generation.isCompleted()) {
                return;
            }
            emitThinkingEndIfNeeded(generation, "answer_started");
            generation.appendAnswer(text);
            sendEvent(generation, "delta", text);
        }

        private void handlePartialThinking(String text) {
            if (!StringUtils.hasText(text) || generation.isCancelled() || generation.isCompleted()) {
                return;
            }
            generation.appendThinking(text);
            sendEvent(generation, "thinking_delta", text);
        }
    }

    private static final class InFlightGeneration {
        private final String requestId;
        private final String conversationId;
        private final String question;
        private final SseEmitter emitter;
        private final AtomicReference<StreamingHandle> handleRef = new AtomicReference<>();
        private final AtomicBoolean cancelled = new AtomicBoolean(false);
        private final AtomicBoolean completed = new AtomicBoolean(false);
        private final AtomicBoolean thinkingEnded = new AtomicBoolean(false);
        private final StringBuilder answerBuilder = new StringBuilder();
        private final StringBuilder thinkingBuilder = new StringBuilder();

        private InFlightGeneration(String requestId, String conversationId, String question, SseEmitter emitter) {
            this.requestId = requestId;
            this.conversationId = conversationId;
            this.question = question;
            this.emitter = emitter;
        }

        private String requestId() {
            return requestId;
        }

        private String conversationId() {
            return conversationId;
        }

        private String question() {
            return question;
        }

        private SseEmitter emitter() {
            return emitter;
        }

        private void captureHandle(StreamingHandle handle) {
            if (handle == null) {
                return;
            }

            StreamingHandle previous = handleRef.getAndSet(handle);
            if (previous != null && previous != handle && !previous.isCancelled()) {
                previous.cancel();
            }

            if (isCancelled() || isCompleted()) {
                handle.cancel();
            }
        }

        private void cancelHandle() {
            StreamingHandle handle = handleRef.get();
            if (handle == null) {
                return;
            }
            try {
                handle.cancel();
            } catch (Exception ignored) {
            }
        }

        private boolean markCancelled() {
            return cancelled.compareAndSet(false, true);
        }

        private boolean isCancelled() {
            return cancelled.get();
        }

        private boolean markCompleted() {
            return completed.compareAndSet(false, true);
        }

        private boolean isCompleted() {
            return completed.get();
        }

        private boolean markThinkingEnded() {
            return thinkingEnded.compareAndSet(false, true);
        }

        private void appendAnswer(String text) {
            synchronized (answerBuilder) {
                answerBuilder.append(text);
            }
        }

        private String answer() {
            synchronized (answerBuilder) {
                return answerBuilder.toString();
            }
        }

        private void appendThinking(String text) {
            synchronized (thinkingBuilder) {
                thinkingBuilder.append(text);
            }
        }

        private void syncThinking(String text) {
            synchronized (thinkingBuilder) {
                thinkingBuilder.setLength(0);
                thinkingBuilder.append(text);
            }
        }

        private String thinking() {
            synchronized (thinkingBuilder) {
                return thinkingBuilder.toString();
            }
        }

        private boolean hasThinking() {
            synchronized (thinkingBuilder) {
                return thinkingBuilder.length() > 0;
            }
        }
    }

    private record GeneratedAnswer(
        String answer,
        String thinking
    ) {
    }

    private record HybridMatch(
        TextSegment segment,
        double semanticScore,
        double bm25Score,
        double finalScore
    ) {
    }
}
