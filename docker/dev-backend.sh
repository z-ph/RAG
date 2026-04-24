#!/bin/sh
set -e

echo "==> Starting development environment..."

# Do NOT source .env here - let EnvFileEnvironmentPostProcessor read it.
# This ensures .env changes are picked up on DevTools restart.

# Start Spring Boot with DevTools (hot-reload on classpath changes)
mvn spring-boot:run &
APP_PID=$!

# Marker file to track last compilation time
MARKER=$(mktemp)
ENV_MD5=$(md5sum /workspace/.env 2>/dev/null || echo "none")

echo "==> Watching for changes..."
echo "    .env   -> triggers DevTools restart (re-reads .env via EnvironmentPostProcessor)"
echo "    src/   -> triggers mvn compile -> DevTools hot-reload"

while kill -0 $APP_PID 2>/dev/null; do
    sleep 3

    # Check .env changes -> touch trigger file to restart DevTools
    NEW_ENV_MD5=$(md5sum /workspace/.env 2>/dev/null || echo "none")
    if [ "$NEW_ENV_MD5" != "$ENV_MD5" ]; then
        ENV_MD5="$NEW_ENV_MD5"
        echo "==> .env changed, triggering DevTools restart..."
        mkdir -p /workspace/target/classes
        touch /workspace/target/classes/.env-trigger
    fi

    # Check Java source changes -> compile (DevTools picks up new classes)
    CHANGED=$(find /workspace/src -name "*.java" -newer "$MARKER" -print -quit 2>/dev/null)
    if [ -n "$CHANGED" ]; then
        touch "$MARKER"
        echo "==> Source changed, compiling..."
        mvn -f /workspace/pom.xml compile -q 2>&1 || true
    fi
done

echo "==> Application stopped."
rm -f "$MARKER"
