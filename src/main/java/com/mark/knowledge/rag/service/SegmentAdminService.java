package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.store.QdrantEmbeddingStoreFactory;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.model.embedding.EmbeddingModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.codec.ClientCodecConfigurer;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class SegmentAdminService {

    private static final Logger log = LoggerFactory.getLogger(SegmentAdminService.class);
    private static final int SCROLL_PAGE_SIZE = 64;
    private static final int WEBCLIENT_MAX_IN_MEMORY_SIZE = 2 * 1024 * 1024;

    private final String collectionName;
    private final WebClient webClient;
    private final EmbeddingModel embeddingModel;

    public SegmentAdminService(
            @Value("${qdrant.host:localhost}") String qdrantHost,
            @Value("${qdrant.http-port:6333}") int qdrantHttpPort,
            @Value("${qdrant.collection-name:knowledge-base}") String collectionName,
            EmbeddingModel embeddingModel) {
        this.collectionName = collectionName;
        this.embeddingModel = embeddingModel;
        this.webClient = WebClient.builder()
            .codecs(this::configureCodecs)
            .baseUrl(String.format("http://%s:%d", qdrantHost, qdrantHttpPort))
            .build();
    }

    public List<SegmentInfo> listSegments(String documentId) {
        List<QdrantPoint> points = scrollFiltered(documentId);
        return points.stream()
            .map(p -> {
                String text = extractText(p.payload());
                String chunkIndex = asString(p.payload().get("chunkIndex"));
                String title = asString(p.payload().get("title"));
                String category = asString(p.payload().get("category"));
                String keywords = asString(p.payload().get("keywords"));
                return new SegmentInfo(
                    String.valueOf(p.id()),
                    text != null ? text : "",
                    chunkIndex != null ? Integer.parseInt(chunkIndex) : 0,
                    title != null ? title : "",
                    category != null ? category : "",
                    keywords != null ? keywords : ""
                );
            })
            .sorted((a, b) -> Integer.compare(a.chunkIndex(), b.chunkIndex()))
            .toList();
    }

    public SegmentInfo updateSegment(String pointId, String newText) {
        Embedding newEmbedding = embeddingModel.embed(newText).content();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("text_segment", newText);
        payload.put("text_content", newText);
        payload.put("chunkSize", String.valueOf(newText.length()));

        Map<String, Object> point = new LinkedHashMap<>();
        point.put("id", pointId);
        point.put("vector", embeddingToList(newEmbedding));
        point.put("payload", payload);

        Map<String, Object> requestBody = Map.of("points", List.of(point));
        webClient.put()
            .uri("/collections/" + collectionName + "/points")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        log.info("片段已更新: pointId={}, newTextLength={}", pointId, newText.length());
        return new SegmentInfo(pointId, newText, 0, "", "", "");
    }

    public void deleteSegment(String pointId) {
        Map<String, Object> requestBody = Map.of("points", List.of(pointId));
        webClient.post()
            .uri("/collections/" + collectionName + "/points/delete")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        log.info("片段已删除: pointId={}", pointId);
    }

    public int deleteByDocumentId(String documentId) {
        List<QdrantPoint> allPoints = scrollFiltered(documentId);
        List<Object> pointIds = allPoints.stream()
            .map(QdrantPoint::id)
            .toList();

        if (pointIds.isEmpty()) {
            return 0;
        }

        Map<String, Object> requestBody = Map.of("points", pointIds);
        webClient.post()
            .uri("/collections/" + collectionName + "/points/delete")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        log.info("文档片段已全部删除: documentId={}, count={}", documentId, pointIds.size());
        return pointIds.size();
    }

    private List<Double> embeddingToList(Embedding embedding) {
        float[] vector = embedding.vector();
        List<Double> list = new ArrayList<>(vector.length);
        for (float v : vector) {
            list.add((double) v);
        }
        return list;
    }

    private List<QdrantPoint> scrollFiltered(String documentId) {
        List<QdrantPoint> points = new ArrayList<>();
        Object nextOffset = null;

        Map<String, Object> filter = Map.of(
            "must", List.of(Map.of(
                "key", "documentId",
                "match", Map.of("value", documentId)
            ))
        );

        do {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("limit", SCROLL_PAGE_SIZE);
            requestBody.put("with_payload", true);
            requestBody.put("with_vector", false);
            requestBody.put("filter", filter);
            if (nextOffset != null) {
                requestBody.put("offset", nextOffset);
            }

            Map<String, Object> response = webClient.post()
                .uri("/collections/" + collectionName + "/points/scroll")
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(requestBody)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();

            Map<String, Object> result = asMap(response != null ? response.get("result") : null);
            List<Map<String, Object>> pointMaps = asListOfMaps(result.get("points"));
            for (Map<String, Object> pointMap : pointMaps) {
                points.add(new QdrantPoint(pointMap.get("id"), asMap(pointMap.get("payload"))));
            }
            nextOffset = result.get("next_page_offset");
        } while (nextOffset != null);

        return points;
    }

    private String extractText(Map<String, Object> payload) {
        for (String key : List.of("text_segment", "text_content", "text")) {
            String value = asString(payload.get(key));
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private void configureCodecs(ClientCodecConfigurer configurer) {
        configurer.defaultCodecs().maxInMemorySize(WEBCLIENT_MAX_IN_MEMORY_SIZE);
    }

    private String asString(Object value) {
        return value != null ? String.valueOf(value) : null;
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> rawMap) {
            Map<String, Object> converted = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
                converted.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return converted;
        }
        return Map.of();
    }

    private List<Map<String, Object>> asListOfMaps(Object value) {
        if (!(value instanceof List<?> rawList)) {
            return List.of();
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : rawList) {
            result.add(asMap(item));
        }
        return result;
    }

    private record QdrantPoint(Object id, Map<String, Object> payload) {
    }

    public record SegmentInfo(
        String pointId,
        String text,
        int chunkIndex,
        String title,
        String category,
        String keywords
    ) {
    }
}
