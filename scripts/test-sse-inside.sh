#!/bin/sh
# 精确测试容器内 Spring Boot SSE 的时序
echo "=== 容器内测试 Spring Boot SSE (localhost:8080) ==="
{
  echo '{"question":"1+1等于几","maxResults":3}'
} | curl -N -s -w "\n---TIMING---\nTTFB: %{time_starttransfer}s | Total: %{time_total}s\n" \
  -H "Content-Type: application/json" \
  -d @- \
  http://localhost:8080/api/rag/ask/stream | while IFS= read -r line; do
  printf '%s %s\n' "$(date +%H:%M:%S.%3N)" "$line"
done
