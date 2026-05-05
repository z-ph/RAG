package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.usermodel.Paragraph;
import org.apache.poi.hwpf.usermodel.Range;
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

public class DocParser {

    private static final Logger log = LoggerFactory.getLogger(DocParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        try (HWPFDocument document = new HWPFDocument(inputStream)) {
            List<String> lines = new ArrayList<>();
            Range range = document.getRange();
            Set<Integer> skipParagraphs = new HashSet<>();

            // 第一遍：提取表格，记录属于表格的段落索引
            for (int i = 0; i < range.numParagraphs(); i++) {
                Paragraph paragraph = range.getParagraph(i);
                if (paragraph.isInTable() && !skipParagraphs.contains(i)) {
                    try {
                        Table table = range.getTable(paragraph);
                        int tableStart = table.getStartOffset();
                        int tableEnd = table.getEndOffset();
                        for (int r = 0; r < table.numRows(); r++) {
                            TableRow row = table.getRow(r);
                            List<String> cellTexts = new ArrayList<>();
                            for (int c = 0; c < row.numCells(); c++) {
                                TableCell cell = row.getCell(c);
                                String cellText = cell.text();
                                if (cellText != null && !cellText.isBlank()) {
                                    cellTexts.add(cellText.trim());
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
                String text = paragraph.text();
                if (text != null && !text.isBlank()) {
                    lines.add(text.trim());
                }
            }

            String result = String.join("\n\n", lines);
            log.info("DOC 解析完成: {} 个段落/行", lines.size());
            return result;
        }
    }
}
