package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.DocumentDeleteResponse;
import com.mark.knowledge.rag.dto.DocumentListItemResponse;
import com.mark.knowledge.rag.dto.DocumentListResponse;
import com.mark.knowledge.rag.dto.PublicDocumentDetailResponse;
import com.mark.knowledge.rag.dto.PublicDocumentListItem;
import com.mark.knowledge.rag.dto.PublicDocumentListResponse;
import com.mark.knowledge.rag.dto.PublicDocumentSegment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.http.codec.ClientCodecConfigurer;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 文档管理服务。
 */
@Service
public class DocumentAdminService {

    private static final Logger log = LoggerFactory.getLogger(DocumentAdminService.class);
    private static final int SCROLL_PAGE_SIZE = 64;
    private static final int WEBCLIENT_MAX_IN_MEMORY_SIZE = 2 * 1024 * 1024;

    private final String collectionName;
    private final WebClient webClient;

    public DocumentAdminService(
            @Value("${qdrant.host:localhost}") String qdrantHost,
            @Value("${qdrant.http-port:6333}") int qdrantHttpPort,
            @Value("${qdrant.collection-name:knowledge-base}") String collectionName) {
        this.collectionName = collectionName;
        this.webClient = WebClient.builder()
            .codecs(this::configureCodecs)
            .baseUrl(String.format("http://%s:%d", qdrantHost, qdrantHttpPort))
            .build();
    }

    public DocumentListResponse listDocuments() {
        List<QdrantPoint> points = scrollAllPoints("documentId", "filename", "metadata");
        Map<String, DocumentAggregate> documents = new LinkedHashMap<>();

        for (QdrantPoint point : points) {
            String documentId = extractDocumentId(point.payload());
            if (documentId == null || documentId.isBlank()) {
                continue;
            }

            String filename = extractFilename(point.payload());
            DocumentAggregate aggregate = documents.computeIfAbsent(
                documentId,
                ignored -> new DocumentAggregate(documentId, filename)
            );
            aggregate.increment();
            if ((aggregate.filename == null || aggregate.filename.isBlank())
                    && filename != null && !filename.isBlank()) {
                aggregate.filename = filename;
            }
        }

        List<DocumentListItemResponse> items = documents.values().stream()
            .sorted(Comparator.comparing(DocumentAggregate::filenameOrFallback)
                .thenComparing(DocumentAggregate::documentId))
            .map(item -> new DocumentListItemResponse(
                item.documentId,
                item.filenameOrFallback(),
                item.segmentCount
            ))
            .toList();

        return new DocumentListResponse(items, items.size());
    }

    public DocumentDeleteResponse deleteByDocumentId(String documentId) {
        List<QdrantPoint> allPoints = scrollAllPoints("documentId", "filename");
        List<Object> pointIds = allPoints.stream()
            .filter(point -> documentId.equals(extractDocumentId(point.payload())))
            .map(QdrantPoint::id)
            .filter(Objects::nonNull)
            .toList();

        if (pointIds.isEmpty()) {
            return new DocumentDeleteResponse(documentId, null, 0, "未找到对应文档");
        }

        String filename = allPoints.stream()
            .filter(p -> documentId.equals(extractDocumentId(p.payload())))
            .findFirst()
            .map(p -> extractFilename(p.payload()))
            .orElse(null);

        Map<String, Object> requestBody = Map.of("points", pointIds);
        webClient.post()
            .uri("/collections/" + collectionName + "/points/delete")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(String.class)
            .block();

        log.info("已删除文档: {} ({} 个片段)", documentId, pointIds.size());
        return new DocumentDeleteResponse(documentId, filename, pointIds.size(), "文档删除成功");
    }

    public PublicDocumentListResponse listPublicDocuments() {
        List<QdrantPoint> points = scrollAllPoints("documentId", "filename", "title", "category", "documentTime", "keywords");
        Map<String, DocumentAggregate> documents = new LinkedHashMap<>();

        for (QdrantPoint point : points) {
            String documentId = extractDocumentId(point.payload());
            if (documentId == null || documentId.isBlank()) {
                continue;
            }
            String filename = extractFilename(point.payload());
            DocumentAggregate aggregate = documents.computeIfAbsent(
                documentId,
                ignored -> new DocumentAggregate(documentId, filename)
            );
            aggregate.increment();
            if ((aggregate.filename == null || aggregate.filename.isBlank())
                    && filename != null && !filename.isBlank()) {
                aggregate.filename = filename;
            }
            if (aggregate.title == null && point.payload().get("title") != null) {
                aggregate.title = String.valueOf(point.payload().get("title"));
            }
            if (aggregate.category == null && point.payload().get("category") != null) {
                aggregate.category = String.valueOf(point.payload().get("category"));
            }
            if (aggregate.documentTime == null && point.payload().get("documentTime") != null) {
                aggregate.documentTime = String.valueOf(point.payload().get("documentTime"));
            }
            if (aggregate.keywords == null && point.payload().get("keywords") != null) {
                aggregate.keywords = String.valueOf(point.payload().get("keywords"));
            }
        }

        List<PublicDocumentListItem> items = documents.values().stream()
            .map(item -> new PublicDocumentListItem(
                item.documentId,
                item.filenameOrFallback(),
                item.title != null ? item.title : "",
                item.category != null ? item.category : "",
                item.documentTime != null ? item.documentTime : "",
                item.keywords != null ? item.keywords : "",
                item.segmentCount
            ))
            .toList();

        return new PublicDocumentListResponse(items, items.size());
    }

    public PublicDocumentDetailResponse getPublicDocumentDetail(String documentId) {
        List<QdrantPoint> points = scrollAllWithFullPayload();

        List<QdrantPoint> docPoints = points.stream()
            .filter(p -> documentId.equals(extractDocumentId(p.payload())))
            .toList();

        if (docPoints.isEmpty()) {
            return null;
        }

        QdrantPoint first = docPoints.getFirst();
        String filename = extractFilename(first.payload());
        String title = asString(first.payload().get("title"));
        String category = asString(first.payload().get("category"));
        String documentTime = asString(first.payload().get("documentTime"));
        String keywords = asString(first.payload().get("keywords"));

        List<PublicDocumentSegment> segments = docPoints.stream()
            .map(p -> {
                String idx = asString(p.payload().get("chunkIndex"));
                String text = extractTextContent(p.payload());
                return new PublicDocumentSegment(
                    idx != null ? Integer.parseInt(idx) : 0,
                    text
                );
            })
            .filter(s -> s.text() != null && !s.text().isBlank())
            .sorted(Comparator.comparingInt(PublicDocumentSegment::chunkIndex))
            .toList();

        return new PublicDocumentDetailResponse(
            documentId,
            filename != null ? filename : "",
            title != null ? title : "",
            category != null ? category : "",
            documentTime != null ? documentTime : "",
            keywords != null ? keywords : "",
            docPoints.size(),
            segments
        );
    }

    private String extractTextContent(Map<String, Object> payload) {
        for (String key : List.of("text_content", "text", "")) {
            String value = asString(payload.get(key));
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private List<QdrantPoint> scrollAllPoints(String... payloadFields) {
        List<QdrantPoint> points = new ArrayList<>();
        Object nextOffset = null;

        do {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("limit", SCROLL_PAGE_SIZE);
            requestBody.put("with_payload", List.of(payloadFields));
            requestBody.put("with_vector", false);
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

    private List<QdrantPoint> scrollAllWithFullPayload() {
        List<QdrantPoint> points = new ArrayList<>();
        Object nextOffset = null;

        do {
            Map<String, Object> requestBody = new LinkedHashMap<>();
            requestBody.put("limit", SCROLL_PAGE_SIZE);
            requestBody.put("with_payload", true);
            requestBody.put("with_vector", false);
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

    private void configureCodecs(ClientCodecConfigurer configurer) {
        configurer.defaultCodecs().maxInMemorySize(WEBCLIENT_MAX_IN_MEMORY_SIZE);
    }

    private String extractDocumentId(Map<String, Object> payload) {
        return firstNonBlank(
            asString(payload.get("documentId")),
            asString(getNestedValue(payload, "metadata", "documentId"))
        );
    }

    private String extractFilename(Map<String, Object> payload) {
        return firstNonBlank(
            asString(payload.get("filename")),
            asString(getNestedValue(payload, "metadata", "filename"))
        );
    }

    private Object getNestedValue(Map<String, Object> source, String parentKey, String childKey) {
        Object nested = source.get(parentKey);
        if (nested instanceof Map<?, ?> nestedMap) {
            return nestedMap.get(childKey);
        }
        return null;
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        if (second != null && !second.isBlank()) {
            return second;
        }
        return null;
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

    private static final class DocumentAggregate {
        private final String documentId;
        private String filename;
        private int segmentCount;
        String title;
        String category;
        String documentTime;
        String keywords;

        private DocumentAggregate(String documentId, String filename) {
            this.documentId = documentId;
            this.filename = filename;
        }

        private void increment() {
            segmentCount++;
        }

        private String documentId() {
            return documentId;
        }

        private String filenameOrFallback() {
            return filename != null && !filename.isBlank() ? filename : "unknown";
        }
    }
}
