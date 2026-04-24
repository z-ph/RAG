package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.entity.SystemPrompt;
import com.mark.knowledge.rag.service.PromptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/prompts")
public class PromptController {

    private static final Logger log = LoggerFactory.getLogger(PromptController.class);

    private final PromptService promptService;

    public PromptController(PromptService promptService) {
        this.promptService = promptService;
    }

    @GetMapping
    public ResponseEntity<?> listPrompts() {
        try {
            List<SystemPrompt> prompts = promptService.listPrompts();
            return ResponseEntity.ok(prompts);
        } catch (Exception e) {
            log.error("获取提示词列表失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("查询失败", e.getMessage()));
        }
    }

    @PutMapping("/{key}")
    public ResponseEntity<?> updatePrompt(
            @PathVariable String key,
            @RequestBody Map<String, String> body) {
        try {
            String content = body.get("content");
            if (content == null || content.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效内容", "提示词内容不能为空"));
            }
            String description = body.get("description");
            SystemPrompt updated = promptService.savePrompt(key, content, description);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("未找到", e.getMessage()));
        } catch (Exception e) {
            log.error("更新提示词失败: {}", key, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("更新失败", e.getMessage()));
        }
    }

    @PostMapping("/{key}/reset")
    public ResponseEntity<?> resetPrompt(@PathVariable String key) {
        try {
            SystemPrompt reset = promptService.resetPrompt(key);
            return ResponseEntity.ok(reset);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse("未找到", e.getMessage()));
        } catch (Exception e) {
            log.error("重置提示词失败: {}", key, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("重置失败", e.getMessage()));
        }
    }
}
