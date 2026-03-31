# Docker 单镜像部署

当前仓库的 Docker 方案包含两层：

- 应用镜像：集成 `frontend + Spring Boot + MySQL`
- 外部依赖：`Qdrant`

前端不会再单独起一个 Nginx 或 Vite 服务，构建产物会直接复制到 Spring Boot 的 `static/` 目录，由后端同源托管。

## 推荐方式

直接在仓库根目录执行：

```bash
docker compose up --build -d
```

默认会启动：

- `app`：集成前端、后端、MySQL 的单镜像容器
- `qdrant`：向量数据库容器

默认访问地址：

- 应用首页：`http://localhost:8080`
- Qdrant HTTP：`http://localhost:6333`
- Qdrant gRPC：`localhost:6334`

## 镜像构建

如果你只想先构建镜像：

```bash
docker build -t knowledge-rag .
```

构建阶段会执行以下流程：

1. 在 `frontend/` 中执行 `pnpm install` 与 `pnpm build`
2. 将前端 `dist/` 复制到后端 `src/main/resources/static`
3. 执行 Maven 打包
4. 在运行层启动 `mysqld` 和 Spring Boot

## 单独运行镜像

如果你已经有外部 Qdrant，也可以直接运行镜像：

```bash
docker run -d \
  --name knowledge-rag \
  -p 8080:8080 \
  --add-host=host.docker.internal:host-gateway \
  -e QDRANT_HOST=host.docker.internal \
  -e QDRANT_PORT=6334 \
  -e QDRANT_HTTP_PORT=6333 \
  knowledge-rag
```

说明：

- 镜像内的 MySQL 默认监听容器内 `3306`
- Spring Boot 会自动把 `MYSQL_URL` 指向容器内 MySQL
- 如果模型服务跑在宿主机，默认可通过 `host.docker.internal` 访问
- Windows 和 macOS 的 Docker Desktop 一般已内置 `host.docker.internal`
- Linux 如不使用 compose，请保留 `--add-host=host.docker.internal:host-gateway`

## 常用环境变量

- `MYSQL_DATABASE`：容器内 MySQL 数据库名，默认 `knowledge_rag`
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

如果你删除容器但保留 volume，数据会继续保留。
