# Docker 部署

当前仓库采用**前后端分离**的 Docker 部署方案：

- **后端**：Spring Boot 独立镜像，仅提供 API，不再托管前端静态资源
- **前端**：由根目录 `Dockerfile` 统一多阶段构建，产物存放在镜像 `/app/dist` 目录，可通过 volume 挂载导出到宿主机
- **外部依赖**：`MySQL` + `Qdrant` 由 `docker-compose.yml` 统一管理

## 快速启动

### 1. 启动后端及依赖

在仓库根目录执行：

```bash
docker compose up --build -d
```

默认会启动 `mysql`、`app`（Spring Boot）、`qdrant` 三个服务。

访问地址：

- 后端 API：`http://localhost:8081`
- Qdrant HTTP：`http://localhost:6333`
- Qdrant gRPC：`localhost:6334`

### 2. 导出前端产物

根目录的 `Dockerfile` 已包含前端构建阶段，镜像内产物位于 `/app/dist`。通过以下方式导出到宿主机：

**使用脚本（推荐）：**

```bash
./scripts/export-frontend.sh
```

**或手动执行：**

```bash
docker run --rm -v "$(pwd)/dist:/output/dist" knowledge-rag sh -c \
  "mkdir -p /output/dist && cp -r /app/dist/* /output/dist/"
```

产物位于 `./dist`，可用任意静态服务器部署：

```bash
# 方式一：本地快速预览
cd dist && npx serve .

# 方式二：Nginx（推荐生产环境）
# 将 dist/ 目录配置为 Nginx 的 root，并代理 /api 到后端即可
```

## 镜像构建

### 构建统一镜像

```bash
docker build -t knowledge-rag .
```

构建阶段说明：

1. `frontend-builder`：基于 `node:20-alpine`，在 `frontend/` 中执行 `pnpm install` 与 `pnpm build`
2. `deps-downloader`：基于 `maven:3.9.9-eclipse-temurin-21`，预下载 Maven 依赖
3. `backend-builder`：基于 `maven:3.9.9-eclipse-temurin-21`，编译 Spring Boot 项目
4. 最终运行阶段：基于 `eclipse-temurin:21-jre`，复制后端 jar 与前端产物，默认启动 Spring Boot

### 导出前端产物

```bash
# 使用脚本（推荐）
./scripts/export-frontend.sh

# 或手动执行
docker run --rm -v "$(pwd)/dist:/output/dist" knowledge-rag sh -c \
  "mkdir -p /output/dist && cp -r /app/dist/* /output/dist/"
```

## 单独运行后端镜像

如果已有外部 MySQL 和 Qdrant，可直接运行后端镜像：

```bash
docker run -d \
  --name knowledge-rag \
  -p 8081:8080 \
  --add-host=host.docker.internal:host-gateway \
  -e MYSQL_URL=jdbc:mysql://host.docker.internal:3306/knowledge_rag?useSSL=false&allowPublicKeyRetrieval=true \
  -e MYSQL_USERNAME=root \
  -e MYSQL_PASSWORD=your_password \
  -e QDRANT_HOST=host.docker.internal \
  -e QDRANT_PORT=6334 \
  -e QDRANT_HTTP_PORT=6333 \
  knowledge-rag
```

说明：

- 如果模型服务跑在宿主机，默认可通过 `host.docker.internal` 访问
- Windows 和 macOS 的 Docker Desktop 一般已内置 `host.docker.internal`
- Linux 如不使用 compose，请保留 `--add-host=host.docker.internal:host-gateway`

## 前端独立部署说明

前端构建前请确保环境变量指向正确的后端地址。生产环境需要在 `frontend/.env.production` 中配置：

```dotenv
VITE_API_BASE_URL=http://your-backend-domain:8081/api
```

本地开发时继续使用 `frontend/.env`（默认代理到 `http://localhost:8080`）。

## 常用环境变量

- `MYSQL_DATABASE`：MySQL 数据库名，默认 `knowledge_rag`
- `MYSQL_USER`：应用连接 MySQL 的账号，默认 `knowledge`
- `MYSQL_PASSWORD`：应用连接 MySQL 的密码
- `MYSQL_ROOT_PASSWORD`：MySQL root 密码
- `AUTH_BOOTSTRAP_ADMIN_USERNAME`：初始化管理员用户名
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`：初始化管理员密码
- `LLM_CHAT_PROVIDER`：聊天模型 provider，默认 `ollama`
- `LLM_EMBEDDING_PROVIDER`：向量模型 provider，默认 `ollama`
- `OLLAMA_CHAT_BASE_URL` / `OLLAMA_EMBEDDING_BASE_URL`：默认指向 `http://host.docker.internal:11434`
- `VLLM_CHAT_BASE_URL` / `VLLM_EMBEDDING_BASE_URL`：默认指向 `http://host.docker.internal:8000/v1`

## 数据持久化

- `docker-compose.yml` 默认把 MySQL 数据挂载到 `mysql-data`
- `docker-compose.yml` 默认把 Qdrant 数据挂载到 `qdrant-data`
- 上传文件通过 `app-uploads` volume 持久化

如果你删除容器但保留 volume，数据会继续保留。
