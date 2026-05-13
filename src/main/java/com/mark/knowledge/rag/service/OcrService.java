package com.mark.knowledge.rag.service;

import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * OCR 服务 —— 用于从扫描版/图片型 PDF 中提取文字
 *
 * 使用 Tesseract (通过 Tess4J) 对 PDF 页面渲染后的图片进行 OCR 识别。
 * 支持中英双语（eng+chi_sim）。
 *
 * 如果系统中未安装 Tesseract 或缺少语言包，服务会优雅降级并返回空字符串。
 */
@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);
    private static final String DEFAULT_TESSDATA_PATH = "/usr/share/tesseract-ocr/5/tessdata";
    private static final int DEFAULT_DPI = 200;

    @Value("${ocr.tessdata-path:}")
    private String configuredTessdataPath;

    @Value("${ocr.language:eng+chi_sim}")
    private String ocrLanguage;

    @Value("${ocr.dpi:200}")
    private int ocrDpi;

    @Value("${ocr.enabled:true}")
    private boolean ocrEnabled;

    private volatile ITesseract tesseractInstance;
    private volatile boolean tesseractAvailable = false;

    /**
     * 判断是否应该尝试 OCR（当提取到的文本极少时）
     *
     * @param extractedText PDFTextStripper 提取的文本
     * @param minTextLength 最小有效文本长度阈值
     * @return 如果文本太少，应该尝试 OCR
     */
    public boolean shouldAttemptOcr(String extractedText, int minTextLength) {
        if (!ocrEnabled) {
            return false;
        }
        if (extractedText == null || extractedText.isBlank()) {
            return true;
        }
        return extractedText.trim().length() < minTextLength;
    }

    /**
     * 对 PDF 字节数组执行 OCR，提取所有页面的文字
     *
     * @param pdfBytes PDF 文件字节
     * @return 提取的文字，失败时返回空字符串
     */
    public String ocrPdf(byte[] pdfBytes) {
        if (!ocrEnabled) {
            log.debug("OCR 已禁用，跳过");
            return "";
        }

        ITesseract tesseract = getTesseract();
        if (tesseract == null) {
            log.warn("Tesseract 不可用，OCR 跳过");
            return "";
        }

        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            PDFRenderer renderer = new PDFRenderer(document);
            renderer.setSubsamplingAllowed(true);

            int pageCount = document.getNumberOfPages();
            log.info("开始 OCR，共 {} 页，DPI={}，语言={}", pageCount, ocrDpi, ocrLanguage);

            List<String> pageTexts = new ArrayList<>();
            for (int i = 0; i < pageCount; i++) {
                BufferedImage image = null;
                try {
                    image = renderer.renderImageWithDPI(i, ocrDpi, ImageType.GRAY);
                    String pageText = tesseract.doOCR(image);
                    if (pageText != null && !pageText.isBlank()) {
                        pageTexts.add(pageText.trim());
                    }
                    log.debug("OCR 第 {}/{} 页完成", i + 1, pageCount);
                } catch (Exception e) {
                    log.warn("OCR 第 {} 页失败: {}", i + 1, e.getMessage());
                } finally {
                    if (image != null) {
                        image.flush();
                    }
                }
            }

            String result = String.join("\n\n", pageTexts);
            log.info("OCR 完成，提取 {} 字符", result.length());
            return result;
        } catch (IOException e) {
            log.error("OCR 加载 PDF 失败", e);
            return "";
        }
    }

    /**
     * 对单个 BufferedImage 执行 OCR
     *
     * @param image 图片
     * @return 提取的文字
     */
    public String ocrImage(BufferedImage image) {
        if (!ocrEnabled) {
            return "";
        }
        ITesseract tesseract = getTesseract();
        if (tesseract == null) {
            return "";
        }
        try {
            return tesseract.doOCR(image);
        } catch (Exception e) {
            log.warn("图片 OCR 失败: {}", e.getMessage());
            return "";
        }
    }

    private synchronized ITesseract getTesseract() {
        if (tesseractInstance != null) {
            return tesseractInstance;
        }

        try {
            ITesseract tesseract = new Tesseract();

            String tessdataPath = resolveTessdataPath();
            tesseract.setDatapath(tessdataPath);
            tesseract.setLanguage(ocrLanguage);

            log.info("Tesseract OCR 初始化成功，tessdata={}，语言={}", tessdataPath, ocrLanguage);
            tesseractAvailable = true;
            tesseractInstance = tesseract;
            return tesseractInstance;
        } catch (UnsatisfiedLinkError e) {
            log.warn("Tesseract 本地库未安装或不可用，OCR 功能将不可用: {}", e.getMessage());
            tesseractAvailable = false;
            return null;
        } catch (Exception e) {
            log.warn("Tesseract 初始化失败: {}", e.getMessage());
            tesseractAvailable = false;
            return null;
        }
    }

    private String resolveTessdataPath() {
        if (configuredTessdataPath != null && !configuredTessdataPath.isBlank()) {
            return configuredTessdataPath;
        }
        String envPath = System.getenv("TESSDATA_PREFIX");
        if (envPath != null && !envPath.isBlank()) {
            return envPath;
        }
        return DEFAULT_TESSDATA_PATH;
    }

    public boolean isTesseractAvailable() {
        if (tesseractInstance == null) {
            getTesseract();
        }
        return tesseractAvailable;
    }
}
