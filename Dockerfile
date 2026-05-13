# syntax=docker.m.daocloud.io/docker/dockerfile:1

# 阶段1：前端构建（产物最终存放在 /app/dist，可通过 volume 挂载导出）
FROM docker.1ms.run/node:22-alpine AS frontend-builder
WORKDIR /workspace/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    corepack enable && pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

# 阶段2：后端构建
FROM docker.m.daocloud.io/maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src

# 使用 BuildKit cache mount 持久化 .m2 仓库，依赖变更时只下载增量
RUN --mount=type=cache,target=/root/.m2/repository \
    mvn -B -DskipTests package && \
    find target -maxdepth 1 -type f -name '*.jar' ! -name '*.jar.original' -exec cp {} /workspace/app.jar \;

# 阶段4：最终运行镜像（仅运行 Spring Boot，不托管前端静态资源）
FROM docker.m.daocloud.io/eclipse-temurin:21-jre

# Install mysql-client for wait script and tesseract-ocr for PDF OCR
RUN apt-get update && \
    apt-get install -y \
        default-mysql-client \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-chi-sim \
        tesseract-ocr-osd && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

WORKDIR /app

# Create directories
RUN mkdir -p /app/scripts /app/dist

COPY --from=backend-builder /workspace/app.jar /app/app.jar
COPY --from=frontend-builder /workspace/frontend/dist /app/dist
COPY docker/wait-for-mysql.sh /app/scripts/wait-for-mysql.sh
COPY docker/start.sh /app/scripts/start.sh

# Make scripts executable
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
    VLLM_CHAT_BASE_URL=http://host.docker.internal:8000/v1 \
    VLLM_EMBEDDING_BASE_URL=http://host.docker.internal:8000/v1

VOLUME ["/app/uploads"]

EXPOSE 8081

CMD ["/app/scripts/start.sh"]
