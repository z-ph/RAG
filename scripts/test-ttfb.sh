#!/bin/sh
echo "=== 测试 VLLM 首 token 时间 ==="

# 将响应体写入文件，timing 信息直接输出
curl -N -s \
  -o /tmp/vllm_resp.txt \
  -w "DNS: %{time_namelookup}s | Connect: %{time_connect}s | TTFB: %{time_starttransfer}s | Total: %{time_total}s\n" \
  http://222.200.112.60/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-shiliuziyyds" \
  -d '{"model":"glm-4.6v-flash","messages":[{"role":"user","content":"你好"}],"stream":true}'

echo "首 token:"
head -1 /tmp/vllm_resp.txt
