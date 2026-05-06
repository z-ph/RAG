# 开发与部署指南

## 开发环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| JDK | 21+ | 必须，项目使用 Java 21 特性 |
| Maven | 3.9+ | 构建工具 |
| Docker | 20+ | 运行 MySQL 和 Qdrant |
| Docker Compose | 2.0+ | 容器编排 |
| Git | 2.x | 版本控制 |

**可选：**
- GPU + CUDA（如需本地运行 vLLM）
- IDE：IntelliJ IDEA（推荐）或 VS Code

---

## 快速启动

### 1. 克隆项目

```bash
git clone <repository-url>
cd RAG
```

### 2. 配置环境变量

复制 `.env.example`（如有）或创建 `.env` 文件：

```env
# MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=knowledge_rag
MYSQL_USERNAME=root
MYSQL_PASSWORD=your_password

# Qdrant
QDRANT_HOST=localhost
QDRANT_PORT=6334
QDRANT_COLLECTION_NAME=knowledge_rag

# LLM 服务（vLLM）
LLM_BASE_URL=http://localhost:8000/v1
LLM_API_KEY=your_api_key
LLM_MODEL_NAME=Qwen2.5-7B-Instruct

# 嵌入模型
EMBEDDING_BASE_URL=http://localhost:8001/v1
EMBEDDING_API_KEY=your_api_key
EMBEDDING_MODEL_NAME=bge-base-zh-v1.5

# JWT
JWT_SECRET=your_jwt_secret_key_at_least_32_characters
JWT_ACCESS_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# 文件存储
RAG_FILE_STORAGE_PATH=./data/files
RAG_IMAGE_STORAGE_PATH=./data/images
```

### 3. 启动依赖服务

```bash
docker compose up -d mysql qdrant
```

等待 MySQL 和 Qdrant 完全启动（约 30 秒）。

### 4. 启动 LLM 服务（如需本地运行）

```bash
# 聊天模型
vllm serve Qwen2.5-7B-Instruct --port 8000

# 嵌入模型
vllm serve bge-base-zh-v1.5 --port 8001
```

也可使用远程 LLM API（如 OpenAI 兼容服务）。

### 5. 构建并启动应用

```bash
mvn clean package -DskipTests
java -jar target/knowledge-rag.jar
```

或开发模式：

```bash
mvn spring-boot:run
```

应用启动后访问 `http://localhost:8080/rag/health` 验证。

---

## 配置说明

### application.yaml 关键配置

#### RAG 管道配置

```yaml
rag:
  max-results: 5                    # 默认检索结果数
  stream-timeout-ms: 300000         # 流式超时（5分钟）
  chunk-size: 320                   # 目标分块大小（字符）
  chunk-min-size: 250               # 最小分块大小
  chunk-max-size: 350               # 最大分块大小
  chunk-overlap: 40                 # 分块重叠字符数
  min-text-length: 80               # 最短有效文本
  keyword-count: 6                  # 每块关键词数
  image-to-llm-enabled: true        # 图片注入LLM
  image-max-per-request: 5          # 单次最大图片数
  memory-window: 6                  # 对话记忆窗口
  session-ttl-seconds: 1800         # 会话超时（30分钟）
  memory-cleanup-interval-ms: 300000 # 清理间隔（5分钟）
```

#### 混合检索配置

```yaml
rag:
  rerank:
    candidate-multiplier: 4         # 候选倍数（检索4倍再重排取top N）
    vector-weight: 0.6              # 向量分数权重
    bm25-weight: 0.4                # BM25分数权重
  chunk-dedup-enabled: true         # 启用分块去重
```

#### 嵌入服务配置

```yaml
rag:
  embedding-request:
    batch-size: 10                  # 嵌入请求批次大小
  embedding-store:
    batch-size: 32                  # Qdrant写入批次大小
    max-retries: 3                  # 最大重试次数
    retry-backoff-ms: 1000          # 重试退避基数（毫秒）
```

#### 文件存储配置

```yaml
rag:
  file-storage-path: ./data/files   # 原始文件存储路径
  image-storage-path: ./data/images # 图片存储路径
```

---

## 环境变量参考

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `MYSQL_HOST` | 是 | localhost | MySQL 主机 |
| `MYSQL_PORT` | 否 | 3306 | MySQL 端口 |
| `MYSQL_DATABASE` | 否 | knowledge_rag | 数据库名 |
| `MYSQL_USERNAME` | 是 | - | 数据库用户名 |
| `MYSQL_PASSWORD` | 是 | - | 数据库密码 |
| `QDRANT_HOST` | 是 | localhost | Qdrant 主机 |
| `QDRANT_PORT` | 否 | 6334 | Qdrant gRPC 端口 |
| `QDRANT_COLLECTION_NAME` | 否 | knowledge_rag | 集合名称 |
| `LLM_BASE_URL` | 是 | - | LLM API 基础 URL |
| `LLM_API_KEY` | 否 | - | LLM API Key |
| `LLM_MODEL_NAME` | 是 | - | LLM 模型名称 |
| `EMBEDDING_BASE_URL` | 是 | - | 嵌入模型 API URL |
| `EMBEDDING_API_KEY` | 否 | - | 嵌入模型 API Key |
| `EMBEDDING_MODEL_NAME` | 是 | - | 嵌入模型名称 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥（至少32字符） |
| `JWT_ACCESS_EXPIRATION` | 否 | 86400000 | Access Token 有效期（毫秒，默认24小时） |
| `JWT_REFRESH_EXPIRATION` | 否 | 604800000 | Refresh Token 有效期（毫秒，默认7天） |

---

## Docker 部署

### 全量部署（含应用）

```bash
docker compose up -d
```

`docker-compose.yml` 包含三个服务：
1. **app** — Spring Boot 应用（多阶段 Docker 构建：Maven 编译 → JRE 运行）
2. **mysql** — MySQL 8.x 数据库
3. **qdrant** — Qdrant 向量数据库

### 仅依赖服务

```bash
docker compose up -d mysql qdrant
```

### 网络配置

所有服务在同一 Docker 网络内，服务名即主机名：
- `app` 连接 MySQL: `mysql:3306`
- `app` 连接 Qdrant: `qdrant:6334`
- vLLM 通常在 Docker 外部运行，需通过宿主 IP 访问

---

## 数据库初始化

- **Hibernate DDL**: `spring.jpa.hibernate.ddl-auto=update`，自动创建/更新表结构
- **管理员引导**: `AuthBootstrapInitializer` 启动时自动创建管理员账号
- **RBAC 引导**: `RbacBootstrapInitializer` 启动时自动创建角色、权限和关联

**无需手动执行 SQL 脚本。**

---

## 向量数据库初始化

`QdrantInitializer` 在应用启动时自动检查并创建 Qdrant 集合：
- 集合名：由 `QDRANT_COLLECTION_NAME` 配置
- 向量维度：768（对应 bge-base-zh-v1.5 模型）
- 距离度量：Cosine

---

## 常见问题排查

### 应用启动失败

| 症状 | 原因 | 解决 |
|------|------|------|
| `Connection refused: mysql:3306` | MySQL 未启动 | `docker compose up -d mysql` |
| `Connection refused: qdrant:6334` | Qdrant 未启动 | `docker compose up -d qdrant` |
| `Collection not found` | Qdrant 集合未创建 | 重启应用（自动创建） |
| `JWT secret too short` | JWT 密钥不足32字符 | 更新 `JWT_SECRET` |

### LLM 连接问题

| 症状 | 原因 | 解决 |
|------|------|------|
| 向量化超时 | vLLM 未启动或 GPU 内存不足 | 检查 vLLM 服务状态 |
| 生成结果为空 | 模型加载失败 | 检查模型路径和 GPU 状态 |
| 响应慢 | GPU 内存不足或模型过大 | 减小 `maxResults` 或使用更小的模型 |

### 端口冲突

默认端口：8080（应用）、3306（MySQL）、6333/6334（Qdrant）

修改 `.env` 或 `docker-compose.yml` 中的端口映射。

---

## 开发调试技巧

### 日志级别

在 `application.yaml` 中调整：

```yaml
logging:
  level:
    com.mark.knowledge: DEBUG          # 项目代码详细日志
    com.mark.knowledge.rag.service: TRACE  # RAG 管道追踪日志
```

### 热重载

添加 Spring Boot DevTools 依赖后自动启用热重载：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-devtools</artifactId>
    <scope>runtime</scope>
</dependency>
```

### IDE 配置建议

- **IntelliJ IDEA**：安装 Lombok 插件，启用 Annotation Processing
- **VS Code**：安装 Extension Pack for Java + Lombok Annotations Support
