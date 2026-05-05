package com.mark.knowledge.config;

import com.mark.knowledge.config.structuredlogging.StructuredLog;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class LoggingFilter extends OncePerRequestFilter {

    private static final Logger networkLog = StructuredLog.logger("network");
    private static final Set<String> EXCLUDED_PATHS = Set.of("/rag/health");
    private static final int MAX_BODY_SUMMARY = 500;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        if (EXCLUDED_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        long start = System.currentTimeMillis();
        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
        try {
            filterChain.doFilter(request, responseWrapper);
        } finally {
            long elapsed = System.currentTimeMillis() - start;
            logRequest(request, responseWrapper, elapsed);
            responseWrapper.copyBodyToResponse();
        }
    }

    private void logRequest(HttpServletRequest request, ContentCachingResponseWrapper response, long elapsed) {
        String query = request.getQueryString();
        String uri = query != null ? request.getRequestURI() + "?" + query : request.getRequestURI();
        int status = response.getStatus();

        StructuredLog.LogEntry entry = new StructuredLog.LogEntry("network")
            .level(status >= 500 ? "ERROR" : "INFO")
            .put("method", request.getMethod())
            .put("uri", uri)
            .put("status", status)
            .put("elapsedMs", elapsed);

        String requestBody = extractBody(request);
        if (requestBody != null) {
            entry.put("requestBody", StructuredLog.truncate(requestBody, MAX_BODY_SUMMARY));
        }

        if (status >= 400) {
            byte[] responseBytes = response.getContentAsByteArray();
            if (responseBytes.length > 0) {
                String responseBody = new String(responseBytes, StandardCharsets.UTF_8);
                entry.put("responseBody", StructuredLog.truncate(responseBody, MAX_BODY_SUMMARY));
            }
        }

        String json = StructuredLog.json(entry);
        if (status >= 500) {
            networkLog.error(json);
        } else {
            networkLog.info(json);
        }
    }

    private String extractBody(HttpServletRequest request) {
        String contentType = request.getContentType();
        if (contentType != null && contentType.startsWith("multipart/")) {
            return "[multipart-upload]";
        }
        return null;
    }
}
