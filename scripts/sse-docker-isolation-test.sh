#!/usr/bin/env bash
# SSE Docker 网络隔离实验脚本 v2
# ============================================================
# 用途：逐层隔离 SSE chunking 根因
#       特别关注 Docker INBOUND（vLLM → 容器）和 OUTBOUND（容器 → 客户端）
# 用法：在宿主机上运行 (需要 docker 权限)
# ============================================================

set -euo pipefail

# 配置
CONTAINER_NAME="${APP_CONTAINER:-rag-app-1}"
HOST="${APP_HOST:-localhost}"
DOCKER_PORT="${APP_DOCKER_PORT:-8081}"       # 宿主机映射端口
CONTAINER_PORT="${APP_CONTAINER_PORT:-8080}" # 容器内端口
NGINX_URL="${NGINX_BASE_URL:-http://222.200.112.60/rag-back}"
VLLM_URL="${VLLM_BASE_URL:-http://222.200.112.60/vllm/v1/chat/completions}"
VLLM_API_KEY="${VLLM_API_KEY:-sk-shiliuziyyds}"
VLLM_MODEL="${VLLM_MODEL:-glm-4.6v-flash}"
QUESTION="${1:-请用一句话介绍 Spring Boot 的优势}"
SESSION_ID="${SSE_SESSION_ID:-JSESSIONID=dummy}"
CONV_ID="docker-isolation-$(date +%s)"
MAX_RESULTS="${SSE_MAX_RESULTS:-3}"
TIMEOUT="${SSE_TIMEOUT:-30}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

header() {
  echo ""
  echo "========================================"
  echo "  $1"
  echo "========================================"
}

# -----------------------------------------------------------
# 辅助：带毫秒时间戳的 curl SSE 请求
# -----------------------------------------------------------
run_sse_curl() {
  local url="$1"
  local label="$2"
  local output_file="$3"
  shift 3
  local extra_curl_args=("$@")

  info "请求: $label"
  info "URL:  $url"

  curl -sS -N "$url" \
    -H 'Accept: text/event-stream' \
    -H 'Content-Type: application/json' \
    -H 'Cache-Control: no-cache' \
    "${extra_curl_args[@]}" \
    --max-time "$TIMEOUT" \
    2>&1 | perl -MTime::HiRes=time -MPOSIX=strftime -ne '
      $t = time;
      $ms = int(($t - int($t)) * 1000);
      $ts = sprintf("%s.%03d", strftime("%H:%M:%S", localtime(int($t))), $ms);
      chomp;
      print "$ts | $_\n";
    ' > "$output_file"
}

# -----------------------------------------------------------
# 辅助：分析 chunking 指标
# -----------------------------------------------------------
analyze_chunking() {
  local file="$1"
  local label="$2"

  if [[ ! -s "$file" ]]; then
    warn "$label: 无输出数据"
    return 1
  fi

  local max_per_ms
  max_per_ms=$(perl -ne '
    if (/^(\d{2}:\d{2}:\d{2})\.(\d{3})/) {
      $ms = "$1.$2";
      $count{$ms}++;
    }
    END {
      $max = 0;
      for (values %count) { $max = $_ if $_ > $max; }
      print $max;
    }
  ' "$file")

  local total_events
  total_events=$(grep -cE 'data:' "$file" || true)

  local unique_ms
  unique_ms=$(perl -ne 'if (/^(\d{2}:\d{2}:\d{2}\.\d{3})/) { $seen{$1} = 1; } END { print scalar keys %seen; }' "$file")

  local avg_per_ms=0
  if [[ "$unique_ms" -gt 0 ]]; then
    avg_per_ms=$(awk "BEGIN {printf \"%.1f\", $total_events / $unique_ms}")
  fi

  echo ""
  echo "  总行数/事件数:   $total_events"
  echo "  不同时间戳数:    $unique_ms"
  echo "  最大并发行/ms:   $max_per_ms"
  echo "  平均行/ms:       $avg_per_ms"
  echo ""

  if [[ "$max_per_ms" -le 2 ]]; then
    ok "$label → 逐 token 到达（无明显 chunking）"
    return 0
  elif [[ "$max_per_ms" -le 5 ]]; then
    warn "$label → 轻微 chunking（每块 $max_per_ms 个事件）"
    return 1
  else
    err "$label → 严重 chunking（每块最多 $max_per_ms 个事件）"
    return 2
  fi
}

# -----------------------------------------------------------
# 实验 0：前置检查
# -----------------------------------------------------------
header "实验 0：前置检查"

if docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  ok "容器 $CONTAINER_NAME 正在运行"
else
  err "容器 $CONTAINER_NAME 未运行!"
  docker ps --format '  - {{.Names}} ({{.Ports}})' || true
  echo ""
  echo "  请检查 docker-compose 项目名，或通过环境变量设置:"
  echo "    APP_CONTAINER=<容器名> ./sse-docker-isolation-test.sh"
  exit 1
fi

if docker exec "$CONTAINER_NAME" sh -c 'command -v curl' >/dev/null 2>&1; then
  ok "容器内 curl 可用"
else
  warn "容器内没有 curl，尝试安装..."
  docker exec "$CONTAINER_NAME" sh -c 'apt-get update && apt-get install -y curl' 2>/dev/null || \
  docker exec "$CONTAINER_NAME" sh -c 'apk add --no-cache curl' 2>/dev/null || \
  { err "无法安装 curl，实验 1 将无法执行"; }
fi

# -----------------------------------------------------------
# 实验 A：容器内直接 curl vLLM（验证 Docker INBOUND 路径）
# -----------------------------------------------------------
header "实验 A：容器内 curl vLLM（验证 Docker INBOUND）"
echo "  链路: 容器内 curl → $VLLM_URL"
echo "  目的: 验证 vLLM 的逐 token SSE 进入 Docker 容器时是否被 chunking"
echo ""

EXP_A_FILE="/tmp/sse-expA-vllm-inbound.txt"

# vLLM 的 SSE 格式不同，直接请求 vLLM API
docker exec "$CONTAINER_NAME" sh -c "
  curl -sS -N '$VLLM_URL' \
    -H 'Authorization: Bearer $VLLM_API_KEY' \
    -H 'Content-Type: application/json' \
    --data-raw '{\"model\":\"$VLLM_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"$QUESTION\"}],\"stream\":true}' \
    --max-time $TIMEOUT \
    2>&1
" | perl -MTime::HiRes=time -MPOSIX=strftime -ne '
  $t = time;
  $ms = int(($t - int($t)) * 1000);
  $ts = sprintf("%s.%03d", strftime("%H:%M:%S", localtime(int($t))), $ms);
  chomp;
  print "$ts | $_\n";
' > "$EXP_A_FILE"

EXP_A_STATUS=0
analyze_chunking "$EXP_A_FILE" "实验 A (vLLM inbound)" || EXP_A_STATUS=$?

# -----------------------------------------------------------
# 实验 B：容器内 curl localhost:8080（验证 Tomcat flush）
# -----------------------------------------------------------
header "实验 B：容器内 curl localhost:$CONTAINER_PORT（验证 Tomcat flush）"
echo "  链路: 容器内 curl → localhost:$CONTAINER_PORT"
echo "  目的: 排除 Docker 网络，验证 Java 应用自身是否逐 token flush"
echo ""

EXP_B_FILE="/tmp/sse-expB-tomcat-internal.txt"

docker exec "$CONTAINER_NAME" sh -c "
  curl -sS -N http://localhost:$CONTAINER_PORT/rag/ask/stream \\
    -H 'Accept: text/event-stream' \\
    -H 'Content-Type: application/json' \\
    -H 'Cache-Control: no-cache' \\
    --data-raw '{\"question\":\"$QUESTION\",\"conversationId\":\"$CONV_ID-b\",\"maxResults\":$MAX_RESULTS}' \\
    --max-time $TIMEOUT \\
    2>&1
" | perl -MTime::HiRes=time -MPOSIX=strftime -ne '
  $t = time;
  $ms = int(($t - int($t)) * 1000);
  $ts = sprintf("%s.%03d", strftime("%H:%M:%S", localtime(int($t))), $ms);
  chomp;
  print "$ts | $_\n";
' > "$EXP_B_FILE"

EXP_B_STATUS=0
analyze_chunking "$EXP_B_FILE" "实验 B (Tomcat 内部)" || EXP_B_STATUS=$?

# -----------------------------------------------------------
# 实验 C：宿主机 curl :8081（验证 Docker OUTBOUND）
# -----------------------------------------------------------
header "实验 C：宿主机 curl :$DOCKER_PORT（验证 Docker OUTBOUND）"
echo "  链路: 宿主机 curl → localhost:$DOCKER_PORT（经过 Docker NAT）"
echo "  目的: 验证 Java 发出的 SSE 经过 Docker NAT 映射后是否被 chunking"
echo ""

EXP_C_FILE="/tmp/sse-expC-docker-outbound.txt"
run_sse_curl "http://$HOST:$DOCKER_PORT/rag/ask/stream" "Docker outbound" "$EXP_C_FILE" \
  -b "$SESSION_ID" \
  --data-raw "{\"question\":\"$QUESTION\",\"conversationId\":\"$CONV_ID-c\",\"maxResults\":$MAX_RESULTS}"

EXP_C_STATUS=0
analyze_chunking "$EXP_C_FILE" "实验 C (Docker outbound)" || EXP_C_STATUS=$?

# -----------------------------------------------------------
# 实验 D：宿主机 curl Nginx（验证 Nginx）
# -----------------------------------------------------------
header "实验 D：宿主机 curl Nginx（验证 Nginx）"
echo "  链路: 宿主机 curl → Nginx → localhost:$DOCKER_PORT → 容器"
echo ""

EXP_D_FILE="/tmp/sse-expD-nginx.txt"
run_sse_curl "$NGINX_URL/rag/ask/stream" "Nginx 链路" "$EXP_D_FILE" \
  -b "$SESSION_ID" \
  --data-raw "{\"question\":\"$QUESTION\",\"conversationId\":\"$CONV_ID-d\",\"maxResults\":$MAX_RESULTS}"

EXP_D_STATUS=0
analyze_chunking "$EXP_D_FILE" "实验 D (Nginx)" || EXP_D_STATUS=$?

# -----------------------------------------------------------
# 根因判定矩阵
# -----------------------------------------------------------
header "根因判定"

echo ""
echo "┌──────────────────────────────────────────────────────────┐"
echo "│              SSE Chunking 根因判定矩阵                    │"
echo "├──────────┬─────────────────────────────────────────────┤"
printf "│ 实验 A   │ 容器内 curl vLLM      : %s\n" "$([[ $EXP_A_STATUS -eq 0 ]] && echo "✅ 正常" || echo "❌ 异常")"
printf "│ 实验 B   │ 容器内 curl Java      : %s\n" "$([[ $EXP_B_STATUS -eq 0 ]] && echo "✅ 正常" || echo "❌ 异常")"
printf "│ 实验 C   │ 宿主机 curl Docker    : %s\n" "$([[ $EXP_C_STATUS -eq 0 ]] && echo "✅ 正常" || echo "❌ 异常")"
printf "│ 实验 D   │ 宿主机 curl Nginx     : %s\n" "$([[ $EXP_D_STATUS -eq 0 ]] && echo "✅ 正常" || echo "❌ 异常")"
echo "└──────────┴─────────────────────────────────────────────┘"
echo ""

# ── 情况 1：实验 A 异常 ──────────────────────────────────
if [[ $EXP_A_STATUS -ne 0 ]]; then
  err "实验 A (vLLM inbound) 异常 → Docker INBOUND 路径 chunking 了 vLLM 响应！"
  echo ""
  echo "  🔍 根因：vLLM 发出的逐 token SSE 在进入 Docker 容器时被网络层缓冲"
  echo "     - Docker bridge/NAT/conntrack 对入站小包做了聚合"
  echo "     - Java 应用收到的是已经成块的数据，flushBuffer() 再好也没用"
  echo ""
  echo "  📋 修复建议："
  echo "     1. 在 docker-compose.yml 中给 app 添加 host 网络模式测试："
  echo "        network_mode: \"host\""
  echo "     2. 或改用 macvlan/ipvlan 绕过 NAT"
  echo "     3. 或调整容器 sysctls: tcp_wmem default 调低到 4096"
  echo ""
  echo "  🧪 金标准对照实验（必须做）："
  echo "     在宿主机直接运行 Java：./mvnw spring-boot:run"
  echo "     然后外网 curl :8080 → 如果正常 → 100% 确认 Docker 是根因"
  echo ""

# ── 情况 2：实验 A 正常，实验 B 异常 ──────────────────────
elif [[ $EXP_A_STATUS -eq 0 && $EXP_B_STATUS -ne 0 ]]; then
  err "实验 A 正常，实验 B 异常 → Java/Tomcat 层是根因"
  echo ""
  echo "  🔍 根因：vLLM 入站正常，但 Java 处理后 chunking"
  echo "     - flushBuffer() 未生效（代码路径有问题）"
  echo "     - 或 Tomcat OutputBuffer 未正确刷新"
  echo "     - 或 LangChain4j HTTP 客户端有缓冲"
  echo ""
  echo "  📋 排查方向："
  echo "     1. 在 RagService.java sendEvent() 方法打断点，确认 flush() 被调用"
  echo "     2. 检查是否有 Filter/ShallowEtagHeaderFilter 包装了 response"
  echo "     3. 检查 LangChain4j 的 HTTP 客户端是否开启了响应缓冲"
  echo ""

# ── 情况 3：A-B 正常，C 异常 ─────────────────────────────
elif [[ $EXP_A_STATUS -eq 0 && $EXP_B_STATUS -eq 0 && $EXP_C_STATUS -ne 0 ]]; then
  err "实验 A-B 正常，实验 C 异常 → Docker OUTBOUND 是根因"
  echo ""
  echo "  🔍 根因：Java 在容器内正常逐 token，但经过 Docker NAT 出去后 chunking"
  echo "     - Docker bridge 对出站小包做了聚合"
  echo ""
  echo "  📋 修复建议："
  echo "     1. TomcatConnectorCustomizer: socket.tcpNoDelay=true"
  echo "     2. docker-compose sysctls 调低 tcp_wmem"
  echo "     3. 禁用 Docker userland-proxy"
  echo ""

# ── 情况 4：A-C 正常，D 异常 ─────────────────────────────
elif [[ $EXP_A_STATUS -eq 0 && $EXP_B_STATUS -eq 0 && $EXP_C_STATUS -eq 0 && $EXP_D_STATUS -ne 0 ]]; then
  err "实验 A-C 正常，实验 D 异常 → Nginx 是根因"
  echo ""
  echo "  📋 修复建议："
  echo "     1. nginx.conf: proxy_buffering off; gzip off;"
  echo "     2. proxy_http_version 1.1; proxy_set_header Connection '';"
  echo ""

# ── 情况 5：全部正常 ─────────────────────────────────────
elif [[ $EXP_A_STATUS -eq 0 && $EXP_B_STATUS -eq 0 && $EXP_C_STATUS -eq 0 && $EXP_D_STATUS -eq 0 ]]; then
  ok "全部正常 → 问题已修复！"
  echo ""
  echo "  📋 建议：浏览器端验证 + Playwright E2E"
  echo ""

else
  warn "边界组合，需人工分析"
  echo "  A=$EXP_A_STATUS B=$EXP_B_STATUS C=$EXP_C_STATUS D=$EXP_D_STATUS"
  echo ""
fi

# -----------------------------------------------------------
# 金标准对照实验说明
# -----------------------------------------------------------
header "🧪 金标准对照实验（强烈推荐）"

echo ""
echo "如果你在宿主机上能直接启动 Java 应用，请执行以下对照："
echo ""
echo "  步骤 1: 在宿主机启动 Spring Boot"
echo "    ./mvnw spring-boot:run"
echo ""
echo "  步骤 2: 从外部网络直接 curl 宿主机 :8080"
echo "    curl http://<宿主机IP>:8080/rag/ask/stream ..."
echo ""
echo "  判定："
echo "    ✅ 如果宿主机直接运行正常 → 根因 100% 在 Docker（inbound/outbound）"
echo "    ❌ 如果宿主机直接运行也 chunking → 根因 100% 在 Java 代码层"
echo ""
echo "  这是唯一能完全排除 Docker 的实验。脚本无法替你运行，"
echo "  因为宿主机运行 Java 需要停止 Docker 容器避免端口冲突。"
echo ""

# -----------------------------------------------------------
# 输出文件汇总
# -----------------------------------------------------------
header "原始数据文件"
echo "  实验 A (vLLM inbound): $EXP_A_FILE"
echo "  实验 B (Tomcat 内部):  $EXP_B_FILE"
echo "  实验 C (Docker outbound): $EXP_C_FILE"
echo "  实验 D (Nginx):        $EXP_D_FILE"
echo ""
echo "  查看详情: cat <文件> | head -30"
echo ""
