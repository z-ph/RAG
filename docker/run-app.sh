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
