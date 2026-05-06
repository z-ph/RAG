package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.dto.HealthCheckRequest;
import com.mark.knowledge.rag.dto.HealthCheckResponse;
import com.mark.knowledge.rag.dto.RagRequest;
import com.mark.knowledge.rag.dto.RagResponse;
import com.mark.knowledge.rag.service.ConversationMemoryService;
import com.mark.knowledge.rag.service.RagService;
import dev.langchain4j.data.message.ImageContent;
import dev.langchain4j.data.message.TextContent;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.chat.response.ChatResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/**
 * RAG（检索增强生成）查询控制器
 *
 * @author mark
 */
@RestController
@RequestMapping("/rag")
public class RagController {

    private static final Logger log = LoggerFactory.getLogger(RagController.class);

    private final RagService ragService;
    private final ConversationMemoryService conversationMemoryService;
    private final ChatModel chatModel;

    public RagController(RagService ragService, ConversationMemoryService conversationMemoryService, ChatModel chatModel) {
        this.ragService = ragService;
        this.conversationMemoryService = conversationMemoryService;
        this.chatModel = chatModel;
    }

    /**
     * 使用 RAG 回答问题
     *
     * @param request RAG 请求（包含问题）
     * @return 答案及来源信息
     */
    @PostMapping("/ask")
    public ResponseEntity<?> ask(@RequestBody RagRequest request) {
        log.info("收到 RAG 问题: {}", request.question());

        try {
            if (request.question() == null || request.question().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效请求", "问题不能为空"));
            }

            RagResponse response = ragService.ask(request);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("RAG 请求失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("请求失败", e.getMessage()));
        }
    }

    /**
     * 使用 RAG 流式回答问题（SSE）
     *
     * @param request RAG 请求（包含问题）
     * @return SSE 流
     */
    @PostMapping(value = "/ask/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<?> askStream(@RequestBody RagRequest request) {
        log.info("收到流式 RAG 问题: {}", request.question());

        try {
            if (request.question() == null || request.question().trim().isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效请求", "问题不能为空"));
            }

            SseEmitter emitter = ragService.askStream(request);
            return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .header("Cache-Control", "no-cache")
                .header("X-Accel-Buffering", "no")
                .body(emitter);

        } catch (Exception e) {
            log.error("流式 RAG 请求失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("请求失败", e.getMessage()));
        }
    }

    /**
     * 取消指定会话的进行中生成任务
     *
     * @param conversationId 会话 ID
     * @return 取消结果
     */
    @PostMapping("/conversations/{conversationId}/cancel")
    public ResponseEntity<?> cancelConversationGeneration(@PathVariable String conversationId) {
        boolean cancelled = ragService.cancelGeneration(conversationId);
        if (cancelled) {
            return ResponseEntity.ok("已取消该会话的进行中生成任务");
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("未找到任务", "该会话当前没有进行中的生成任务"));
    }

    /**
     * 清空指定会话上下文
     *
     * @param conversationId 会话ID
     * @return 清理结果
     */
    @DeleteMapping("/conversations/{conversationId}")
    public ResponseEntity<String> clearConversation(@PathVariable String conversationId) {
        ragService.cancelGeneration(conversationId);
        conversationMemoryService.clear(conversationId);
        return ResponseEntity.ok("会话上下文已清空");
    }

    /**
     * 健康检查接口
     *
     * @return 健康状态
     */
    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("RAG 服务运行正常");
    }

    /**
     * 健康检查接口（POST）
     *
     * @param request 健康检查请求（可选，echo 字段会被原样返回）
     * @return 健康状态
     */
    @PostMapping("/health")
    public ResponseEntity<HealthCheckResponse> healthPost(@RequestBody(required = false) HealthCheckRequest request) {
        String echo = request != null ? request.echo() : null;
        return ResponseEntity.ok(new HealthCheckResponse("UP", "RAG 服务运行正常", echo));
    }

    @PostMapping(value = "/ask/with-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> askWithImage(
            @RequestParam("image") MultipartFile image,
            @RequestParam("question") String question,
            @RequestParam(value = "conversationId", required = false) String conversationId) {
        try {
            if (image.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效文件", "图片为空"));
            }
            if (question == null || question.isBlank()) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效请求", "问题不能为空"));
            }

            byte[] imageBytes = image.getBytes();
            String dataUri = com.mark.knowledge.rag.service.LlmImageSupport.toPngDataUri(imageBytes)
                .orElse(null);
            if (dataUri == null) {
                return ResponseEntity.badRequest()
                    .body(new ErrorResponse("无效文件", "无法识别图片内容，请上传 PNG、JPG、GIF、BMP 或 WEBP 图片"));
            }

            UserMessage userMessage = UserMessage.from(
                TextContent.from(question),
                ImageContent.from(dataUri)
            );

            ChatResponse chatResponse = chatModel.chat(userMessage);
            String answer = chatResponse.aiMessage().text();

            return ResponseEntity.ok(new RagResponse(
                answer != null ? answer : "未能生成回答",
                chatResponse.aiMessage().thinking(),
                conversationId,
                List.of()
            ));

        } catch (Exception e) {
            log.error("图片问答失败", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErrorResponse("请求失败", e.getMessage()));
        }
    }
}
