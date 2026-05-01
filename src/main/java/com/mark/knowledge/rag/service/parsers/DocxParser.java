package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class DocxParser {

    private static final Logger log = LoggerFactory.getLogger(DocxParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        return parseWithImages(inputStream, null).text();
    }

    public static DocxParseResult parseWithImages(InputStream inputStream, String documentId) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            List<String> lines = new ArrayList<>();
            List<ImageReference> imageReferences = new ArrayList<>();
            Map<String, ImageReference> pictureCache = new HashMap<>();

            for (XWPFParagraph paragraph : document.getParagraphs()) {
                StringBuilder lineBuilder = new StringBuilder();
                boolean hasContent = false;

                for (XWPFRun run : paragraph.getRuns()) {
                    List<org.apache.poi.xwpf.usermodel.XWPFPicture> pictures = run.getEmbeddedPictures();
                    String text = run.getText(0);

                    if (!pictures.isEmpty()) {
                        for (org.apache.poi.xwpf.usermodel.XWPFPicture picture : pictures) {
                            org.apache.poi.xwpf.usermodel.XWPFPictureData pictureData = picture.getPictureData();
                            String cacheKey = pictureData.getPackagePart() != null
                                ? pictureData.getPackagePart().getPartName().getName()
                                : UUID.randomUUID().toString();

                            ImageReference ref = pictureCache.get(cacheKey);
                            if (ref == null) {
                                String imageId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                                String ext = resolveExtension(pictureData.suggestFileExtension());
                                String publicUrl = documentId != null
                                    ? String.format("/rag/api/documents/images/%s/%s.%s", documentId, imageId, ext)
                                    : "";
                                ref = new ImageReference(imageId, documentId != null ? documentId : "", ext, publicUrl, pictureData.getData());
                                pictureCache.put(cacheKey, ref);
                                imageReferences.add(ref);
                            }

                            if (!ref.publicUrl().isEmpty()) {
                                lineBuilder.append("![图片](").append(ref.publicUrl()).append(")");
                            }
                            hasContent = true;
                        }
                    }

                    if (text != null && !text.isBlank()) {
                        lineBuilder.append(text);
                        hasContent = true;
                    }
                }

                if (hasContent) {
                    String line = lineBuilder.toString().trim();
                    if (!line.isBlank()) {
                        lines.add(line);
                    }
                }
            }

            for (var table : document.getTables()) {
                for (var row : table.getRows()) {
                    List<String> cellTexts = new ArrayList<>();
                    for (var cell : row.getTableCells()) {
                        String cellText = cell.getText();
                        if (cellText != null && !cellText.isBlank()) {
                            cellTexts.add(cellText.trim());
                        }
                    }
                    if (!cellTexts.isEmpty()) {
                        lines.add(String.join(" | ", cellTexts));
                    }
                }
            }

            String result = String.join("\n\n", lines);
            log.info("DOCX 解析完成: {} 个段落/行, {} 张图片", lines.size(), imageReferences.size());
            return new DocxParseResult(result, imageReferences);
        }
    }

    private static String resolveExtension(String suggested) {
        if (suggested == null || suggested.isBlank()) {
            return "png";
        }
        return switch (suggested.toLowerCase()) {
            case "jpeg" -> "jpg";
            case "emf", "wmf" -> "png";
            default -> suggested.toLowerCase();
        };
    }
}
