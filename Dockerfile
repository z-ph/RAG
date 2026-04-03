# Dockerfile without BuildKit syntax directive for compatibility in China

FROM docker.1ms.run/node:20-alpine AS frontend-builder
WORKDIR /workspace/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

# 使用单独的依赖下载阶段，利用 Docker 层缓存
FROM docker.m.daocloud.io/maven:3.9.9-eclipse-temurin-21 AS deps-downloader
WORKDIR /workspace
COPY pom.xml ./
# 预下载所有依赖（包括插件），不编译代码
RUN mvn dependency:go-offline -B && \
    mvn dependency:resolve-plugins -B

FROM docker.m.daocloud.io/maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /workspace

# 从 deps-downloader 阶段复制已下载的依赖（利用层缓存）
COPY --from=deps-downloader /root/.m2 /root/.m2
COPY pom.xml ./
COPY src ./src
COPY --from=frontend-builder /workspace/frontend/dist ./src/main/resources/static

# 编译时依赖已存在，无需重新下载
RUN mvn -B -DskipTests package && \
    find target -maxdepth 1 -type f -name '*.jar' ! -name '*.jar.original' -exec cp {} /workspace/app.jar \;

# Use a smaller base image for runtime
FROM docker.m.daocloud.io/eclipse-temurin:21-jre

# Install mysql-client for wait script
RUN apt-get update && \
    apt-get install -y default-mysql-client && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create scripts directory first
RUN mkdir -p /app/scripts

COPY --from=backend-builder /workspace/app.jar /app/app.jar
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
    OLLAMA_CHAT_BASE_URL=http://host.docker.internal:11434 \
    OLLAMA_EMBEDDING_BASE_URL=http://host.docker.internal:11434 \
    VLLM_CHAT_BASE_URL=http://host.docker.internal:8000/v1 \
    VLLM_EMBEDDING_BASE_URL=http://host.docker.internal:8000/v1

VOLUME ["/app/uploads"]

EXPOSE 8080

CMD ["/app/scripts/start.sh"]
