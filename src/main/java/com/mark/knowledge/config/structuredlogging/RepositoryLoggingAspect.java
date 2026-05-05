package com.mark.knowledge.config.structuredlogging;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class RepositoryLoggingAspect {

    private static final Logger dbLog = StructuredLog.logger("database");

    @Around("execution(* com.mark.knowledge..repository..*(..))")
    public Object logRepositoryMethod(ProceedingJoinPoint joinPoint) throws Throwable {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        String methodName = signature.getDeclaringType().getSimpleName() + "." + signature.getName();
        String params = summarizeParams(signature.getParameterNames(), joinPoint.getArgs());

        long start = System.currentTimeMillis();
        try {
            Object result = joinPoint.proceed();
            long elapsed = System.currentTimeMillis() - start;

            StructuredLog.LogEntry entry = new StructuredLog.LogEntry("database")
                .level("INFO")
                .put("method", methodName)
                .put("params", params)
                .put("result", summarizeResult(result))
                .put("elapsedMs", elapsed)
                .put("success", true);
            dbLog.info(StructuredLog.json(entry));

            return result;
        } catch (Throwable ex) {
            long elapsed = System.currentTimeMillis() - start;

            StructuredLog.LogEntry entry = new StructuredLog.LogEntry("database")
                .level("ERROR")
                .put("method", methodName)
                .put("params", params)
                .put("error", ex.getMessage())
                .put("elapsedMs", elapsed)
                .put("success", false);
            dbLog.error(StructuredLog.json(entry));

            throw ex;
        }
    }

    private String summarizeParams(String[] names, Object[] values) {
        if (names == null || names.length == 0) return "[]";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < names.length; i++) {
            if (i > 0) sb.append(", ");
            String value = values[i] != null ? StructuredLog.maskSensitive(names[i], values[i].toString()) : "null";
            sb.append(names[i]).append("=").append(StructuredLog.truncateParam(value));
        }
        sb.append("]");
        return StructuredLog.truncateParam(sb.toString());
    }

    private String summarizeResult(Object result) {
        if (result == null) return "null";
        if (result instanceof Iterable<?> items) {
            int count = 0;
            for (Object ignored : items) count++;
            return "Iterable[" + count + " items]";
        }
        return StructuredLog.truncateParam(result.toString());
    }
}
