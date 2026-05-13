package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.ss.usermodel.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Excel 文档解析器
 *
 * 支持 .xlsx (XSSF) 和 .xls (HSSF) 格式，使用 WorkbookFactory 自动检测格式。
 * 提取所有工作表的文本内容，以表格形式输出。
 */
public class ExcelParser {

    private static final Logger log = LoggerFactory.getLogger(ExcelParser.class);

    /**
     * 解析 Excel 文件，提取所有工作表的文本内容
     *
     * @param inputStream Excel 文件输入流
     * @return 提取的文本内容
     * @throws IOException 如果解析失败
     */
    public static String parse(InputStream inputStream) throws IOException {
        try (Workbook workbook = WorkbookFactory.create(inputStream)) {
            List<String> lines = new ArrayList<>();
            DataFormatter formatter = new DataFormatter();

            int sheetCount = workbook.getNumberOfSheets();
            log.debug("Excel 工作表数量: {}", sheetCount);

            for (int s = 0; s < sheetCount; s++) {
                Sheet sheet = workbook.getSheetAt(s);
                String sheetName = sheet.getSheetName();

                if (sheetName != null && !sheetName.isBlank()) {
                    lines.add("【" + sheetName + "】");
                }

                int nonEmptyRowCount = 0;
                for (Row row : sheet) {
                    List<String> cellTexts = new ArrayList<>();
                    for (int cn = 0; cn < row.getLastCellNum(); cn++) {
                        Cell cell = row.getCell(cn, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                        if (cell != null) {
                            String value = formatter.formatCellValue(cell);
                            if (!value.isBlank()) {
                                cellTexts.add(value);
                            }
                        }
                    }
                    if (!cellTexts.isEmpty()) {
                        lines.add(String.join(" | ", cellTexts));
                        nonEmptyRowCount++;
                    }
                }

                if (nonEmptyRowCount > 0) {
                    lines.add("");
                }
            }

            String result = String.join("\n", lines).trim();
            log.info("Excel 解析完成: {} 个工作表, {} 行有效数据, {} 字符",
                sheetCount, nonEmptyRowCount(lines), result.length());
            return result;
        }
    }

    private static int nonEmptyRowCount(List<String> lines) {
        int count = 0;
        for (String line : lines) {
            if (!line.isBlank() && !line.startsWith("【")) {
                count++;
            }
        }
        return count;
    }
}
