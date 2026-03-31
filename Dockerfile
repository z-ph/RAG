FROM node:20-alpine AS frontend-builder
WORKDIR /workspace/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /workspace

COPY pom.xml ./
COPY src ./src
COPY --from=frontend-builder /workspace/frontend/dist ./src/main/resources/static
RUN mvn -B -DskipTests package && \
    find target -maxdepth 1 -type f -name '*.jar' ! -name '*.jar.original' -exec cp {} /workspace/app.jar \;

FROM mysql:8.4

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN if command -v microdnf >/dev/null 2>&1; then \
        microdnf install -y java-21-openjdk-headless supervisor procps-ng && \
        microdnf clean all; \
    elif command -v apt-get >/dev/null 2>&1; then \
        apt-get update && \
        apt-get install -y --no-install-recommends openjdk-21-jre-headless supervisor procps && \
        rm -rf /var/lib/apt/lists/*; \
    else \
        echo "No supported package manager found in runtime image" >&2; \
        exit 1; \
    fi

WORKDIR /app

COPY --from=backend-builder /workspace/app.jar /app/app.jar
COPY docker/run-app.sh /app/scripts/run-app.sh
COPY docker/supervisord.conf /etc/supervisord.conf

RUN chmod +x /app/scripts/run-app.sh && \
    mkdir -p /app/uploads

ENV TZ=Asia/Shanghai \
    JAVA_OPTS="" \
    MYSQL_DATABASE=knowledge_rag \
    MYSQL_USER=knowledge \
    MYSQL_PASSWORD=ChangeMe123! \
    MYSQL_ROOT_PASSWORD=ChangeMe123! \
    MYSQL_ROOT_HOST=% \
    MYSQL_HOST=127.0.0.1 \
    MYSQL_PORT=3306 \
    SPRING_JPA_HIBERNATE_DDL_AUTO=update \
    QDRANT_HOST=host.docker.internal \
    QDRANT_PORT=6334 \
    QDRANT_HTTP_PORT=6333 \
    OLLAMA_CHAT_BASE_URL=http://host.docker.internal:11434 \
    OLLAMA_EMBEDDING_BASE_URL=http://host.docker.internal:11434 \
    VLLM_CHAT_BASE_URL=http://host.docker.internal:8000/v1 \
    VLLM_EMBEDDING_BASE_URL=http://host.docker.internal:8000/v1

VOLUME ["/var/lib/mysql"]

EXPOSE 8080 3306

CMD ["supervisord", "-c", "/etc/supervisord.conf"]
