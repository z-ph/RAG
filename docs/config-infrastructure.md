# 配置与基础设施

## 模块总览

基础设施层提供向量数据库初始化、限流、日志、环境变量加载、LLM 模型配置和结构化日志等横切关注点。

**核心类：**
- `com.mark.knowledge.config.QdrantInitializer` — Qdrant 集合自动初始化
- `com.mark.knowledge.config.RateLimitFilter` — 令牌桶限流过滤器
- `com.mark.knowledge.config.LoggingFilter` — 请求日志过滤器
- `com.mark.knowledge.config.EnvFileEnvironmentPostProcessor` — .env 文件加载
- `com.mark.knowledge.chat.config.ChatConfig` — LLM 聊天模型 Bean 配置
- `com.mark.knowledge.config.structuredlogging.PipelineLogger` — RAG 管道日志
- `com.mark.knowledge.config.structuredlogging.LogService` — 日志持久化服务
- `com.mark.knowledge.config.structuredlogging.LogController` — 日志查询 API
- `com.mark.knowledge.config.structuredlogging.RepositoryLoggingAspect` — AOP 仓库日志
- `com.mark.knowledge.config.structuredlogging.StructuredLog` — 结构化日志注解

---

## Qdrant 初始化 (QdrantInitializer)

应用启动时自动检查并创建 Qdrant 集合。

**行为：**
1. 连接 Qdrant（gRPC）
2. 检查目标集合是否存在
3. 不存在则创建，配置向量维度（768）和距离度量（Cosine）
4. 已存在则跳过

**配置：** 通过 `application.yaml` 中的 Qdrant 连接参数自动注入。

---

## 限流过滤器 (RateLimitFilter)

基于令牌桶算法的请求限流，保护公开接口免受滥用。

### `doFilterInternal(HttpServletRequest, HttpServletResponse, FilterChain)`

**适用端点：** `/documents/public/**`

**限流算法：** 令牌桶
- 每个客户端 IP 独立限流
- 令牌按固定速率补充
- 桶满时新请求被拒绝（HTTP 429）

**响应 429：**
```json
{"error": "请求过于频繁", "message": "请稍后再试"}
```

---

## 请求日志过滤器 (LoggingFilter)

记录每个 HTTP 请求的基本信息。

**记录内容：**
- 请求方法（GET/POST/PUT/DELETE）
- 请求路径
- 响应状态码
- 请求耗时

---

## 环境变量加载 (EnvFileEnvironmentPostProcessor)

Spring Boot `EnvironmentPostProcessor` 实现，在应用启动早期从 `.env` 文件加载环境变量。

**行为：**
1. 检查项目根目录下是否存在 `.env` 文件
2. 解析 `KEY=VALUE` 格式的配置
3. 注入到 Spring Environment 中，优先级低于 `application.yaml`

**用途：** 本地开发时避免在配置文件中硬编码敏感信息（数据库密码、API Key 等）。

---

## LLM 聊天模型配置 (ChatConfig)

### Bean 定义

| Bean | 类型 | 说明 |
|------|------|------|
| `chatModel` | `ChatModel` | 同步聊天模型，用于问题改写和同步问答 |
| `streamingChatModel` | `StreamingChatModel` | 流式聊天模型，用于 SSE 流式响应 |
| `embeddingModel` | `EmbeddingModel` | 嵌入模型，用于文本向量化 |

**模型配置：** 通过 `application.yaml` 中的 OpenAI 兼容 API 配置，连接 vLLM 服务。

**关键配置项：**
```yaml
langchain4j:
  open-ai:
    chat-model:
      base-url: ${LLM_BASE_URL}
      api-key: ${LLM_API_KEY}
      model-name: ${LLM_MODEL_NAME}
    streaming-chat-model:
      base-url: ${LLM_BASE_URL}
      api-key: ${LLM_API_KEY}
      model-name: ${LLM_MODEL_NAME}
    embedding-model:
      base-url: ${EMBEDDING_BASE_URL}
      api-key: ${EMBEDDING_API_KEY}
      model-name: ${EMBEDDING_MODEL_NAME}
```

---

## 结构化日志体系

### PipelineLogger

RAG 管道专用日志工具，记录管道各步骤的输入/输出/耗时。

**方法：**
```java
PipelineLogger.logStep(conversationId, stepName, input, output, elapsedMs)
```

**使用场景：** 在 `RagService` 的各个管道阶段调用，记录：
- `question_rewrite` — 问题改写
- `vector_search` — 向量检索
- `bm25_rerank` — BM25 重排
- `cross_document` — 跨文档检索
- `model_generate` — 模型生成

### LogService

日志持久化服务，将管道日志存储到内存供后续查询。

### LogController

提供日志查询 REST API，用于前端展示或调试。

### RepositoryLoggingAspect

AOP 切面，自动记录所有 Spring Data Repository 方法的调用日志。

### StructuredLog

注解标记，用于标记需要结构化日志记录的方法。

---

## CORS 配置

在 `SecurityConfig` 中配置：

| 配置项 | 值 |
|--------|-----|
| 允许源 | `*`（通配） |
| 允许方法 | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| 允许头 | `*`（通配） |
| 允许凭证 | false |
| 缓存时间 | 3600 秒 |

---

## Docker 部署架构

### docker-compose.yml 服务

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `app` | 自建（多阶段构建） | 8080:8080 | Spring Boot 应用 |
| `mysql` | mysql:8.x | 3306:3306 | 关系数据库 |
| `qdrant`` | qdrant/qdrant | 6333:6333, 6334:6334 | 向量数据库 |

### 网络

所有服务在同一 Docker 桥接网络内，通过服务名互访：
- `app` → `mysql:3306`（JDBC）
- `app` → `qdrant:6334`（gRPC）
- `app` → vLLM 服务（HTTP，通常在 Docker 外部）

### 持久化卷

- MySQL 数据目录
- Qdrant 存储目录
