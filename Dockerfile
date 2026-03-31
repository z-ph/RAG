FROM docker.1ms.run/node:20-alpine AS frontend-builder
WORKDIR /workspace/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build

FROM docker.1ms.run/maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /workspace

COPY pom.xml ./
COPY src ./src
COPY --from=frontend-builder /workspace/frontend/dist ./src/main/resources/static
RUN mvn -B -DskipTests package && \
    find target -maxdepth 1 -type f -name '*.jar' ! -name '*.jar.original' -exec cp {} /workspace/app.jar \;

# Use MySQL image as base (Oracle Linux based)
FROM docker.1ms.run/mysql

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install Java and supervisor using microdnf
RUN microdnf install -y epel-release && \
    microdnf install -y \
        java-21-openjdk-headless \
        python3 \
        python3-pip \
        procps-ng \
        procps && \
    pip3 install supervisor && \
    microdnf clean all

WORKDIR /app

COPY --from=backend-builder /workspace/app.jar /app/app.jar
COPY docker/supervisord.conf /etc/supervisord.conf

# Create run-app.sh directly in container
RUN mkdir -p /app/scripts && cat > /app/scripts/run-app.sh << 'SCRIPT_EOF'
#!/bin/sh
set -eu

MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_DATABASE="${MYSQL_DATABASE:-knowledge_rag}"
MYSQL_USERNAME="${MYSQL_USERNAME:-${MYSQL_USER:-root}}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-${MYSQL_ROOT_PASSWORD:-}}"

if [ -z "${MYSQL_PASSWORD}" ]; then
  echo "MYSQL_PASSWORD or MYSQL_ROOT_PASSWORD is required" >&2
  exit 1
fi

export MYSQL_USERNAME
export MYSQL_PASSWORD

if [ -z "${MYSQL_URL:-}" ]; then
  export MYSQL_URL="jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=${TZ:-Asia/Shanghai}&characterEncoding=utf8"
fi

echo "Waiting for MySQL on ${MYSQL_HOST}:${MYSQL_PORT}..."
attempts=0
until mysqladmin ping -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USERNAME}" --password="${MYSQL_PASSWORD}" --silent >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "${attempts}" -ge 60 ]; then
    echo "MySQL did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

echo "MySQL is ready, starting Spring Boot..."
exec java ${JAVA_OPTS} -jar /app/app.jar
SCRIPT_EOF

# Make script executable and create other directories
RUN chmod +x /app/scripts/run-app.sh && \
    mkdir -p /app/uploads /var/lib/mysql /var/run/mysqld && \
    chown -R mysql:mysql /var/lib/mysql /var/run/mysqld

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
