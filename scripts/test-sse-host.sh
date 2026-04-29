#!/bin/sh
# 精确测试宿主机直接请求 Docker 映射端口 (8081)
echo "=== 宿主机测试 Spring Boot SSE (localhost:8081) ==="
{
  echo '{"question":"1+1等于几","maxResults":3}'
} | curl -N -s -w "\n---TIMING---\nTTFB: %{time_starttransfer}s | Total: %{time_total}s\n" \
  -H "Content-Type: application/json" \
  -d @- \
  http://localhost:8081/api/rag/ask/stream | while IFS= read -r line; do
  printf '%s %s\n' "$(date +%H:%M:%S.%3N)" "$line"
done
