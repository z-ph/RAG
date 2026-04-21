package com.mark.knowledge.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final int PUBLIC_LIST_LIMIT = 30;
    private static final int DOWNLOAD_LIMIT = 10;
    private static final long WINDOW_MS = 60_000;
    private static final long CLEANUP_INTERVAL_MS = 300_000;

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private volatile long lastCleanupTime = System.currentTimeMillis();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/documents/public")) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = getClientIp(request);
        boolean isDownload = path.endsWith("/download");
        int maxTokens = isDownload ? DOWNLOAD_LIMIT : PUBLIC_LIST_LIMIT;
        String key = clientIp + ":" + (isDownload ? "dl" : "list");

        TokenBucket bucket = buckets.computeIfAbsent(key,
            k -> new TokenBucket(maxTokens, WINDOW_MS));

        if (!bucket.tryConsume()) {
            log.warn("请求限流: ip={}, path={}", clientIp, path);
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            objectMapper.writeValue(response.getOutputStream(), Map.of(
                "error", "请求过于频繁",
                "message", "请稍后再试",
                "timestamp", LocalDateTime.now().toString()
            ));
            return;
        }

        cleanupStaleBuckets();
        filterChain.doFilter(request, response);
    }

    private void cleanupStaleBuckets() {
        long now = System.currentTimeMillis();
        if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
            return;
        }
        lastCleanupTime = now;
        buckets.entrySet().removeIf(entry -> entry.getValue().isExpired(now));
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader != null && !xfHeader.isBlank()) {
            return xfHeader.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static final class TokenBucket {
        private final int maxTokens;
        private final long windowMs;
        private int tokens;
        private long lastRefillTime;

        TokenBucket(int maxTokens, long windowMs) {
            this.maxTokens = maxTokens;
            this.windowMs = windowMs;
            this.tokens = maxTokens;
            this.lastRefillTime = System.currentTimeMillis();
        }

        synchronized boolean tryConsume() {
            refill();
            if (tokens > 0) {
                tokens--;
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            long elapsed = now - lastRefillTime;
            if (elapsed >= windowMs) {
                tokens = maxTokens;
                lastRefillTime = now;
            }
        }

        boolean isExpired(long now) {
            return (now - lastRefillTime) > windowMs * 2;
        }
    }
}
