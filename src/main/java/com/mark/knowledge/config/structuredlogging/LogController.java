package com.mark.knowledge.config.structuredlogging;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin/logs")
public class LogController {

    private final LogService logService;

    public LogController(LogService logService) {
        this.logService = logService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<LogService.LogPage> getLogs(
            @RequestParam(required = false) String layer,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String timeFrom,
            @RequestParam(required = false) String timeTo,
            @RequestParam(defaultValue = "time:desc") String sort,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {

        if (page < 1) page = 1;
        if (size < 1 || size > 200) size = 50;

        LogService.LogPage result = logService.queryLogs(layer, date, level, keyword, timeFrom, timeTo, sort, page, size);
        return ResponseEntity.ok(result);
    }
}
