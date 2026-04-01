package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.dto.DocumentProgressEvent;

/**
 * 文档处理进度回调接口
 */
@FunctionalInterface
public interface DocumentProgressCallback {
    /**
     * 报告进度
     *
     * @param event 进度事件
     */
    void onProgress(DocumentProgressEvent event);
}
