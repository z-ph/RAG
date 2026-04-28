#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> E2E Test Runner"
echo ""

# 默认环境变量
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:5174}"
export PLAYWRIGHT_API_URL="${PLAYWRIGHT_API_URL:-http://localhost:8082}"
export PLAYWRIGHT_ADMIN_USER="${PLAYWRIGHT_ADMIN_USER:-admin}"
export PLAYWRIGHT_ADMIN_PASSWORD="${PLAYWRIGHT_ADMIN_PASSWORD:-ChangeMe123!}"

COMMAND="${1:-help}"

help() {
  cat <<EOF
Usage: $0 <command>

Commands:
  start       启动 E2E 测试容器（mysql, qdrant, backend, frontend）
  stop        停止并清理 E2E 测试容器
  status      查看容器运行状态
  test        运行 Playwright E2E 测试（自动先 start）
  test:ui     以 UI 模式运行 Playwright 测试
  report      打开 HTML 测试报告
  install     安装 Playwright 浏览器依赖

Environment:
  PLAYWRIGHT_BASE_URL     前端地址（默认 http://localhost:5174）
  PLAYWRIGHT_API_URL      后端 API 地址（默认 http://localhost:8082）
  PLAYWRIGHT_ADMIN_USER   测试管理员用户名（默认 admin）
  PLAYWRIGHT_ADMIN_PASSWORD 测试管理员密码（默认 ChangeMe123!）
EOF
}

start_services() {
  echo "==> Starting E2E services with docker-compose.e2e.yml ..."
  docker compose -f docker-compose.e2e.yml --env-file .env.e2e up --build -d

  echo ""
  echo "==> Waiting for backend health checks ..."
  local attempts=0
  while true; do
    attempts=$((attempts + 1))
    if curl -sf "${PLAYWRIGHT_API_URL}/api/rag/health" >/dev/null 2>&1 && \
       curl -sf "${PLAYWRIGHT_API_URL}/api/documents/health" >/dev/null 2>&1; then
      echo "==> Backend is ready!"
      break
    fi
    if [ "$attempts" -ge 60 ]; then
      echo "==> ERROR: Backend did not become ready in time"
      docker compose -f docker-compose.e2e.yml logs backend-e2e --tail 50
      exit 1
    fi
    echo "    ... waiting (${attempts}/60)"
    sleep 2
  done

  echo ""
  echo "==> E2E environment is ready!"
  echo "    Frontend: ${PLAYWRIGHT_BASE_URL}"
  echo "    Backend API: ${PLAYWRIGHT_API_URL}"
}

stop_services() {
  echo "==> Stopping E2E services ..."
  docker compose -f docker-compose.e2e.yml --env-file .env.e2e down -v
  echo "==> Done."
}

status_services() {
  docker compose -f docker-compose.e2e.yml --env-file .env.e2e ps
}

run_tests() {
  # 检查容器是否已运行
  if ! docker compose -f docker-compose.e2e.yml ps | grep -q "Up"; then
    echo "==> Services not running, starting them first ..."
    start_services
  fi

  echo ""
  echo "==> Running Playwright E2E tests ..."
  cd frontend
  pnpm exec playwright test "$@"
}

run_tests_ui() {
  if ! docker compose -f docker-compose.e2e.yml ps | grep -q "Up"; then
    echo "==> Services not running, starting them first ..."
    start_services
  fi

  echo ""
  echo "==> Running Playwright E2E tests (UI mode) ..."
  cd frontend
  pnpm exec playwright test --ui "$@"
}

show_report() {
  cd frontend
  pnpm exec playwright show-report
}

install_deps() {
  echo "==> Installing Playwright browsers ..."
  cd frontend
  pnpm exec playwright install --with-deps chromium
}

case "$COMMAND" in
  start)
    start_services
    ;;
  stop)
    stop_services
    ;;
  status)
    status_services
    ;;
  test)
    shift || true
    run_tests "$@"
    ;;
  test:ui)
    shift || true
    run_tests_ui "$@"
    ;;
  report)
    show_report
    ;;
  install)
    install_deps
    ;;
  *)
    help
    exit 1
    ;;
esac
