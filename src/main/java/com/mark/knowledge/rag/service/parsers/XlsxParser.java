package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class XlsxParser {

    private static final Logger log = LoggerFactory.getLogger(XlsxParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            List<String> allLines = new ArrayList<>();

            for (int i = 0; i < workbook.getNumberOfSheets(); i++) {
                Sheet sheet = workbook.getSheetAt(i);
                String sheetName = sheet.getSheetName();
                List<String> sheetLines = new ArrayList<>();
                sheetLines.add("[Sheet: " + sheetName + "]");

                for (int rowIdx = 0; rowIdx <= sheet.getLastRowNum(); rowIdx++) {
                    Row row = sheet.getRow(rowIdx);
                    if (row == null) continue;

                    List<String> cellTexts = new ArrayList<>();
                    for (int colIdx = 0; colIdx < row.getLastCellNum(); colIdx++) {
                        Cell cell = row.getCell(colIdx);
                        cellTexts.add(cellToString(cell));
                    }

                    String line = String.join(" | ", cellTexts).trim();
                    if (!line.replace("|", "").isBlank()) {
                        sheetLines.add(line);
                    }
                }

                if (sheetLines.size() > 1) {
                    allLines.addAll(sheetLines);
                    allLines.add("");
                }
            }

            String result = String.join("\n", allLines);
            log.info("XLSX 解析完成: {} 个 sheet, {} 行", workbook.getNumberOfSheets(), allLines.size());
            return result;
        }
    }

    private static String cellToString(Cell cell) {
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue();
            case NUMERIC -> {
                if (DateUtil.isCellDateFormatted(cell)) {
                    yield cell.getDateCellValue().toString();
                }
                double val = cell.getNumericCellValue();
                if (val == Math.floor(val) && !Double.isInfinite(val)) {
                    yield String.valueOf((long) val);
                }
                yield String.valueOf(val);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try {
                    yield cell.getStringCellValue();
                } catch (Exception e) {
                    try {
                        yield String.valueOf(cell.getNumericCellValue());
                    } catch (Exception e2) {
                        yield cell.getCellFormula();
                    }
                }
            }
            default -> "";
        };
    }
}
