#!/bin/sh
set -eu

# Wait for MySQL first
/app/scripts/wait-for-mysql.sh

# Start application
echo "Starting Spring Boot application..."
exec java ${JAVA_OPTS} -jar /app/app.jar
