# 智能知识库系统

基于 `Spring Boot 4`、`LangChain4j`、`MySQL`、`Qdrant` 的 RAG 知识库系统。

当前仓库由两部分组成：

- 后端：`src/` 下的 Spring Boot API，负责登录鉴权、注册码管理、文档解析、向量写入、检索增强问答和 SSE 流式输出
- 前端：`frontend/` 下的 React + Vite 控制台，负责文档管理、注册码管理和对话界面

## 当前能力

- 上传 `PDF` / `TXT` 文档并自动清洗、分块、去重
- 文档上传、列表、删除接口采用登录鉴权；RAG 问答接口保持匿名可用
- 启动时自动创建 MySQL 表，并自动初始化一个管理员账号
- 管理员可创建一次性注册码，支持设置有效期、手动禁用和删除
- 新用户只能使用有效注册码注册，注册码使用后立即失效
- 使用当前配置的 embedding provider 生成向量并写入 Qdrant
- 同步问答和流式问答
- 独立返回并展示模型思考内容，思考结束后前端自动折叠
- 返回来源片段，支持会话取消和上下文清空
- 聊天模型和向量模型均使用 OpenAI-compatible provider（`vllm`）
- 会话上下文使用内存滑动窗口，支持 TTL 自动清理
- 启动时自动检查 Qdrant collection；若维度不匹配会按配置重建

## 当前架构

```text
frontend (React + Vite)
        |
        v
Spring Boot API
  |- /api/auth/*        <- Session 登录、注册码管理
  |- /api/documents/*   <- 需要登录
  |- /api/rag/*         <- 匿名可访问
  |
  |- MySQL              <- 用户、注册码，JPA 自动建表
  |- Qdrant             <- 文档向量与 metadata
  \- In-memory sessions <- RAG 会话上下文
```

说明：

- 文档模块通过 Session Cookie 鉴权，前端使用同源 `/api` 请求自动携带 Cookie
- 本地开发仍推荐单独启动 `frontend/` 子项目
- **前端不再由后端托管**，Docker / 生产环境前端需独立构建部署（见下方 Docker 部署说明）

## 仓库结构

```text
.
├── src/
│   ├── main/java/com/mark/knowledge/
│   │   ├── auth/
│   │   ├── chat/config/ChatConfig.java
│   │   ├── config/QdrantInitializer.java
│   │   └── rag/
│   └── main/resources/application.yaml
├── frontend/
│   ├── src/
│   ├── package.json
│   └── README.md
├── docs/
│   ├── openapi.yaml
│   ├── Docker-Deployment.md
│   ├── Mixed-Model-Architecture-Guide.md
│   └── Database-Schema.md
├── .env.example
└── HELP.md
```

## Docker 部署

仓库现在采用**前后端分离部署**方案：

- **后端**：Spring Boot 独立运行，不再托管前端静态资源
- **前端**：由根目录 `Dockerfile` 统一多阶段构建，产物在镜像 `/app/dist` 目录，可通过 volume 导出到宿主机
- **外部依赖**：`MySQL` + `Qdrant` 由 `docker-compose.yml` 统一管理

推荐直接使用仓库根目录的 compose：

```bash
# 构建镜像并启动后端及依赖
docker compose up --build -d
```

启动后访问：

- 后端 API：`http://localhost:8081`
- Qdrant HTTP：`http://localhost:6333`
- Qdrant gRPC：`localhost:6334`

前端产物在镜像的 `/app/dist` 目录，导出到宿主机：

```bash
# 使用脚本导出（推荐）
./scripts/export-frontend.sh

# 或手动执行
docker run --rm -v "$(pwd)/dist:/output/dist" knowledge-rag sh -c \
  "mkdir -p /output/dist && cp -r /app/dist/* /output/dist/"
```

产物位于 `./dist`，可直接用 Nginx、CDN 或任意静态服务器部署。若本地快速验证，可用：

```bash
cd dist && npx serve .
```

补充说明：

- compose 默认把 `Qdrant` 作为独立容器启动
- 如果模型服务运行在宿主机，compose 默认使用 `host.docker.internal`
- Linux 环境下 compose 已包含 `extra_hosts: host.docker.internal:host-gateway`
- 详细镜像说明和 `docker build` / `docker run` 示例见 [docs/Docker-Deployment.md](docs/Docker-Deployment.md)

## 本地开发

### 1. 前置要求

- Java 21+
- Maven 3.9+
- Node.js 20+ 与 `pnpm`
- MySQL 8+
- Qdrant
- 一个兼容 OpenAI API 的聊天模型和 embedding 模型服务

### 2. 启动 MySQL

```bash
docker run -d --name mysql-rag \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=123456 \
  -e MYSQL_DATABASE=knowledge_rag \
  mysql:8.4
```

### 3. 启动 Qdrant

```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant
```

端口说明：

- `3306`：MySQL，JPA 自动建表和账号数据存储
- `6333`：Qdrant HTTP 管理接口，文档列表和删除逻辑会用到
- `6334`：Qdrant gRPC 接口，向量写入和检索会用到

### 4. 选择模型 provider

#### 配置模型服务

`vllm` 在当前代码里表示"OpenAI-compatible provider"，不要求一定是 vLLM，也可以接入兼容接口的云端服务。

```bash
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_EMBEDDING_BASE_URL=http://localhost:8000/v1
VLLM_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
VLLM_EMBEDDING_MODEL=BAAI/bge-base-zh-v1.5
VLLM_CHAT_API_KEY=
VLLM_RETURN_THINKING=true
```

### 5. 配置后端

应用启动时会自动读取根目录 `.env`。推荐以 `.env.example` 为模板创建自己的 `.env`，常用配置如下：

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm
VLLM_CHAT_BASE_URL=http://localhost:8000/v1
VLLM_CHAT_MODEL=Qwen/Qwen2.5-7B-Instruct
VLLM_CHAT_API_KEY=
VLLM_RETURN_THINKING=true
```

`vllm` 在当前代码里表示“OpenAI-compatible provider”，不要求一定是 vLLM，也可以接入兼容接口的云端服务。

### 5. 配置后端

应用启动时会自动读取根目录 `.env`。推荐以 `.env.example` 为模板创建自己的 `.env`，常用配置如下：

```dotenv
LLM_CHAT_PROVIDER=vllm
LLM_EMBEDDING_PROVIDER=vllm

MYSQL_URL=jdbc:mysql://localhost:3306/knowledge_rag?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=utf8
MYSQL_USERNAME=root
MYSQL_PASSWORD=123456
SPRING_JPA_HIBERNATE_DDL_AUTO=update

AUTH_BOOTSTRAP_ADMIN_USERNAME=admin
AUTH_BOOTSTRAP_ADMIN_PASSWORD=ChangeMe123!

QDRANT_HOST=localhost
QDRANT_PORT=6334
QDRANT_HTTP_PORT=6333
QDRANT_COLLECTION_NAME=knowledge-base
QDRANT_VECTOR_SIZE=768
RAG_EMBEDDING_REQUEST_BATCH_SIZE=10
```

说明：

- `spring.jpa.hibernate.ddl-auto=update` 会在启动时自动创建或更新 `user_accounts`、`registration_codes` 等关系表
- 第一次启动时如果系统里还没有管理员账号，会自动创建 `AUTH_BOOTSTRAP_ADMIN_USERNAME` / `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- 建议首次登录后立即修改默认管理员密码对应的环境变量并重启服务
- 如果 embedding provider 是带输入条数上限的 OpenAI-compatible 接口，保留默认的 `RAG_EMBEDDING_REQUEST_BATCH_SIZE=10` 即可

### 6. 启动后端

```bash
./mvnw spring-boot:run
```

默认地址：`http://localhost:8080`

### 7. 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

默认地址：`http://localhost:5173`

本地开发时，Vite 会把 `/api` 代理到 `http://localhost:8080`。

如需本地生产构建验证：

```bash
cd frontend
pnpm build
# 产物输出到 frontend/dist，可用 npx serve 或 Nginx 托管预览
```

### 8. 初始使用流程

1. 使用 `.env` 中的管理员账号登录文档控制台。
2. 管理员在侧边栏创建注册码，可选设置备注和有效期。
3. 新用户使用注册码注册并自动登录。
4. 登录后即可上传、查看和删除知识库文档。
5. RAG 问答接口和聊天界面无需登录。

## API 概览

完整接口规范见 [docs/openapi.yaml](docs/openapi.yaml)。

### 鉴权接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录并建立 Session |
| `POST` | `/api/auth/register` | 使用一次性注册码注册并自动登录 |
| `POST` | `/api/auth/logout` | 退出登录 |
| `GET` | `/api/auth/me` | 查看当前登录状态 |
| `GET` | `/api/auth/registration-codes` | 管理员查看注册码列表 |
| `POST` | `/api/auth/registration-codes` | 管理员创建注册码 |
| `PATCH` | `/api/auth/registration-codes/{id}/disable` | 管理员禁用注册码 |
| `DELETE` | `/api/auth/registration-codes/{id}` | 管理员删除注册码 |

### 文档接口

除 `/api/documents/health` 外，以下接口均要求已登录：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/documents/upload` | 上传并处理 `PDF/TXT` 文档 |
| `GET` | `/api/documents` | 列出当前 Qdrant collection 中的文档 |
| `DELETE` | `/api/documents/{documentId}` | 删除指定文档对应的全部向量片段 |
| `GET` | `/api/documents/health` | 文档服务健康检查 |

### RAG 接口

以下接口不需要登录：

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/rag/ask` | 同步返回答案和来源片段 |
| `POST` | `/api/rag/ask/stream` | SSE 流式返回答案 |
| `POST` | `/api/rag/conversations/{conversationId}/cancel` | 取消进行中的流式生成 |
| `DELETE` | `/api/rag/conversations/{conversationId}` | 清空会话上下文 |
| `GET` | `/api/rag/health` | RAG 服务健康检查 |
| `POST` | `/api/rag/health` | RAG 服务健康检查（POST，可用于验证请求体转发） |

### SSE 事件

`/api/rag/ask/stream` 可能输出以下事件：

- `start`
- `sources`
- `thinking_delta`
- `thinking_end`
- `delta`
- `complete`
- `cancelled`
- `error`

## 配置说明

当前有效配置位于 [src/main/resources/application.yaml](src/main/resources/application.yaml)。

### MySQL / JPA 配置

```yaml
spring:
  datasource:
    url: ${MYSQL_URL:jdbc:mysql://localhost:3306/knowledge_rag?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai&characterEncoding=utf8}
    username: ${MYSQL_USERNAME:root}
    password: ${MYSQL_PASSWORD:}
  jpa:
    hibernate:
      ddl-auto: ${SPRING_JPA_HIBERNATE_DDL_AUTO:update}
```

说明：

- 用户和注册码数据存储在 MySQL
- `ddl-auto=update` 会自动建表和更新表结构
- Docker 单镜像启动时，`MYSQL_URL` 会由容器启动脚本自动指向容器内 MySQL
- 测试环境使用 `src/test/resources/application.yaml` 切换到 H2 内存数据库

### 鉴权配置

```yaml
auth:
  bootstrap-admin:
    username: ${AUTH_BOOTSTRAP_ADMIN_USERNAME:admin}
    password: ${AUTH_BOOTSTRAP_ADMIN_PASSWORD:ChangeMe123!}
```

说明：

- 启动时若数据库内还没有管理员账号，会自动创建一个管理员
- 注册码为一次性使用；使用后变为 `USED`
- 管理员可将未使用注册码手动置为 `DISABLED`，也可直接删除
- 到达 `expiresAt` 后注册码会视为 `EXPIRED`

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
  chunk-dedup-enabled: ${RAG_CHUNK_DEDUP_ENABLED:true}
```

说明：

- `chunk-dedup-enabled` 控制跨轮次检索片段去重，默认开启

## 数据与存储

当前实现有三类数据存储：

- MySQL：保存 `user_accounts`、`registration_codes`
- Qdrant：保存文档向量和文档 metadata
- 内存 `ConcurrentHashMap`：保存 RAG 会话上下文

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

- 登录 / 登出
- 使用注册码注册
- 管理员创建、禁用、删除注册码
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
- [docs/Docker-Deployment.md](docs/Docker-Deployment.md)：Docker 单镜像部署说明
- [docs/Mixed-Model-Architecture-Guide.md](docs/Mixed-Model-Architecture-Guide.md)：provider 配置说明
- [docs/Database-Schema.md](docs/Database-Schema.md)：MySQL、Qdrant 与内存存储结构说明
