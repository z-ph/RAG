package com.mark.knowledge.rag.store;

import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 按需创建 Qdrant store，避免长期复用空闲 gRPC 连接。
 */
@Component
public class QdrantEmbeddingStoreFactory {

    @Value("${qdrant.host:localhost}")
    private String qdrantHost;

    @Value("${qdrant.port:6334}")
    private int qdrantPort;

    @Value("${qdrant.collection-name:knowledge-base}")
    private String collectionName;

    public QdrantEmbeddingStore createStore() {
        return QdrantEmbeddingStore.builder()
                .host(qdrantHost)
                .port(qdrantPort)
                .collectionName(collectionName)
                .textPayloadKey("text_content")
                .build();
    }

    public String describeTarget() {
        return qdrantHost + ":" + qdrantPort + "/" + collectionName;
    }
}
