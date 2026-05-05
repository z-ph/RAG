package com.mark.knowledge.config.structuredlogging;

import org.slf4j.Logger;

public final class PipelineLogger {

    private static final Logger modelSessionLog = StructuredLog.logger("model-session");

    private PipelineLogger() {}

    public static void logStep(String conversationId, String step, String input, String output, long elapsedMs) {
        StructuredLog.LogEntry entry = new StructuredLog.LogEntry("model-session")
            .level("INFO")
            .put("conversationId", conversationId)
            .put("step", step)
            .put("input", StructuredLog.truncateSummary(input))
            .put("output", StructuredLog.truncateSummary(output))
            .put("elapsedMs", elapsedMs)
            .put("success", true);
        modelSessionLog.info(StructuredLog.json(entry));
    }

    public static void logStepError(String conversationId, String step, String input, long elapsedMs, Throwable error) {
        StructuredLog.LogEntry entry = new StructuredLog.LogEntry("model-session")
            .level("ERROR")
            .put("conversationId", conversationId)
            .put("step", step)
            .put("input", StructuredLog.truncateSummary(input))
            .put("error", error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName())
            .put("elapsedMs", elapsedMs)
            .put("success", false);
        modelSessionLog.error(StructuredLog.json(entry));
    }
}
