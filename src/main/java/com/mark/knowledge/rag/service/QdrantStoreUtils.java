package com.mark.knowledge.rag.service;

import dev.langchain4j.store.embedding.qdrant.QdrantEmbeddingStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

final class QdrantStoreUtils {

    private static final Logger log = LoggerFactory.getLogger(QdrantStoreUtils.class);

    private QdrantStoreUtils() {}

    static void closeQuietly(QdrantEmbeddingStore store) {
        if (store == null) {
            return;
        }
        try {
            store.close();
        } catch (Exception e) {
            log.debug("关闭Qdrant store时忽略异常: {}", e.getMessage());
        }
    }
}
