# 智能知识库系统 - 快速开始

本文档只描述当前代码里的实际运行方式。

## 先确认当前项目形态

- 后端：Spring Boot API，地址默认 `http://localhost:8080`
- 前端：`frontend/` 下的 React + Vite，地址默认 `http://localhost:5173`
- 存储：Qdrant + 内存会话
- 不包含：登录系统、SQLite/JPA、Agent 页面、旧版多 HTML 页面

运行前端还需要：

- Node.js 20+
- `pnpm`

## 最快跑通方式

### 1. 启动 Qdrant

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

### 2. 配置后端

根目录 `.env` 会在启动时自动加载。最小配置示例：

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_EMBEDDING_BASE_URL=http://localhost:8000/v1
VLLM_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
VLLM_EMBEDDING_MODEL=BAAI/bge-base-zh-v1.5
QDRANT_HOST=localhost
QDRANT_PORT=6334
QDRANT_HTTP_PORT=6333
QDRANT_VECTOR_SIZE=768
```

如果 embedding 模型维度不是 `768`，同时改掉 `QDRANT_VECTOR_SIZE`。

### 4. 启动后端

```bash
mvn spring-boot:run
```

### 5. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

访问：

- 前端：`http://localhost:5173`
- 后端 API：`http://localhost:8080`

## 当前页面入口

当前前端只有一个 Vite 应用入口，不再使用旧的静态 HTML 页面。

- 前端首页：`/`
- API 前缀：`/api`

## 当前接口

### 文档管理

- `POST /api/documents/upload`
- `GET /api/documents`
- `DELETE /api/documents/{documentId}`
- `GET /api/documents/health`

### RAG

- `POST /api/rag/ask`
- `POST /api/rag/ask/stream`
- `POST /api/rag/conversations/{conversationId}/cancel`
- `DELETE /api/rag/conversations/{conversationId}`
- `GET /api/rag/health`

完整规范见 [docs/openapi.yaml](docs/openapi.yaml)。

## 常用配置

### provider 选择

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm
```

当前仅支持 `vllm`，代表 OpenAI-compatible provider，不要求一定是本地 vLLM。

### Qdrant

```dotenv
QDRANT_HOST=localhost
QDRANT_PORT=6334
QDRANT_HTTP_PORT=6333
QDRANT_COLLECTION_NAME=knowledge-base
QDRANT_VECTOR_SIZE=768
```

### 会话与检索

```dotenv
RAG_MAX_RESULTS=5
RAG_MIN_SCORE=0.5
RAG_MEMORY_WINDOW=6
RAG_SESSION_TTL_SECONDS=1800
```

## 常见问题

### Q: 为什么 `http://localhost:8080` 打开不是旧版页面？

A: 当前仓库后端主要提供 API，前端需要单独运行 `frontend/` 子项目。

### Q: 为什么文档里不再有默认账号？

A: 当前实现没有登录和用户表。

### Q: 为什么改 embedding 模型后检索失败？

A: 先确认 `QDRANT_VECTOR_SIZE` 和 embedding 维度一致。应用启动时如果发现 collection 维度不匹配，会按配置重建 collection。

### Q: 会话历史保存在哪里？

A: 只保存在内存里，达到 TTL 后会被清理，重启应用也会丢失。

## 相关文档

- [README.md](README.md)
- [frontend/README.md](frontend/README.md)
- [docs/Mixed-Model-Architecture-Guide.md](docs/Mixed-Model-Architecture-Guide.md)
- [docs/Database-Schema.md](docs/Database-Schema.md)
