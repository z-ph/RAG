package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class DocxParser {

    private static final Logger log = LoggerFactory.getLogger(DocxParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream)) {
            List<String> lines = new ArrayList<>();

            for (XWPFParagraph paragraph : document.getParagraphs()) {
                String text = paragraph.getText();
                if (text != null && !text.isBlank()) {
                    lines.add(text.trim());
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
            log.info("DOCX 解析完成: {} 个段落/行", lines.size());
            return result;
        }
    }
}
