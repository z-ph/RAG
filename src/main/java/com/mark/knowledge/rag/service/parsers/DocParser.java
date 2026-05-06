package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.model.PicturesTable;
import org.apache.poi.hwpf.usermodel.CharacterRun;
import org.apache.poi.hwpf.usermodel.Paragraph;
import org.apache.poi.hwpf.usermodel.Range;
import org.apache.poi.hwpf.usermodel.Picture;
import org.apache.poi.hwpf.usermodel.Table;
import org.apache.poi.hwpf.usermodel.TableCell;
import org.apache.poi.hwpf.usermodel.TableRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

public class DocParser {

    private static final Logger log = LoggerFactory.getLogger(DocParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        return parseWithImages(inputStream, null).text();
    }

    public static DocParseResult parseWithImages(InputStream inputStream, String documentId) throws IOException {
        try (HWPFDocument document = new HWPFDocument(inputStream)) {
            List<String> lines = new ArrayList<>();
            List<ImageReference> imageReferences = new ArrayList<>();
            PicturesTable picturesTable = document.getPicturesTable();
            Range range = document.getRange();
            Set<Integer> skipParagraphs = new HashSet<>();

            // 第一遍：提取表格，记录属于表格的段落索引
            for (int i = 0; i < range.numParagraphs(); i++) {
                Paragraph paragraph = range.getParagraph(i);
                if (paragraph.isInTable() && !skipParagraphs.contains(i)) {
                    try {
                        Table table = range.getTable(paragraph);
                        int tableEnd = table.getEndOffset();
                        for (int r = 0; r < table.numRows(); r++) {
                            TableRow row = table.getRow(r);
                            List<String> cellTexts = new ArrayList<>();
                            for (int c = 0; c < row.numCells(); c++) {
                                TableCell cell = row.getCell(c);
                                String cellText = renderRange(cell, picturesTable, imageReferences, documentId);
                                if (!cellText.isBlank()) {
                                    cellTexts.add(cellText);
                                }
                            }
                            if (!cellTexts.isEmpty()) {
                                lines.add(String.join(" | ", cellTexts));
                            }
                        }
                        // 跳过该表格覆盖的所有段落
                        for (int j = i; j < range.numParagraphs(); j++) {
                            if (range.getParagraph(j).getStartOffset() >= tableEnd) break;
                            skipParagraphs.add(j);
                        }
                    } catch (IllegalArgumentException e) {
                        // 不是表格首段，跳过
                    }
                }
            }

            // 第二遍：提取非表格段落
            for (int i = 0; i < range.numParagraphs(); i++) {
                if (skipParagraphs.contains(i)) continue;
                Paragraph paragraph = range.getParagraph(i);
                String text = renderParagraph(paragraph, picturesTable, imageReferences, documentId);
                if (!text.isBlank()) {
                    lines.add(text);
                }
            }

            String result = String.join("\n\n", lines);
            log.info("DOC 解析完成: {} 个段落/行, {} 张图片", lines.size(), imageReferences.size());
            return new DocParseResult(result, imageReferences);
        }
    }

    private static String renderRange(Range range,
                                      PicturesTable picturesTable,
                                      List<ImageReference> imageReferences,
                                      String documentId) {
        List<String> paragraphs = new ArrayList<>();
        for (int i = 0; i < range.numParagraphs(); i++) {
            String text = renderParagraph(range.getParagraph(i), picturesTable, imageReferences, documentId);
            if (!text.isBlank()) {
                paragraphs.add(text);
            }
        }
        return String.join("\n", paragraphs).trim();
    }

    private static String renderParagraph(Paragraph paragraph,
                                          PicturesTable picturesTable,
                                          List<ImageReference> imageReferences,
                                          String documentId) {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < paragraph.numCharacterRuns(); i++) {
            CharacterRun run = paragraph.getCharacterRun(i);
            String text = run.text();
            if (text != null && !text.isBlank()) {
                builder.append(text);
            }
            appendPicture(run, picturesTable, imageReferences, documentId, builder);
        }
        return normalizeRenderedText(builder.toString());
    }

    private static void appendPicture(CharacterRun run,
                                      PicturesTable picturesTable,
                                      List<ImageReference> imageReferences,
                                      String documentId,
                                      StringBuilder builder) {
        if (picturesTable == null || (!picturesTable.hasPicture(run) && !picturesTable.hasEscherPicture(run))) {
            return;
        }

        Picture picture = picturesTable.extractPicture(run, true);
        if (picture == null) {
            return;
        }

        String imageId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String ext = resolveExtension(picture.suggestFileExtension());
        String publicUrl = documentId != null
            ? String.format("/documents/images/%s/%s.%s", documentId, imageId, ext)
            : "";
        imageReferences.add(new ImageReference(
            imageId,
            documentId != null ? documentId : "",
            ext,
            publicUrl,
            picture.getContent()
        ));

        if (!publicUrl.isEmpty()) {
            builder.append("![图片](").append(publicUrl).append(")");
        }
    }

    private static String normalizeRenderedText(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }
        return text.replace("\r", "\n")
            .replace("\u0007", "")
            .replace("\u0000", "")
            .trim();
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
