package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.service.parsers.ImageReference;
import dev.langchain4j.data.segment.TextSegment;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class DocumentServiceImageMarkdownChunkingTest {

    @Test
    void shouldKeepImageMarkdownWholeWhenChunkingLongParagraph() throws Exception {
        DocumentService service = new DocumentService(
            mock(ImageStorageService.class),
            mock(OcrService.class)
        );
        setIntField(service, "chunkSize", 80);
        setIntField(service, "chunkMinSize", 60);
        setIntField(service, "chunkMaxSize", 90);
        setIntField(service, "chunkOverlap", 10);
        setIntField(service, "minTextLength", 1);
        setIntField(service, "keywordCount", 3);

        Method chunkSettingsMethod = DocumentService.class.getDeclaredMethod("resolveChunkSettings");
        chunkSettingsMethod.setAccessible(true);
        Object chunkSettings = chunkSettingsMethod.invoke(service);

        Class<?> profileClass = Class.forName("com.mark.knowledge.rag.service.DocumentService$DocumentProfile");
        var profileCtor = profileClass.getDeclaredConstructors()[0];
        profileCtor.setAccessible(true);

        String imageMarkdown = "![图片](/documents/images/doc-1/e956422d491547d7.png)";
        String body = """
            第一段内容用于制造足够长的文本长度，让切块逻辑发生作用，同时这里要出现一张完整图片 %s 并且后面继续追加一段说明文字，确保图片标记前后都有文本。

            第二段继续补充一些说明，避免整个文档只形成一个很短的片段。
            """.formatted(imageMarkdown);

        Object profile = profileCtor.newInstance(
            body,
            "测试标题",
            "技术",
            "2026-05-06",
            "2026-05-06T00:00:00Z",
            List.of("技术", "图片")
        );

        Method splitTextMethod = DocumentService.class.getDeclaredMethod(
            "splitText",
            profileClass,
            String.class,
            String.class,
            chunkSettings.getClass(),
            List.class
        );
        splitTextMethod.setAccessible(true);

        Object chunkBuildResult = splitTextMethod.invoke(
            service,
            profile,
            "sample.doc",
            "doc-1",
            chunkSettings,
            List.of(new ImageReference("e956422d491547d7", "doc-1", "png", "/documents/images/doc-1/e956422d491547d7.png", new byte[] {1}))
        );

        Method segmentsMethod = chunkBuildResult.getClass().getDeclaredMethod("segments");
        segmentsMethod.setAccessible(true);

        @SuppressWarnings("unchecked")
        List<TextSegment> segments = (List<TextSegment>) segmentsMethod.invoke(chunkBuildResult);

        assertTrue(segments.stream().anyMatch(segment -> segment.text().contains(imageMarkdown)));
        assertFalse(segments.stream().anyMatch(segment -> segment.text().contains("[图片](/documents/images/doc-1/e956422d491547d7.png)")
            && !segment.text().contains("![图片](/documents/images/doc-1/e956422d491547d7.png)")));
        assertFalse(segments.stream().anyMatch(segment -> segment.text().endsWith("!")));
    }

    private void setIntField(Object target, String fieldName, int value) throws Exception {
        Field field = DocumentService.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.setInt(target, value);
    }
}
