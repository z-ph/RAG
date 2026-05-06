package com.mark.knowledge.rag.app;

import com.mark.knowledge.rag.dto.ErrorResponse;
import com.mark.knowledge.rag.service.ConversationMemoryService;
import com.mark.knowledge.rag.service.RagService;
import dev.langchain4j.model.chat.ChatModel;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;

class RagControllerTest {

    @Test
    void shouldRejectUnreadableImageUpload() {
        RagController controller = new RagController(
            mock(RagService.class),
            mock(ConversationMemoryService.class),
            mock(ChatModel.class)
        );

        MockMultipartFile image = new MockMultipartFile(
            "image",
            "bad-image.bin",
            "application/octet-stream",
            "not-an-image".getBytes()
        );

        ResponseEntity<?> response = controller.askWithImage(image, "这是什么", "conv-1", null, null);

        assertEquals(400, response.getStatusCode().value());
        assertInstanceOf(ErrorResponse.class, response.getBody());
        assertEquals("无法识别图片内容，请上传 PNG、JPG、GIF、BMP 或 WEBP 图片", ((ErrorResponse) response.getBody()).message());
    }
}
