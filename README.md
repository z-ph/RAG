# 智能知识库系统

基于 `Spring Boot 4`、`LangChain4j`、`Qdrant` 的 RAG 知识库系统。

当前仓库由两部分组成：

- 后端：`src/` 下的 Spring Boot API，负责文档解析、向量写入、检索增强问答和 SSE 流式输出
- 前端：`frontend/` 下的 React + Vite 控制台，负责文档管理和对话界面

## 当前能力

- 上传 `PDF` / `TXT` 文档并自动清洗、分块、去重
- 使用当前配置的 embedding provider 生成向量并写入 Qdrant
- 同步问答和流式问答
- 返回来源片段，支持会话取消和上下文清空
- 聊天模型和向量模型可分别选择 `ollama` 或 `vllm`
- 会话上下文使用内存滑动窗口，支持 TTL 自动清理
- 启动时自动检查 Qdrant collection；若维度不匹配会按配置重建

## 当前架构

```text
frontend (React + Vite)
        |
        v
Spring Boot API
  |- /api/documents/*
  |- /api/rag/*
  |
  |- ChatModel            <- llm.chat-provider
  |- StreamingChatModel   <- llm.chat-provider
  |- EmbeddingModel       <- llm.embedding-provider
  |
  |- Qdrant (持久化文档向量)
  \- In-memory sessions (会话上下文)
```

说明：

- 当前实现没有旧版文档中提到的 `Agent`、`领域文档管理`、`SQLite/JPA`、`登录系统`、`model-router`
- 后端默认不再提供旧的静态 HTML 页面；使用前端时请启动 `frontend/` 子项目

## 仓库结构

```text
.
├── src/
│   ├── main/java/com/mark/knowledge/
│   │   ├── KnowledgeApplication.java
│   │   ├── chat/config/ChatConfig.java
│   │   ├── config/QdrantInitializer.java
│   │   └── rag/
│   │       ├── app/
│   │       ├── dto/
│   │       ├── service/
│   │       └── store/
│   └── main/resources/application.yaml
├── frontend/
│   ├── src/
│   ├── package.json
│   └── README.md
├── docs/
│   ├── openapi.yaml
│   ├── Mixed-Model-Architecture-Guide.md
│   └── Database-Schema.md
├── .env.example
└── HELP.md
```

## 快速开始

### 1. 前置要求

- Java 21+
- Maven 3.9+
- Node.js 20+ 与 `pnpm`（如果需要启动前端）
- Qdrant
- 至少一个聊天模型 provider 和一个 embedding provider
  - `ollama`
  - `vllm` 或其他 OpenAI-compatible endpoint

### 2. 启动 Qdrant

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

端口说明：

- `6333`：HTTP 管理接口，文档列表和删除逻辑会用到
- `6334`：gRPC 接口，向量写入和检索会用到

### 3. 选择模型 provider

#### 方案 A：全部使用 Ollama

```bash
ollama serve
ollama pull qwen2.5:7b
ollama pull bge-base-zh
```

如果你打算使用别的 embedding 模型，需要同时调整 `OLLAMA_EMBEDDING_MODEL` 和 `QDRANT_VECTOR_SIZE`。

#### 方案 B：聊天走 OpenAI-compatible endpoint，向量仍走 Ollama

保留本地 Ollama embedding，并配置：

```bash
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=ollama
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
VLLM_CHAT_API_KEY=
```

`vllm` 在当前代码里表示“OpenAI-compatible provider”，不要求一定是 vLLM，也可以接入兼容接口的云端服务。

### 4. 配置后端

应用启动时会自动读取根目录 `.env`。推荐以 `.env.example` 为模板创建自己的 `.env`，常用配置如下：

```dotenv
LLM_CHAT_PROVIDER=ollama
LLM_EMBEDDING_PROVIDER=ollama

OLLAMA_CHAT_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=bge-base-zh

QDRANT_HOST=localhost
QDRANT_PORT=6334
QDRANT_HTTP_PORT=6333
QDRANT_COLLECTION_NAME=knowledge-base
QDRANT_VECTOR_SIZE=768
RAG_EMBEDDING_REQUEST_BATCH_SIZE=10
```

如果 embedding provider 是带输入条数上限的 OpenAI-compatible 接口，保留默认的 `RAG_EMBEDDING_REQUEST_BATCH_SIZE=10` 即可，文档入库时会自动分批请求 embedding。

### 5. 启动后端

```bash
mvn spring-boot:run
```

默认地址：`http://localhost:8080`

### 6. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

默认地址：`http://localhost:5173`

本地开发时，Vite 会把 `/api` 代理到 `http://localhost:8080`。

## API 概览

完整接口规范见 [docs/openapi.yaml](docs/openapi.yaml)。

### 文档接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传并处理 `PDF/TXT` 文档 |
| `GET` | `/api/documents` | 列出当前 Qdrant collection 中的文档 |
| `DELETE` | `/api/documents/{documentId}` | 删除指定文档对应的全部向量片段 |
| `GET` | `/api/documents/health` | 文档服务健康检查 |

### RAG 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rag/ask` | 同步返回答案和来源片段 |
| `POST` | `/api/rag/ask/stream` | SSE 流式返回答案 |
| `POST` | `/api/rag/conversations/{conversationId}/cancel` | 取消进行中的流式生成 |
| `DELETE` | `/api/rag/conversations/{conversationId}` | 清空会话上下文 |
| `GET` | `/api/rag/health` | RAG 服务健康检查 |

### SSE 事件

`/api/rag/ask/stream` 可能输出以下事件：

- `start`
- `sources`
- `delta`
- `complete`
- `cancelled`
- `error`

## 配置说明

当前有效配置位于 [src/main/resources/application.yaml](src/main/resources/application.yaml)。

### LLM 配置

```yaml
llm:
  chat-provider: ${LLM_CHAT_PROVIDER:ollama}
  embedding-provider: ${LLM_EMBEDDING_PROVIDER:ollama}
  timeout: ${LLM_TIMEOUT:120s}
  ollama:
    chat-base-url: ${OLLAMA_CHAT_BASE_URL:http://localhost:11434}
    embedding-base-url: ${OLLAMA_EMBEDDING_BASE_URL:http://localhost:11434}
    chat-model: ${OLLAMA_CHAT_MODEL:qwen2.5:7b}
    embedding-model: ${OLLAMA_EMBEDDING_MODEL:bge-base-zh}
    think: ${OLLAMA_THINK:false}
  vllm:
    chat-base-url: ${VLLM_CHAT_BASE_URL:http://localhost:8000/v1}
    embedding-base-url: ${VLLM_EMBEDDING_BASE_URL:http://localhost:8000/v1}
    chat-model: ${VLLM_CHAT_MODEL:Qwen/Qwen2.5-7B-Instruct}
    embedding-model: ${VLLM_EMBEDDING_MODEL:BAAI/bge-base-zh-v1.5}
    chat-api-key: ${VLLM_CHAT_API_KEY:}
    embedding-api-key: ${VLLM_EMBEDDING_API_KEY:}
```

### Qdrant 配置

```yaml
qdrant:
  host: ${QDRANT_HOST:localhost}
  port: ${QDRANT_PORT:6334}
  http-port: ${QDRANT_HTTP_PORT:6333}
  collection-name: ${QDRANT_COLLECTION_NAME:knowledge-base}
  vector-size: ${QDRANT_VECTOR_SIZE:768}
  create-collection-if-not-exists: ${QDRANT_CREATE_COLLECTION_IF_NOT_EXISTS:true}
```

注意：

- `qdrant.port` 是 gRPC 端口
- `qdrant.http-port` 是 HTTP 端口
- `qdrant.vector-size` 必须和实际 embedding 维度一致
- 启动时如果 collection 已存在但维度不匹配，应用会删除并重建 collection

### RAG 配置

```yaml
rag:
  chunk-size: ${RAG_CHUNK_SIZE:320}
  chunk-min-size: ${RAG_CHUNK_MIN_SIZE:250}
  chunk-max-size: ${RAG_CHUNK_MAX_SIZE:350}
  chunk-overlap: ${RAG_CHUNK_OVERLAP:40}
  embedding-request:
    batch-size: ${RAG_EMBEDDING_REQUEST_BATCH_SIZE:10}
  embedding-store:
    batch-size: ${RAG_EMBEDDING_STORE_BATCH_SIZE:32}
    max-retries: ${RAG_EMBEDDING_STORE_MAX_RETRIES:3}
    retry-backoff-ms: ${RAG_EMBEDDING_STORE_RETRY_BACKOFF_MS:1000}
  min-text-length: ${RAG_MIN_TEXT_LENGTH:80}
  keyword-count: ${RAG_KEYWORD_COUNT:6}
  max-results: ${RAG_MAX_RESULTS:5}
  min-score: ${RAG_MIN_SCORE:0.5}
  memory-window: ${RAG_MEMORY_WINDOW:6}
  session-ttl-seconds: ${RAG_SESSION_TTL_SECONDS:1800}
  memory-cleanup-interval-ms: ${RAG_MEMORY_CLEANUP_INTERVAL_MS:300000}
  stream-timeout-ms: ${RAG_STREAM_TIMEOUT_MS:300000}
```

注意：

- `rag.embedding-request.batch-size` 控制单次 embedding 请求包含的文本块数量，适合规避 OpenAI-compatible 接口的单请求输入上限
- `rag.embedding-store.batch-size` 只控制写入 Qdrant 的批次大小，和 embedding 请求批次无关

## 数据与存储

当前实现没有关系型数据库。

- 文档向量和文档元数据保存在 Qdrant
- 会话上下文保存在内存 `ConcurrentHashMap`
- 会话清空只影响内存上下文，不会删除 Qdrant 文档
- 文档列表接口会扫描当前 collection 的 payload 并按 `documentId` 聚合

每个文本片段写入 Qdrant 时会带上这些 metadata：

- `filename`
- `documentId`
- `chunkIndex`
- `chunkSize`
- `rawChunkSize`
- `chunkHash`
- `title`
- `category`
- `documentTime`
- `ingestedAt`
- `keywords`
- `documentKeywords`

## 前端说明

前端在 [frontend/README.md](frontend/README.md) 中单独维护说明。

当前界面能力与代码一致，包括：

- 上传文档
- 刷新文档列表
- 删除文档
- 查看服务健康状态
- 发起流式问答
- 取消生成
- 清空当前会话

## 更多文档

- [HELP.md](HELP.md)：快速运行说明
- [docs/openapi.yaml](docs/openapi.yaml)：接口定义
- [docs/Mixed-Model-Architecture-Guide.md](docs/Mixed-Model-Architecture-Guide.md)：provider 配置说明
- [docs/Database-Schema.md](docs/Database-Schema.md)：当前存储结构说明

## 已移除的旧说明

以下内容不再属于当前代码实现：

- 旧版静态页面：`/index.html`、`/upload.html`、`/chat.html`、`/agent-chat.html`、`/domain.html`、`/qdrant.html`
- `Agent`/工具调用/金融计算/领域文档管理
- `SQLite`、`JPA`、登录账号、默认用户
- `model-router`、`PERCENTAGE`、`BUSINESS_TYPE`
