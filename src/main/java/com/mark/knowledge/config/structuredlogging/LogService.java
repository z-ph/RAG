package com.mark.knowledge.config.structuredlogging;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.*;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

@Service
public class LogService {

    private static final Logger log = LoggerFactory.getLogger(LogService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final List<String> ALL_LAYERS = List.of("network", "database", "model-session", "app");

    @Value("${LOG_PATH:./logs}")
    private String logPath;

    public LogPage queryLogs(String layer, String date, String level, String keyword,
                             String timeFrom, String timeTo, String sort,
                             int page, int size) {
        LocalDate targetDate = date != null ? LocalDate.parse(date) : LocalDate.now();
        List<String> layers = layer != null ? List.of(layer) : ALL_LAYERS;

        List<Map<String, Object>> allEntries = new ArrayList<>();

        for (String l : layers) {
            List<Path> files = findLogFiles(l, targetDate, level);
            for (Path file : files) {
                allEntries.addAll(readLogFile(file, l, level, keyword, timeFrom, timeTo));
            }
        }

        boolean desc = sort == null || sort.contains("desc");
        allEntries.sort((a, b) -> {
            String ta = (String) a.getOrDefault("timestamp", "");
            String tb = (String) b.getOrDefault("timestamp", "");
            return desc ? tb.compareTo(ta) : ta.compareTo(tb);
        });

        int total = allEntries.size();
        int fromIndex = Math.min((page - 1) * size, total);
        int toIndex = Math.min(fromIndex + size, total);
        List<Map<String, Object>> items = allEntries.subList(fromIndex, toIndex);

        return new LogPage(new ArrayList<>(items), total, page, size);
    }

    private List<Path> findLogFiles(String layer, LocalDate date, String level) {
        Path layerDir = Paths.get(logPath, layer);
        if (!Files.isDirectory(layerDir)) {
            return List.of();
        }

        String dateStr = date.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        List<Path> files = new ArrayList<>();

        try (Stream<Path> stream = Files.list(layerDir)) {
            stream.filter(Files::isRegularFile)
                .filter(p -> p.getFileName().toString().contains(dateStr))
                .forEach(files::add);
        } catch (IOException e) {
            log.warn("Failed to list log files in {}", layerDir, e);
        }

        // Also include the current app.log / error.log if date is today
        if (date.equals(LocalDate.now())) {
            Path currentFile = layerDir.resolve("app.log");
            if (Files.isRegularFile(currentFile) && !files.contains(currentFile)) {
                files.add(currentFile);
            }
            if ("ERROR".equalsIgnoreCase(level)) {
                Path errorFile = layerDir.resolve("error.log");
                if (Files.isRegularFile(errorFile) && !files.contains(errorFile)) {
                    files.add(errorFile);
                }
            }
        }

        return files;
    }

    private List<Map<String, Object>> readLogFile(Path file, String layer, String level,
                                                   String keyword, String timeFrom, String timeTo) {
        List<Map<String, Object>> entries = new ArrayList<>();

        try (Stream<String> lines = Files.lines(file)) {
            lines.forEach(line -> {
                Map<String, Object> entry = parseJsonLine(line);
                if (entry == null) return;

                if (level != null && !level.equalsIgnoreCase(String.valueOf(entry.get("level")))) return;
                if (keyword != null && !keyword.isEmpty() && !line.contains(keyword)) return;

                if (timeFrom != null || timeTo != null) {
                    String ts = (String) entry.get("timestamp");
                    if (ts == null) return;
                    try {
                        String timePart = ts.contains("T") ? ts.substring(ts.indexOf('T') + 1, Math.min(ts.indexOf('T') + 6, ts.length())) : "";
                        if (timeFrom != null && !timePart.isEmpty() && timePart.compareTo(timeFrom) < 0) return;
                        if (timeTo != null && !timePart.isEmpty() && timePart.compareTo(timeTo) > 0) return;
                    } catch (Exception ignored) {}
                }

                if (!entry.containsKey("layer")) {
                    entry.put("layer", layer);
                }
                entries.add(entry);
            });
        } catch (IOException e) {
            log.warn("Failed to read log file {}", file, e);
        }

        return entries;
    }

    private Map<String, Object> parseJsonLine(String line) {
        if (line == null || line.isBlank()) return null;
        line = line.trim();
        if (!line.startsWith("{")) return null;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = MAPPER.readValue(line, Map.class);
            return map;
        } catch (Exception e) {
            return null;
        }
    }

    public record LogPage(List<Map<String, Object>> items, int total, int page, int size) {}
}
