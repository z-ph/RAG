package com.mark.knowledge.config.structuredlogging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public final class StructuredLog {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_SUMMARY_LENGTH = 500;
    private static final int MAX_PARAM_LENGTH = 200;

    private StructuredLog() {}

    public static Logger logger(String layer) {
        return LoggerFactory.getLogger(layer);
    }

    public static String json(LogEntry entry) {
        try {
            return MAPPER.writeValueAsString(entry.toMap());
        } catch (Exception e) {
            return "{\"error\":\"Failed to serialize log entry\"}";
        }
    }

    public static String truncate(String value, int maxLen) {
        if (value == null) return null;
        return value.length() <= maxLen ? value : value.substring(0, maxLen) + "...[truncated]";
    }

    public static String truncateSummary(String value) {
        return truncate(value, MAX_SUMMARY_LENGTH);
    }

    public static String truncateParam(String value) {
        return truncate(value, MAX_PARAM_LENGTH);
    }

    public static String maskSensitive(String key, String value) {
        if (key == null) return value;
        String lower = key.toLowerCase();
        if (lower.contains("password") || lower.contains("token") || lower.contains("secret")) {
            return "***";
        }
        return value;
    }

    public static final class LogEntry {
        private final Map<String, Object> fields = new LinkedHashMap<>();

        public LogEntry(String layer) {
            fields.put("ver", 1);
            fields.put("timestamp", Instant.now().toString());
            fields.put("layer", layer);
        }

        public LogEntry level(String level) {
            fields.put("level", level);
            return this;
        }

        public LogEntry put(String key, Object value) {
            fields.put(key, value);
            return this;
        }

        public Map<String, Object> toMap() {
            return fields;
        }
    }
}
