package com.mark.knowledge.rag.service.parsers;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.message.ImageContent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/**
 * 图片 OCR 解析器 - 使用 LLM Vision API 提取图片中的文本。
 * 如果没有配置 Vision 模型，回退为提示用户上传文本版本。
 */
public class OcrParser {

    private static final Logger log = LoggerFactory.getLogger(OcrParser.class);

    public static String parse(InputStream inputStream, ChatModel chatModel) throws IOException {
        if (chatModel == null) {
            throw new IOException("未配置 LLM 模型，无法进行图片 OCR 识别");
        }

        byte[] imageBytes = inputStream.readAllBytes();
        String base64Image = Base64.getEncoder().encodeToString(imageBytes);

        String mimeType = detectMimeType(imageBytes);
        String dataUri = "data:" + mimeType + ";base64," + base64Image;

        String prompt = "请提取这张图片中的所有文字内容。如果是文档截图，按原文格式输出。" +
            "如果是发票或票据，提取关键信息（如名称、金额、日期等）。只输出提取的文字，不要添加解释。";

        try {
            UserMessage message = UserMessage.from(
                dev.langchain4j.data.message.TextContent.from(prompt),
                ImageContent.from(dataUri)
            );
            String result = chatModel.chat(message).aiMessage().text();
            log.info("图片 OCR 完成: 提取了 {} 个字符", result != null ? result.length() : 0);
            return result != null ? result : "";
        } catch (Exception e) {
            log.error("图片 OCR 失败", e);
            throw new IOException("图片 OCR 识别失败: " + e.getMessage(), e);
        }
    }

    private static String detectMimeType(byte[] bytes) {
        if (bytes.length >= 4) {
            if (bytes[0] == (byte) 0x89 && bytes[1] == (byte) 0x50) return "image/png";
            if (bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xD8) return "image/jpeg";
            if (bytes[0] == (byte) 0x47 && bytes[1] == (byte) 0x49) return "image/gif";
            if (bytes[0] == (byte) 0x42 && bytes[1] == (byte) 0x4D) return "image/bmp";
        }
        return "image/png";
    }
}
