# 单容器改造为多容器架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前单容器架构（Java + MySQL + supervisor）拆分为独立的多容器架构（Java 容器 + MySQL 容器），通过 Docker Compose 编排管理。

**架构：** 
- Java 应用容器：仅包含 JRE 和 Spring Boot 应用，移除 MySQL 和 supervisor
- MySQL 容器：使用官方 MySQL 镜像，独立运行
- Docker Compose：编排两个服务，处理网络连接和依赖关系

**Tech Stack:** Docker, Docker Compose, MySQL 8.0, Spring Boot, Oracle Linux 9

---

## File Structure

| 文件 | 操作 | 说明 |
|------|------|------|
| `Dockerfile` | 大幅修改 | 移除 MySQL 和 supervisor，仅保留 Java 应用 |
| `docker-compose.yml` | 大幅修改 | 添加 mysql 服务，改造 app 服务配置 |
| `docker/supervisord.conf` | 删除 | 不再需要 |
| `docker/wait-for-mysql.sh` | 创建 | 应用启动前等待 MySQL 就绪 |
| `.env` | 可选修改 | 添加 MySQL 相关环境变量 |

---

## Task 1: 创建 wait-for-mysql 脚本

**Files:**
- Create: `docker/wait-for-mysql.sh`
- Test: 构建时验证脚本存在

- [ ] **Step 1: 创建等待脚本**

创建脚本用于在应用启动前等待 MySQL 就绪：

```bash
#!/bin/sh
set -eu

MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USERNAME="${MYSQL_USERNAME:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"

if [ -z "${MYSQL_PASSWORD}" ]; then
  echo "MYSQL_PASSWORD is required" >&2
  exit 1
fi

echo "Waiting for MySQL on ${MYSQL_HOST}:${MYSQL_PORT}..."
attempts=0
max_attempts=60

while ! mysqladmin ping -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USERNAME}" --password="${MYSQL_PASSWORD}" --silent 2>/dev/null; do
  attempts=$((attempts + 1))
  if [ "${attempts}" -ge "${max_attempts}" ]; then
    echo "MySQL did not become ready in time (timeout: ${max_attempts} attempts)" >&2
    exit 1
  fi
  echo "Attempt ${attempts}/${max_attempts}: MySQL not ready yet, waiting 2s..."
  sleep 2
done

echo "MySQL is ready!"
```

- [ ] **Step 2: 设置脚本可执行权限（在本地）**

```bash
git update-index --chmod=+x docker/wait-for-mysql.sh
```

- [ ] **Step 3: 提交**

```bash
git add docker/wait-for-mysql.sh
git commit -m "feat: add wait-for-mysql script for container startup"
```

---

## Task 2: 重写 Dockerfile - 纯 Java 应用

**Files:**
- Modify: `Dockerfile:33-47` 移除 MySQL 和 supervisor 安装
- Modify: `Dockerfile:49-52` 移除 supervisor 配置复制
- Modify: `Dockerfile:54-90` 重写启动脚本逻辑
- Modify: `Dockerfile:92-95` 调整权限设置
- Modify: `Dockerfile:120` 修改 CMD 指令
- Delete: `docker/supervisord.conf`（整个文件）

- [ ] **Step 1: 删除 supervisor 配置文件**

```bash
git rm docker/supervisord.conf
```

- [ ] **Step 2: 重写 Dockerfile 第 33-120 行**

替换原有的 MySQL + supervisor 安装和配置，改为纯 Java 运行环境：

```dockerfile
# Use a smaller base image for runtime
FROM docker.m.daocloud.io/eclipse-temurin:21-jre

# Install mysql-client for wait script
RUN apt-get update && \
    apt-get install -y default-mysql-client && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /workspace/app.jar /app/app.jar
COPY docker/wait-for-mysql.sh /app/scripts/wait-for-mysql.sh

# Create startup script
RUN cat > /app/scripts/start.sh << 'SCRIPT_EOF'
#!/bin/sh
set -eu

# Wait for MySQL first
/app/scripts/wait-for-mysql.sh

# Start application
echo "Starting Spring Boot application..."
exec java ${JAVA_OPTS} -jar /app/app.jar
SCRIPT_EOF

# Make scripts executable and create directories
RUN chmod +x /app/scripts/*.sh && \
    mkdir -p /app/uploads

ENV TZ=Asia/Shanghai \
    JAVA_OPTS="" \
    MYSQL_HOST=mysql \
    MYSQL_PORT=3306 \
    MYSQL_DATABASE=knowledge_rag \
    MYSQL_USERNAME=root \
    MYSQL_PASSWORD="" \
    SPRING_JPA_HIBERNATE_DDL_AUTO=update \
    QDRANT_HOST=qdrant \
    QDRANT_PORT=6334 \
    QDRANT_HTTP_PORT=6333 \
    OLLAMA_CHAT_BASE_URL=http://host.docker.internal:11434 \
    OLLAMA_EMBEDDING_BASE_URL=http://host.docker.internal:11434 \
    VLLM_CHAT_BASE_URL=http://host.docker.internal:8000/v1 \
    VLLM_EMBEDDING_BASE_URL=http://host.docker.internal:8000/v1

VOLUME ["/app/uploads"]

EXPOSE 8080

CMD ["/app/scripts/start.sh"]
```

- [ ] **Step 3: 验证 Dockerfile 语法**

```bash
docker build --target backend-builder -t test-build .
```

Expected: 构建成功，没有语法错误

- [ ] **Step 4: 提交**

```bash
git add Dockerfile
git commit -m "refactor: split mysql from app - pure java container"
```

---

## Task 3: 重写 docker-compose.yml - 多容器编排

**Files:**
- Modify: `docker-compose.yml` 整个文件

- [ ] **Step 1: 添加 mysql 服务并改造 app 服务**

重写整个 docker-compose.yml：

```yaml
services:
  mysql:
    image: docker.m.daocloud.io/mysql:8.0
    restart: unless-stopped
    environment:
      TZ: ${TZ:-Asia/Shanghai}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-ChangeMe123!}
      MYSQL_DATABASE: ${MYSQL_DATABASE:-knowledge_rag}
      MYSQL_USER: ${MYSQL_USER:-knowledge}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:-ChangeMe123!}
    volumes:
      - mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "root", "-p${MYSQL_ROOT_PASSWORD:-ChangeMe123!}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 30s

  app:
    build:
      context: .
    image: knowledge-rag:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      TZ: ${TZ:-Asia/Shanghai}
      JAVA_OPTS: ${JAVA_OPTS:-}
      # MySQL connection - use service name
      MYSQL_HOST: mysql
      MYSQL_PORT: 3306
      MYSQL_DATABASE: ${MYSQL_DATABASE:-knowledge_rag}
      MYSQL_USERNAME: root
      MYSQL_PASSWORD: ${MYSQL_ROOT_PASSWORD:-ChangeMe123!}
      # Auth bootstrap
      AUTH_BOOTSTRAP_ADMIN_USERNAME: ${AUTH_BOOTSTRAP_ADMIN_USERNAME:-admin}
      AUTH_BOOTSTRAP_ADMIN_PASSWORD: ${AUTH_BOOTSTRAP_ADMIN_PASSWORD:-ChangeMe123!}
      # LLM configuration
      LLM_CHAT_PROVIDER: ${LLM_CHAT_PROVIDER:-ollama}
      LLM_EMBEDDING_PROVIDER: ${LLM_EMBEDDING_PROVIDER:-ollama}
      LLM_TIMEOUT: ${LLM_TIMEOUT:-120s}
      OLLAMA_CHAT_BASE_URL: ${OLLAMA_CHAT_BASE_URL:-http://host.docker.internal:11434}
      OLLAMA_EMBEDDING_BASE_URL: ${OLLAMA_EMBEDDING_BASE_URL:-http://host.docker.internal:11434}
      OLLAMA_CHAT_MODEL: ${OLLAMA_CHAT_MODEL:-qwen2.5:7b}
      OLLAMA_EMBEDDING_MODEL: ${OLLAMA_EMBEDDING_MODEL:-bge-base-zh}
      OLLAMA_THINK: ${OLLAMA_THINK:-false}
      VLLM_CHAT_BASE_URL: ${VLLM_CHAT_BASE_URL:-http://host.docker.internal:8000/v1}
      VLLM_EMBEDDING_BASE_URL: ${VLLM_EMBEDDING_BASE_URL:-http://host.docker.internal:8000/v1}
      VLLM_CHAT_MODEL: ${VLLM_CHAT_MODEL:-Qwen/Qwen2.5-7B-Instruct}
      VLLM_EMBEDDING_MODEL: ${VLLM_EMBEDDING_MODEL:-BAAI/bge-base-zh-v1.5}
      VLLM_CHAT_API_KEY: ${VLLM_CHAT_API_KEY:-}
      VLLM_EMBEDDING_API_KEY: ${VLLM_EMBEDDING_API_KEY:-}
      VLLM_RETURN_THINKING: ${VLLM_RETURN_THINKING:-true}
      # File upload
      SPRING_MULTIPART_MAX_FILE_SIZE: ${SPRING_MULTIPART_MAX_FILE_SIZE:-50MB}
      SPRING_MULTIPART_MAX_REQUEST_SIZE: ${SPRING_MULTIPART_MAX_REQUEST_SIZE:-50MB}
      # Qdrant
      QDRANT_HOST: qdrant
      QDRANT_PORT: 6334
      QDRANT_HTTP_PORT: 6333
      QDRANT_COLLECTION_NAME: ${QDRANT_COLLECTION_NAME:-knowledge-base}
      QDRANT_VECTOR_SIZE: ${QDRANT_VECTOR_SIZE:-768}
      QDRANT_CREATE_COLLECTION_IF_NOT_EXISTS: ${QDRANT_CREATE_COLLECTION_IF_NOT_EXISTS:-true}
      # RAG settings
      RAG_CHUNK_SIZE: ${RAG_CHUNK_SIZE:-320}
      RAG_CHUNK_MIN_SIZE: ${RAG_CHUNK_MIN_SIZE:-250}
      RAG_CHUNK_MAX_SIZE: ${RAG_CHUNK_MAX_SIZE:-350}
      RAG_CHUNK_OVERLAP: ${RAG_CHUNK_OVERLAP:-40}
      RAG_EMBEDDING_REQUEST_BATCH_SIZE: ${RAG_EMBEDDING_REQUEST_BATCH_SIZE:-10}
      RAG_EMBEDDING_STORE_BATCH_SIZE: ${RAG_EMBEDDING_STORE_BATCH_SIZE:-32}
      RAG_EMBEDDING_STORE_MAX_RETRIES: ${RAG_EMBEDDING_STORE_MAX_RETRIES:-3}
      RAG_EMBEDDING_STORE_RETRY_BACKOFF_MS: ${RAG_EMBEDDING_STORE_RETRY_BACKOFF_MS:-1000}
      RAG_MIN_TEXT_LENGTH: ${RAG_MIN_TEXT_LENGTH:-80}
      RAG_KEYWORD_COUNT: ${RAG_KEYWORD_COUNT:-6}
      RAG_MAX_RESULTS: ${RAG_MAX_RESULTS:-5}
      RAG_MIN_SCORE: ${RAG_MIN_SCORE:-0.5}
      RAG_MEMORY_WINDOW: ${RAG_MEMORY_WINDOW:-6}
      RAG_SESSION_TTL_SECONDS: ${RAG_SESSION_TTL_SECONDS:-1800}
      RAG_MEMORY_CLEANUP_INTERVAL_MS: ${RAG_MEMORY_CLEANUP_INTERVAL_MS:-300000}
      RAG_STREAM_TIMEOUT_MS: ${RAG_STREAM_TIMEOUT_MS:-300000}
      # Logging
      LOG_LEVEL_ROOT: ${LOG_LEVEL_ROOT:-INFO}
      LOG_LEVEL_APP: ${LOG_LEVEL_APP:-DEBUG}
      LOG_LEVEL_LANGCHAIN4J: ${LOG_LEVEL_LANGCHAIN4J:-DEBUG}
    volumes:
      - app-uploads:/app/uploads
    depends_on:
      mysql:
        condition: service_healthy
      qdrant:
        condition: service_started
    extra_hosts:
      - "host.docker.internal:host-gateway"

  qdrant:
    image: docker.m.daocloud.io/qdrant/qdrant:latest
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant-data:/qdrant/storage

volumes:
  mysql-data:
  app-uploads:
  qdrant-data:
```

- [ ] **Step 2: 验证 compose 文件语法**

```bash
docker compose config
```

Expected: 输出有效的配置，无语法错误

- [ ] **Step 3: 提交**

```bash
git add docker-compose.yml
git commit -m "refactor: add mysql service to docker-compose, split containers"
```

---

## Task 4: 完整测试构建

**Files:**
- Test: 完整 Docker Compose 构建

- [ ] **Step 1: 构建镜像**

```bash
docker compose build --no-cache
```

Expected: 构建成功，mysql 和 app 镜像都正常

- [ ] **Step 2: 启动服务（后台）**

```bash
docker compose up -d mysql
sleep 10
docker compose ps
```

Expected: mysql 服务状态为 `healthy`

- [ ] **Step 3: 启动完整服务栈**

```bash
docker compose up -d
sleep 30
docker compose ps
```

Expected: 
- mysql: healthy
- app: running
- qdrant: running

- [ ] **Step 4: 验证应用可访问**

```bash
curl -s http://localhost:8080/actuator/health 2>/dev/null || echo "Health check endpoint not available, check logs:"
docker compose logs app --tail=20
```

Expected: 应用日志显示成功启动，或者看到健康检查响应

- [ ] **Step 5: 验证 MySQL 数据持久化**

```bash
docker compose exec mysql mysql -uroot -pChangeMe123! -e "SHOW DATABASES;"
```

Expected: 看到 `knowledge_rag` 数据库

- [ ] **Step 6: 停止服务**

```bash
docker compose down
```

- [ ] **Step 7: 提交完成标记**

```bash
git commit --allow-empty -m "test: multi-container architecture verified"
```

---

## Spec Coverage Check

| 需求 | 对应任务 |
|------|---------|
| MySQL 独立为单独容器 | Task 3 |
| Java 应用容器移除 MySQL | Task 2 |
| 应用启动前等待 MySQL 就绪 | Task 1 + Task 2 |
| 使用 Docker Compose 编排 | Task 3 |
| 数据持久化 | Task 3 (volumes) |
| 删除 supervisor | Task 2 |

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-04-01-multi-container-refactor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

**Which approach?**
