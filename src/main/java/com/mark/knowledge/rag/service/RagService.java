package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.RagRequest;
import com.mark.knowledge.rag.dto.RagResponse;
import com.mark.knowledge.rag.dto.SourceReference;
import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import com.mark.knowledge.config.structuredlogging.PipelineLogger;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.Content;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.TextContent;
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
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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

    @Value("${rag.chunk-dedup-enabled:true}")
    private boolean chunkDedupEnabled;

    @Value("${rag.image-to-llm-enabled:true}")
    private boolean imageToLlmEnabled;

    @Value("${rag.image-max-per-request:5}")
    private int imageMaxPerRequest;

    private final ChatModel chatModel;
    private final StreamingChatModel streamingChatModel;
    private final EmbeddingModel embeddingModel;
    private final QdrantEmbeddingStoreFactory embeddingStoreFactory;
    private final ConversationMemoryService conversationMemoryService;
    private final Bm25Scorer bm25Scorer;
    private final PromptService promptService;
    private final ImageStorageService imageStorageService;
    private final ConcurrentHashMap<String, InFlightGeneration> inFlightGenerations = new ConcurrentHashMap<>();

    public RagService(
            ChatModel chatModel,
            StreamingChatModel streamingChatModel,
            EmbeddingModel embeddingModel,
            QdrantEmbeddingStoreFactory embeddingStoreFactory,
            ConversationMemoryService conversationMemoryService,
            Bm25Scorer bm25Scorer,
            PromptService promptService,
            ImageStorageService imageStorageService) {
        this.chatModel = chatModel;
        this.streamingChatModel = streamingChatModel;
        this.embeddingModel = embeddingModel;
        this.embeddingStoreFactory = embeddingStoreFactory;
        this.conversationMemoryService = conversationMemoryService;
        this.bm25Scorer = bm25Scorer;
        this.promptService = promptService;
        this.imageStorageService = imageStorageService;
    }

    public RagResponse ask(RagRequest request) {
        log.info("处理 RAG 问题: {}", request.question());

        try {
            String conversationId = normalizeConversationId(request.conversationId());
            if (StringUtils.hasText(conversationId)) {
                cancelGenerationInternal(conversationId, "同步请求到达，取消已有流式生成");
            }

            List<ChatMessage> history = conversationMemoryService.getMessages(conversationId);
            long rewriteStart = System.nanoTime();
            String rewrittenQuestion = rewriteQuestion(request.question(), history);
            PipelineLogger.logStep(conversationId, "question_rewrite", request.question(), rewrittenQuestion, elapsedMillis(rewriteStart));
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

            long searchStart = System.nanoTime();
            EmbeddingSearchResult<TextSegment> searchResult = searchEmbeddingStore(searchRequest);
            List<EmbeddingMatch<TextSegment>> vectorMatches = searchResult.matches();
            PipelineLogger.logStep(conversationId, "vector_search", "dim=" + questionEmbedding.dimension(), "matches=" + vectorMatches.size(), elapsedMillis(searchStart));

            log.info("向量检索召回 {} 条候选片段，最小分数阈值: {}", vectorMatches.size(), minScore);

            if (vectorMatches.isEmpty()) {
                conversationMemoryService.appendUserMessage(conversationId, request.question());
                conversationMemoryService.appendAiMessage(conversationId, EMPTY_MATCH_ANSWER, null);
                return new RagResponse(
                    EMPTY_MATCH_ANSWER,
                    null,
                    conversationId,
                    new ArrayList<>()
                );
            }

            long rerankStart = System.nanoTime();
            List<HybridMatch> matches = rerankMatches(rewrittenQuestion, vectorMatches, requestedMaxResults);
            PipelineLogger.logStep(conversationId, "bm25_rerank", "candidates=" + vectorMatches.size(), "retained=" + matches.size(), elapsedMillis(rerankStart));
            log.info("BM25 重排耗时: {} ms，最终保留 {} 条片段", elapsedMillis(rerankStart), matches.size());

            matches = enrichWithCrossDocumentResults(request, matches, requestedMaxResults);
            PipelineLogger.logStep(conversationId, "cross_document", "initialMatches=" + matches.size(), "finalMatches=" + matches.size(), 0);

            String newContext = buildNewContext(conversationId, matches);
            extractAndRecordChunkHashes(conversationId, matches);

            List<ChatMessage> toSend = buildMessagesToSend(history, newContext, request.question());
            long answerStart = System.nanoTime();
            GeneratedAnswer generatedAnswer = generateAnswer(toSend);
            PipelineLogger.logStep(conversationId, "model_generate", "msgCount=" + toSend.size(), "answerLen=" + (generatedAnswer.answer() != null ? generatedAnswer.answer().length() : 0), elapsedMillis(answerStart));
            log.info("AI 基于知识库生成答案耗时: {} ms", elapsedMillis(answerStart));

            if (!newContext.isEmpty()) {
                conversationMemoryService.appendUserMessage(conversationId, "新增文档上下文：\n" + newContext);
            }
            conversationMemoryService.appendUserMessage(conversationId, request.question());
            conversationMemoryService.appendAiMessage(conversationId, generatedAnswer.answer(), generatedAnswer.thinking());

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
        long pipelineStart = System.nanoTime();

        try {
            if (shouldAbort(generation)) {
                return;
            }

            long historyStart = System.nanoTime();
            List<ChatMessage> history = conversationMemoryService.getMessages(conversationId);
            log.info("[TTFT-DETAIL] 获取历史: conversationId={}, elapsedMs={}, historySize={}, totalMs={}",
                conversationId, elapsedMillis(historyStart), history.size(), elapsedMillis(pipelineStart));

            long rewriteStart = System.nanoTime();
            String rewrittenQuestion = rewriteQuestion(request.question(), history);
            PipelineLogger.logStep(conversationId, "question_rewrite", request.question(), rewrittenQuestion, elapsedMillis(rewriteStart));
            log.info("[TTFT-DETAIL] 改写问题: conversationId={}, stepMs={}, originalLen={}, rewrittenLen={}, totalMs={}",
                conversationId, elapsedMillis(rewriteStart),
                request.question().length(), rewrittenQuestion.length(), elapsedMillis(pipelineStart));
            if (shouldAbort(generation)) {
                return;
            }

            int requestedMaxResults = resolveRequestedMaxResults(request);
            long questionEmbeddingStart = System.nanoTime();
            var questionEmbedding = embeddingModel.embed(rewrittenQuestion).content();
            log.info("[TTFT-DETAIL] 问题向量: conversationId={}, stepMs={}, dimension={}, totalMs={}",
                conversationId, elapsedMillis(questionEmbeddingStart), questionEmbedding.dimension(), elapsedMillis(pipelineStart));
            if (shouldAbort(generation)) {
                return;
            }

            long searchStart = System.nanoTime();
            EmbeddingSearchRequest searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(questionEmbedding)
                .maxResults(resolveCandidateMaxResults(requestedMaxResults))
                .minScore(minScore)
                .build();

            EmbeddingSearchResult<TextSegment> searchResult = searchEmbeddingStore(searchRequest);
            List<EmbeddingMatch<TextSegment>> vectorMatches = searchResult.matches();
            PipelineLogger.logStep(conversationId, "vector_search", "dim=" + questionEmbedding.dimension(), "matches=" + vectorMatches.size(), elapsedMillis(searchStart));
            log.info("[TTFT-DETAIL] 向量检索: conversationId={}, stepMs={}, matches={}, totalMs={}",
                conversationId, elapsedMillis(searchStart), vectorMatches.size(), elapsedMillis(pipelineStart));

            long rerankStart = System.nanoTime();
            List<HybridMatch> matches = rerankMatches(rewrittenQuestion, vectorMatches, requestedMaxResults);
            PipelineLogger.logStep(conversationId, "bm25_rerank", "candidates=" + vectorMatches.size(), "retained=" + matches.size(), elapsedMillis(rerankStart));
            log.info("[TTFT-DETAIL] BM25重排: conversationId={}, stepMs={}, retained={}, totalMs={}",
                conversationId, elapsedMillis(rerankStart), matches.size(), elapsedMillis(pipelineStart));

            long crossStart = System.nanoTime();
            matches = enrichWithCrossDocumentResults(request, matches, requestedMaxResults);
            PipelineLogger.logStep(conversationId, "cross_document", "initialMatches=" + matches.size(), "finalMatches=" + matches.size(), elapsedMillis(crossStart));
            log.info("[TTFT-DETAIL] 跨文档检索: conversationId={}, stepMs={}, total={}, totalMs={}",
                conversationId, elapsedMillis(crossStart), matches.size(), elapsedMillis(pipelineStart));

            String newContext = buildNewContext(conversationId, matches);
            extractAndRecordChunkHashes(conversationId, matches);

            sendEvent(generation, "sources", toSourceReferences(matches));
            log.info("[TTFT-DETAIL] sources已发送: conversationId={}, totalMs={}",
                conversationId, elapsedMillis(pipelineStart));
            if (shouldAbort(generation)) {
                return;
            }

            if (matches.isEmpty()) {
                sendEvent(generation, "delta", EMPTY_MATCH_ANSWER);
                conversationMemoryService.appendUserMessage(conversationId, request.question());
                conversationMemoryService.appendAiMessage(conversationId, EMPTY_MATCH_ANSWER, null);
                sendEvent(generation, "complete", buildCompletePayload(conversationId, false, EMPTY_MATCH_ANSWER, null));
                completeGeneration(generation);
                return;
            }

            List<ChatMessage> toSend = buildMessagesToSend(history, newContext, request.question());
            PipelineLogger.logStep(conversationId, "model_generate", "msgCount=" + toSend.size() + ", contextChunks=" + matches.size(), "streaming", elapsedMillis(pipelineStart));
            log.info("[TTFT-DETAIL] 调用模型: conversationId={}, messageCount={}, contextChunks={}, pipelineMs={}",
                conversationId, toSend.size(), matches.size(), elapsedMillis(pipelineStart));
            streamingChatModel.chat(toSend, new RagStreamingResponseHandler(generation, conversationId, pipelineStart, newContext));
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
        if (request.maxResults() != null && request.maxResults() >= 1) {
            return request.maxResults();
        }
        return Math.max(1, maxResults);
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

    private void extractAndRecordChunkHashes(String conversationId, List<HybridMatch> matches) {
        if (conversationId == null || matches == null || matches.isEmpty()) {
            return;
        }

        Set<String> chunkHashes = matches.stream()
            .map(match -> match.segment().metadata().getString("chunkHash"))
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        if (!chunkHashes.isEmpty()) {
            conversationMemoryService.recordUsedChunkHashes(conversationId, chunkHashes);
        }
    }

    private String rewriteQuestion(String question, List<ChatMessage> history) {
        if (history.isEmpty()) {
            return question;
        }

        String historyText = history.stream()
            .map(msg -> {
                if (msg instanceof UserMessage userMsg) {
                    return "用户：" + userMsg.singleText();
                } else if (msg instanceof AiMessage aiMsg) {
                    return "助手：" + aiMsg.text();
                }
                return null;
            })
            .filter(Objects::nonNull)
            .collect(Collectors.joining("\n"));

        if (historyText.isBlank()) {
            return question;
        }

        String rewriteTemplate = promptService.getPrompt("rag_rewrite");
        String rewritePrompt = String.format(rewriteTemplate, historyText, question);

        String rewritten = chatModel.chat(rewritePrompt);
        return rewritten != null && !rewritten.isBlank() ? rewritten.trim() : question;
    }

    private List<ChatMessage> buildMessagesToSend(List<ChatMessage> history, String newContext, String question) {
        String systemPrompt = promptService.getPrompt("rag_system");
        List<ChatMessage> toSend = new ArrayList<>();
        toSend.add(SystemMessage.from(systemPrompt));
        for (ChatMessage msg : history) {
            if (msg instanceof AiMessage aiMsg && aiMsg.thinking() != null) {
                toSend.add(AiMessage.from(aiMsg.text()));
            } else {
                toSend.add(msg);
            }
        }
        if (!newContext.isEmpty()) {
            List<String> imageUrls = extractImageUrls(newContext);
            if (imageToLlmEnabled && !imageUrls.isEmpty()) {
                List<String> limitedUrls = imageUrls.stream().limit(imageMaxPerRequest).toList();
                List<Content> contentParts = new ArrayList<>();
                contentParts.add(TextContent.from("新增文档上下文：\n" + newContext));
                for (String url : limitedUrls) {
                    try {
                        byte[] imageBytes = readImageFromUrl(url);
                        if (imageBytes != null) {
                            String mimeType = detectImageMimeType(imageBytes);
                            String base64 = Base64.getEncoder().encodeToString(imageBytes);
                            String dataUri = "data:" + mimeType + ";base64," + base64;
                            contentParts.add(ImageContent.from(dataUri));
                        }
                    } catch (Exception e) {
                        log.warn("注入图片到 LLM 上下文失败: {}", url, e);
                    }
                }
                toSend.add(UserMessage.from(contentParts));
                log.info("注入 {} 张图片到 LLM 上下文", limitedUrls.size());
            } else {
                toSend.add(UserMessage.from("新增文档上下文：\n" + newContext));
            }
        }
        toSend.add(UserMessage.from(question));

        log.debug("发送给模型的消息列表 (共 {} 条):", toSend.size());
        for (int i = 0; i < toSend.size(); i++) {
            ChatMessage msg = toSend.get(i);
            String preview;
            if (msg instanceof SystemMessage sysMsg) {
                preview = "[System] " + truncate(sysMsg.text(), 80);
            } else if (msg instanceof UserMessage userMsg) {
                preview = "[User] " + truncate(userMsg.singleText(), 80);
            } else if (msg instanceof AiMessage aiMsg) {
                String thinking = aiMsg.thinking();
                preview = "[Ai] text=" + truncate(aiMsg.text(), 60)
                    + ", hasThinking=" + (thinking != null && !thinking.isEmpty())
                    + ", thinkingLen=" + (thinking != null ? thinking.length() : 0);
            } else {
                preview = "[" + msg.type() + "] " + truncate(msg.toString(), 80);
            }
            log.debug("  msg[{}]: {}", i, preview);
        }

        return toSend;
    }

    private static String truncate(String s, int maxLen) {
        if (s == null) return "null";
        return s.length() <= maxLen ? s : s.substring(0, maxLen) + "...";
    }

    private String buildNewContext(String conversationId, List<HybridMatch> matches) {
        if (!chunkDedupEnabled || conversationId == null || matches == null || matches.isEmpty()) {
            return "";
        }

        Set<String> usedHashes = conversationMemoryService.getUsedChunkHashes(conversationId);
        if (usedHashes.isEmpty()) {
            return matches.stream()
                .map(match -> match.segment().text())
                .collect(Collectors.joining("\n\n---\n\n"));
        }

        List<HybridMatch> newMatches = matches.stream()
            .filter(match -> {
                String chunkHash = match.segment().metadata().getString("chunkHash");
                return chunkHash == null || !usedHashes.contains(chunkHash);
            })
            .collect(Collectors.toList());

        if (newMatches.isEmpty()) {
            log.info("会话 {} 所有片段已发送过，本轮不附加文档上下文", conversationId);
            return "";
        }

        log.info("会话 {} 去重后新增 {} / {} 条片段", conversationId, newMatches.size(), matches.size());
        return newMatches.stream()
            .map(match -> match.segment().text())
            .collect(Collectors.joining("\n\n---\n\n"));
    }

    private List<SourceReference> toSourceReferences(List<HybridMatch> matches) {
        return matches.stream()
            .map(match -> {
                TextSegment segment = match.segment();
                String filename = segment.metadata() != null
                    ? segment.metadata().getString("filename")
                    : "unknown";
                List<String> images = extractImageUrls(segment.text());
                return new SourceReference(filename, segment.text(), match.finalScore(), images);
            })
            .collect(Collectors.toList());
    }

    private static final Pattern IMAGE_URL_IN_CHUNK = Pattern.compile(
        "!\\[.*?\\]\\((/rag/documents/images/[^)]+)\\)"
    );

    private List<String> extractImageUrls(String text) {
        List<String> urls = new ArrayList<>();
        Matcher matcher = IMAGE_URL_IN_CHUNK.matcher(text);
        while (matcher.find()) {
            urls.add(matcher.group(1));
        }
        return urls;
    }

    private GeneratedAnswer generateAnswer(List<ChatMessage> messages) {
        ChatResponse response = chatModel.chat(messages);
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
        private final long handlerCreatedAt;
        private final long pipelineStartNanos;
        private final String newContext;
        private boolean firstTokenReceived = false;

        private RagStreamingResponseHandler(InFlightGeneration generation, String conversationId, long pipelineStartNanos, String newContext) {
            this.generation = generation;
            this.conversationId = conversationId;
            this.pipelineStartNanos = pipelineStartNanos;
            this.newContext = newContext;
            this.handlerCreatedAt = System.nanoTime();
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

            log.info("模型响应完成: conversationId={}, hasResponse={}, hasAiMessage={}, "
                    + "streamedThinkingLen={}, streamedAnswerLen={}, "
                    + "responseThinkingLen={}, responseAnswerLen={}",
                conversationId,
                response != null,
                response != null && response.aiMessage() != null,
                generation.thinking().length(),
                generation.answer().length(),
                response != null && response.aiMessage() != null && response.aiMessage().thinking() != null
                    ? response.aiMessage().thinking().length() : -1,
                response != null && response.aiMessage() != null && response.aiMessage().text() != null
                    ? response.aiMessage().text().length() : -1);

            String finalAnswer = generation.answer();
            String finalThinking = generation.thinking();
            if (response != null && response.aiMessage() != null) {
                // 仅当流式未产出答案时才使用完整响应文本（避免含 <think > 标签的原始文本覆盖已解析的内容）
                if (!StringUtils.hasLength(finalAnswer) && StringUtils.hasLength(response.aiMessage().text())) {
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
                    if (newContext != null && !newContext.isEmpty()) {
                        conversationMemoryService.appendUserMessage(conversationId, "新增文档上下文：\n" + newContext);
                    }
                    conversationMemoryService.appendUserMessage(conversationId, generation.question());
                    conversationMemoryService.appendAiMessage(conversationId, finalAnswer, finalThinking);
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
            if (!firstTokenReceived) {
                firstTokenReceived = true;
                log.info("[TTFT-DETAIL] 第一个回答token: conversationId={}, modelTtftMs={}, pipelineTtftMs={}",
                    conversationId, elapsedMillis(handlerCreatedAt), elapsedMillis(pipelineStartNanos));
            }

            // 某些模型（如 glm-4.6v-flash）在多轮对话时不会返回 reasoning_content，
            // 而是将思考内容包裹在 <think>...</think> 标签中放在 content 字段里。
            // 这里需要解析 <think> 标签，将标签内的内容路由到 thinking_delta 事件。
            String combined = generation.takeTagBuffer() + text;
            int processed = 0;

            while (processed < combined.length()) {
                if (generation.isInsideThinkTag()) {
                    int closeIdx = combined.indexOf("</think>", processed);
                    if (closeIdx >= 0) {
                        String thinking = combined.substring(processed, closeIdx);
                        if (!thinking.isEmpty()) {
                            generation.appendThinking(thinking);
                            sendEvent(generation, "thinking_delta", thinking);
                        }
                        generation.setInsideThinkTag(false);
                        processed = closeIdx + 8;
                        emitThinkingEndIfNeeded(generation, "think_tag_closed");
                    } else {
                        int remaining = combined.length() - processed;
                        if (remaining <= 8 && !combined.substring(processed).contains("<")) {
                            String thinking = combined.substring(processed);
                            if (!thinking.isEmpty()) {
                                generation.appendThinking(thinking);
                                sendEvent(generation, "thinking_delta", thinking);
                            }
                            generation.setTagBuffer("");
                            return;
                        }
                        int saveLen = Math.min(8, remaining);
                        int splitPoint = combined.length() - saveLen;
                        String thinking = combined.substring(processed, splitPoint);
                        if (!thinking.isEmpty()) {
                            generation.appendThinking(thinking);
                            sendEvent(generation, "thinking_delta", thinking);
                        }
                        generation.setTagBuffer(combined.substring(splitPoint));
                        return;
                    }
                } else {
                    int openIdx = combined.indexOf("<think>", processed);
                    if (openIdx >= 0) {
                        String beforeThink = combined.substring(processed, openIdx);
                        if (!beforeThink.isEmpty()) {
                            emitThinkingEndIfNeeded(generation, "answer_started");
                            generation.appendAnswer(beforeThink);
                            sendEvent(generation, "delta", beforeThink);
                        }
                        generation.setInsideThinkTag(true);
                        processed = openIdx + 7;
                    } else {
                        int remaining = combined.length() - processed;
                        if (remaining <= 7 && !combined.substring(processed).contains("<")) {
                            String answer = combined.substring(processed);
                            if (!answer.isEmpty()) {
                                emitThinkingEndIfNeeded(generation, "answer_started");
                                generation.appendAnswer(answer);
                                sendEvent(generation, "delta", answer);
                            }
                            generation.setTagBuffer("");
                            return;
                        }
                        int saveLen = Math.min(7, remaining);
                        int splitPoint = combined.length() - saveLen;
                        String answer = combined.substring(processed, splitPoint);
                        if (!answer.isEmpty()) {
                            emitThinkingEndIfNeeded(generation, "answer_started");
                            generation.appendAnswer(answer);
                            sendEvent(generation, "delta", answer);
                        }
                        generation.setTagBuffer(combined.substring(splitPoint));
                        return;
                    }
                }
            }

            generation.setTagBuffer("");
        }

        private void handlePartialThinking(String text) {
            if (!StringUtils.hasText(text) || generation.isCancelled() || generation.isCompleted()) {
                return;
            }
            if (!firstTokenReceived) {
                firstTokenReceived = true;
                log.info("[TTFT-DETAIL] 第一个思考token: conversationId={}, modelTtftMs={}, pipelineTtftMs={}",
                    conversationId, elapsedMillis(handlerCreatedAt), elapsedMillis(pipelineStartNanos));
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
        private volatile boolean insideThinkTag = false;
        private final StringBuilder tagBuffer = new StringBuilder();

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

        private boolean isInsideThinkTag() {
            return insideThinkTag;
        }

        private void setInsideThinkTag(boolean value) {
            insideThinkTag = value;
        }

        private String takeTagBuffer() {
            synchronized (tagBuffer) {
                String result = tagBuffer.toString();
                tagBuffer.setLength(0);
                return result;
            }
        }

        private void setTagBuffer(String value) {
            synchronized (tagBuffer) {
                tagBuffer.setLength(0);
                if (value != null) {
                    tagBuffer.append(value);
                }
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

    private byte[] readImageFromUrl(String url) {
        Matcher m = Pattern.compile("/documents/images/([^/]+)/([^/]+)").matcher(url);
        if (!m.find()) {
            return null;
        }
        return imageStorageService.readImage(m.group(1), m.group(2));
    }

    private static String detectImageMimeType(byte[] bytes) {
        if (bytes.length >= 4) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50) return "image/png";
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8) return "image/jpeg";
            if (bytes[0] == (byte) 0x47 && bytes[1] == (byte) 0x49) return "image/gif";
            if (bytes[0] == (byte) 0x42 && bytes[1] == (byte) 0x4D) return "image/bmp";
        }
        return "image/png";
    }
}
