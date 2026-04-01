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
