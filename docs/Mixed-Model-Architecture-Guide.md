# Provider 配置指南

这个文件沿用旧文件名，但内容已经按当前代码重写。

当前实现不再包含请求级模型路由，也没有 `model-router`、`PERCENTAGE`、`BUSINESS_TYPE`。现在的行为是：

- `llm.chat-provider` 决定聊天模型和流式聊天模型
- `llm.embedding-provider` 决定向量模型
- 两者在应用启动时固定初始化

## 当前架构

```text
RAG Request
   |
   +--> EmbeddingModel      <- llm.embedding-provider
   |       |
   |       \--> Qdrant search / write
   |
   \--> ChatModel / StreamingChatModel <- llm.chat-provider
```

当前仅支持的 provider 值为 `vllm`。

其中 `vllm` 在代码里表示 OpenAI-compatible provider。它可以是：

- 本地 vLLM
- 兼容 OpenAI API 的代理
- 兼容接口的云端服务

## 代码入口

相关实现位于：

- [src/main/java/com/mark/knowledge/chat/config/ChatConfig.java](../src/main/java/com/mark/knowledge/chat/config/ChatConfig.java)
- [src/main/resources/application.yaml](../src/main/resources/application.yaml)

`ChatConfig` 会根据 `llm.chat-provider` 和 `llm.embedding-provider` 初始化：

- `ChatModel`
- `StreamingChatModel`
- `EmbeddingModel`

## 当前有效配置项

```yaml
llm:
  chat-provider: ${LLM_CHAT_PROVIDER:vllm}
  embedding-provider: ${LLM_EMBEDDING_PROVIDER:vllm}
  timeout: ${LLM_TIMEOUT:120s}
  vllm:
    chat-base-url: ${VLLM_CHAT_BASE_URL:http://localhost:8000/v1}
    embedding-base-url: ${VLLM_EMBEDDING_BASE_URL:http://localhost:8000/v1}
    chat-model: ${VLLM_CHAT_MODEL:Qwen/Qwen2.5-7B-Instruct}
    embedding-model: ${VLLM_EMBEDDING_MODEL:BAAI/bge-base-zh-v1.5}
    chat-api-key: ${VLLM_CHAT_API_KEY:}
    embedding-api-key: ${VLLM_EMBEDDING_API_KEY:}
```

## 推荐配置方式

### 方案 1：全部走 OpenAI-compatible provider

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm

VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_EMBEDDING_BASE_URL=http://localhost:8000/v1
VLLM_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
VLLM_EMBEDDING_MODEL=BAAI/bge-base-zh-v1.5
VLLM_CHAT_API_KEY=
VLLM_EMBEDDING_API_KEY=
RAG_EMBEDDING_REQUEST_BATCH_SIZE=10
```

适合：

- 已有统一的 OpenAI-compatible 网关
- 不希望本地部署模型服务

## 使用兼容接口的云端服务

如果云端服务提供 OpenAI-compatible endpoint，只需要把它填到 `VLLM_*` 配置里。例如：

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm

VLLM_CHAT_BASE_URL=https://your-endpoint.example.com/v1
VLLM_EMBEDDING_BASE_URL=https://your-endpoint.example.com/v1
VLLM_CHAT_MODEL=your-chat-model
VLLM_EMBEDDING_MODEL=your-embedding-model
VLLM_CHAT_API_KEY=your-api-key
VLLM_EMBEDDING_API_KEY=your-api-key
```

## 注意事项

### 1. 这里没有自动路由

当前代码不会：

- 按百分比切换模型
- 按业务类型切换模型
- 在单次请求中动态选择 provider

provider 只在应用启动时读取一次配置。

### 2. 向量维度要和 Qdrant 一致

切换 embedding 模型时，要同步检查：

- `VLLM_EMBEDDING_MODEL`
- `QDRANT_VECTOR_SIZE`

如果 collection 已存在但维度不一致，启动时会由 `QdrantInitializer` 删除并重建 collection。

### 3. `llm.timeout` 作用于所有模型初始化

支持的格式：

- `120s`
- `500ms`
- `2m`
- 标准 `Duration` 字符串

### 4. OpenAI-compatible embedding 接口可能有单次输入上限

当前文档入库会按 `rag.embedding-request.batch-size` 分批调用 `EmbeddingModel.embedAll(...)`。

默认值是：

```dotenv
RAG_EMBEDDING_REQUEST_BATCH_SIZE=10
```

这个批次只影响 embedding 请求，不影响后续写入 Qdrant 的 `rag.embedding-store.batch-size`。

### 5. `vllm` 使用独立 reasoning 字段

`vllm` / OpenAI-compatible chat 现在使用：

- `llm.vllm.return-thinking`，默认 `true`

当上游响应把思考内容放在独立字段时：

- 当前实现按 `reasoning_content` 读取

- 同步 `/api/rag/ask` 会在 `thinking` 字段返回
- 流式 `/api/rag/ask/stream` 会通过 `thinking_delta` 事件增量推送
- 流式 `/api/rag/ask/stream` 会通过 `thinking_end` 事件标记思考阶段结束
- 前端会把思考过程和最终答案分开渲染，思考区支持手动折叠，并会在思考结束后自动收起

## 启动后如何确认生效

查看启动日志，当前实现会输出类似：

```text
初始化聊天模型: provider=vllm, baseUrl=http://localhost:8000/v1, model=Qwen/Qwen2.5-7B-Instruct, returnThinking=true
初始化流式聊天模型: provider=vllm, baseUrl=http://localhost:8000/v1, model=Qwen/Qwen2.5-7B-Instruct, returnThinking=true
初始化嵌入模型: provider=vllm, baseUrl=http://localhost:8000/v1, model=BAAI/bge-base-zh-v1.5
```

## 旧版配置名对照

以下旧配置在当前代码里已经无效：

- `model-router.*`
- `dashscope.api-key`
- `DASHSCOPE_API_KEY`
- `aliyun` / `local` 路由比例配置
- `BUSINESS_TYPE` 路由表
- `OLLAMA_*` 系列配置（Ollama 支持已移除）

如果你是从旧文档迁移，请直接改用：

- `LLM_CHAT_PROVIDER`
- `LLM_EMBEDDING_PROVIDER`
- `VLLM_CHAT_*`
- `VLLM_EMBEDDING_*`
