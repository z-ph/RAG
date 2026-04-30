package com.mark.knowledge.rag.service;

import com.mark.knowledge.rag.entity.SystemPrompt;
import com.mark.knowledge.rag.repository.SystemPromptRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PromptService {

    private static final Logger log = LoggerFactory.getLogger(PromptService.class);

    private static final Map<String, PromptDefaults> DEFAULTS = new LinkedHashMap<>();

    static {
        DEFAULTS.put("rag_system", new PromptDefaults(
            "RAG 系统提示词",
            """
            你是一个企业制度文档智能问答助手，基于提供的文档内容回答用户问题。

            ## 回答原则

            1. **语义理解与语境区分**：
               - 准确理解制度条文在特定语境下的含义
               - 区分相似但不同的概念（如"烟酒"指烟类和酒类产品，不等同于化学"酒精"；医用酒精不属于烟酒范畴）
               - 识别具体品牌或产品的归属类别（如"茅台"、"五粮液"属于"酒类"，应适用烟酒相关限制）
               - 遇到歧义时，优先采用制度文件中的定义，而非日常用语

            2. **引导式回答**：
               - 如果用户的问题过于笼统（如"怎么报销"、"有什么规定"），必须主动追问以明确具体场景
               - 追问要简洁具体，提供2-4个选项供用户选择
               - 例如："请问您咨询的是哪类费用的报销？（差旅费 / 接待费 / 办公费 / 其他）"
               - 仅在问题确实模糊不清时才追问，已有足够上下文时直接回答

            3. **举例说明**：
               - 在解释抽象制度条文时，用贴近实际工作场景的具体例子帮助理解
               - 用"例如："前缀标注举例内容，与正式条文区分
               - 举例应涵盖常见场景和边界情况

            4. **严格依据文档**：
               - 答案必须基于提供的文档上下文
               - 如果文档中没有相关信息，明确告知"根据已上传文档，暂未找到相关规定"
               - 不编造、不推测文档之外的内容

            ## 格式要求
            - 使用中文回答
            - 引用制度原文时用引号标注
            - 列举多项时使用编号列表"""
        ));
        DEFAULTS.put("rag_rewrite", new PromptDefaults(
            "问题改写提示词",
            """
            你需要结合历史对话，把用户当前问题改写成一个完整、独立、可用于知识库检索的问题。
            如果当前问题本身已经完整，直接原样返回，不要增加解释。
            只输出改写后的问题，不要输出其它内容。

            历史对话：
            %s

            当前问题：
            %s"""
        ));
    }

    private final SystemPromptRepository repository;

    public PromptService(SystemPromptRepository repository) {
        this.repository = repository;
    }

    @PostConstruct
    void initDefaults() {
        for (Map.Entry<String, PromptDefaults> entry : DEFAULTS.entrySet()) {
            if (repository.findByPromptKey(entry.getKey()).isEmpty()) {
                SystemPrompt prompt = new SystemPrompt(
                    entry.getKey(),
                    entry.getValue().content(),
                    entry.getValue().description()
                );
                repository.save(prompt);
                log.info("初始化默认提示词: {}", entry.getKey());
            }
        }
    }

    public String getPrompt(String key) {
        return repository.findByPromptKey(key)
            .map(SystemPrompt::getPromptContent)
            .or(() -> {
                PromptDefaults defaults = DEFAULTS.get(key);
                return defaults != null ? java.util.Optional.of(defaults.content()) : java.util.Optional.empty();
            })
            .orElseThrow(() -> new IllegalArgumentException("未知的提示词 key: " + key));
    }

    public List<SystemPrompt> listPrompts() {
        return repository.findAll();
    }

    @Transactional
    public SystemPrompt savePrompt(String key, String content, String description) {
        SystemPrompt prompt = repository.findByPromptKey(key)
            .orElseThrow(() -> new IllegalArgumentException("未知的提示词 key: " + key));
        prompt.setPromptContent(content);
        if (description != null) {
            prompt.setDescription(description);
        }
        prompt.setUpdatedBy("admin");
        return repository.save(prompt);
    }

    @Transactional
    public SystemPrompt resetPrompt(String key) {
        PromptDefaults defaults = DEFAULTS.get(key);
        if (defaults == null) {
            throw new IllegalArgumentException("未知的提示词 key: " + key);
        }
        SystemPrompt prompt = repository.findByPromptKey(key)
            .orElseThrow(() -> new IllegalArgumentException("未知的提示词 key: " + key));
        prompt.setPromptContent(defaults.content());
        prompt.setDescription(defaults.description());
        prompt.setUpdatedBy("admin");
        return repository.save(prompt);
    }

    public String getDefaultContent(String key) {
        PromptDefaults defaults = DEFAULTS.get(key);
        return defaults != null ? defaults.content() : null;
    }

    private record PromptDefaults(String description, String content) {}
}
