#!/bin/sh
set -eu

MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USERNAME="${MYSQL_USERNAME:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-knowledge_rag}"

if [ -z "${MYSQL_PASSWORD}" ]; then
  echo "MYSQL_PASSWORD is required" >&2
  exit 1
fi

echo "Waiting for MySQL on ${MYSQL_HOST}:${MYSQL_PORT}..."
attempts=0
max_attempts=60

# First wait for mysqladmin ping
while ! mysqladmin ping -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USERNAME}" --password="${MYSQL_PASSWORD}" --silent 2>/dev/null; do
  attempts=$((attempts + 1))
  if [ "${attempts}" -ge "${max_attempts}" ]; then
    echo "MySQL did not become ready in time (timeout: ${max_attempts} attempts)" >&2
    exit 1
  fi
  echo "Attempt ${attempts}/${max_attempts}: MySQL not ready yet, waiting 2s..."
  sleep 2
done

echo "MySQL is alive, waiting for database to be ready..."
sleep 10

# Then wait for actual database connectivity with a query
attempts=0
while ! mysql -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USERNAME}" --password="${MYSQL_PASSWORD}" -e "SELECT 1" "${MYSQL_DATABASE}" >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [ "${attempts}" -ge "${max_attempts}" ]; then
    echo "MySQL database not accessible in time" >&2
    exit 1
  fi
  echo "Attempt ${attempts}/${max_attempts}: Database not ready yet, waiting 2s..."
  sleep 2
done

echo "MySQL is ready!"
