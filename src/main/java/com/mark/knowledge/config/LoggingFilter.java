package com.mark.knowledge.config;

import com.mark.knowledge.config.structuredlogging.StructuredLog;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class LoggingFilter extends OncePerRequestFilter {

    private static final Logger networkLog = StructuredLog.logger("network");
    private static final Set<String> EXCLUDED_PATHS = Set.of("/rag/health");
    private static final int MAX_BODY_SUMMARY = 500;
    private static final String ASYNC_LOG_ATTACHED_ATTR = LoggingFilter.class.getName() + ".ASYNC_LOG_ATTACHED";
    private static final String ASYNC_LOGGED_ATTR = LoggingFilter.class.getName() + ".ASYNC_LOGGED";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String path = request.getRequestURI();
        if (EXCLUDED_PATHS.contains(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        long start = System.currentTimeMillis();
        try {
            filterChain.doFilter(request, response);
        } finally {
            if (request.isAsyncStarted()) {
                attachAsyncLogging(request, response, start);
            } else {
                logRequest(request, response, System.currentTimeMillis() - start);
            }
        }
    }

    private void attachAsyncLogging(HttpServletRequest request, HttpServletResponse response, long start) {
        if (Boolean.TRUE.equals(request.getAttribute(ASYNC_LOG_ATTACHED_ATTR))) {
            return;
        }
        request.setAttribute(ASYNC_LOG_ATTACHED_ATTR, Boolean.TRUE);

        try {
            request.getAsyncContext().addListener(new AsyncListener() {
                @Override
                public void onComplete(AsyncEvent event) {
                    logAsyncRequest(request, event.getSuppliedResponse(), start);
                }

                @Override
                public void onTimeout(AsyncEvent event) {
                    logAsyncRequest(request, event.getSuppliedResponse(), start);
                }

                @Override
                public void onError(AsyncEvent event) {
                    logAsyncRequest(request, event.getSuppliedResponse(), start);
                }

                @Override
                public void onStartAsync(AsyncEvent event) {
                    event.getAsyncContext().addListener(this);
                }
            });
        } catch (IllegalStateException ignored) {
            logRequest(request, response, System.currentTimeMillis() - start);
        }
    }

    private void logAsyncRequest(HttpServletRequest request, ServletResponse response, long start) {
        if (!(response instanceof HttpServletResponse httpResponse)) {
            return;
        }
        if (Boolean.TRUE.equals(request.getAttribute(ASYNC_LOGGED_ATTR))) {
            return;
        }
        request.setAttribute(ASYNC_LOGGED_ATTR, Boolean.TRUE);
        logRequest(request, httpResponse, System.currentTimeMillis() - start);
    }

    private void logRequest(HttpServletRequest request, HttpServletResponse response, long elapsed) {
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
