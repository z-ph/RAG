package com.mark.knowledge.rag.service.parsers;

import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.apache.poi.xslf.usermodel.XSLFShape;
import org.apache.poi.xslf.usermodel.XSLFSlide;
import org.apache.poi.xslf.usermodel.XSLFTable;
import org.apache.poi.xslf.usermodel.XSLFTableCell;
import org.apache.poi.xslf.usermodel.XSLFTextShape;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

public class PptxParser {

    private static final Logger log = LoggerFactory.getLogger(PptxParser.class);

    public static String parse(InputStream inputStream) throws IOException {
        try (XMLSlideShow slideShow = new XMLSlideShow(inputStream)) {
            List<String> allLines = new ArrayList<>();

            for (int i = 0; i < slideShow.getSlides().size(); i++) {
                XSLFSlide slide = slideShow.getSlides().get(i);
                List<String> slideLines = new ArrayList<>();
                slideLines.add("[Slide " + (i + 1) + "]");

                for (XSLFShape shape : slide.getShapes()) {
                    if (shape instanceof XSLFTextShape textShape) {
                        String text = textShape.getText();
                        if (text != null && !text.isBlank()) {
                            slideLines.add(text.trim());
                        }
                    } else if (shape instanceof XSLFTable table) {
                        for (var row : table.getRows()) {
                            List<String> cellTexts = new ArrayList<>();
                            for (XSLFTableCell cell : row.getCells()) {
                                String cellText = cell.getText();
                                if (cellText != null && !cellText.isBlank()) {
                                    cellTexts.add(cellText.trim());
                                }
                            }
                            if (!cellTexts.isEmpty()) {
                                slideLines.add(String.join(" | ", cellTexts));
                            }
                        }
                    }
                }

                if (slideLines.size() > 1) {
                    allLines.addAll(slideLines);
                    allLines.add("");
                }
            }

            String result = String.join("\n", allLines);
            log.info("PPTX 解析完成: {} 个幻灯片", slideShow.getSlides().size());
            return result;
        }
    }
}
