#!/usr/bin/env bash
# SSE 流式响应时间戳测试脚本
# 用法: ./test-sse-timestamp.sh [question] [session_id]
#
# 输出每个 SSE 事件的精确时间戳，用于诊断事件是否成块返回。
# 如果大量事件聚集在同一毫秒，说明存在缓冲问题。

BASE_URL="${SSE_BASE_URL:-http://localhost:8080/api/rag/ask/stream}"
QUESTION="${1:-introduce Spring Boot in Chinese}"
SESSION_ID="${2:-JSESSIONID=123123123}"
MAX_RESULTS="${SSE_MAX_RESULTS:-3}"
TIMEOUT="${SSE_TIMEOUT:-30}"
CONV_ID="test-$(date +%s)"

echo "=== SSE Timestamp Test ==="
echo "URL:         $BASE_URL"
echo "Question:    $QUESTION"
echo "ConvId:      $CONV_ID"
echo "Timeout:     ${TIMEOUT}s"
echo ""

# 发送请求并用 perl 给每行打毫秒时间戳
curl -s "$BASE_URL" \
  -H 'Accept: text/event-stream' \
  -H 'Content-Type: application/json' \
  -H 'Cache-Control: no-cache' \
  -b "$SESSION_ID" \
  --data-raw "{\"question\":\"$QUESTION\",\"conversationId\":\"$CONV_ID\",\"maxResults\":$MAX_RESULTS}" \
  --insecure \
  --max-time "$TIMEOUT" \
  2>&1 | perl -MTime::HiRes=time -MPOSIX=strftime -ne '
    $t = time;
    $ms = int(($t - int($t)) * 1000);
    $ts = sprintf("%s.%03d", strftime("%H:%M:%S", localtime(int($t))), $ms);
    chomp;
    print "$ts | $_\n";
  ' | tee /tmp/sse-output.txt

echo ""
echo "=== Event Timing Summary ==="
echo ""

# 提取所有事件及其时间戳，统计每个时间点的事件数量
perl -ne '
  if (/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|\s*event:(\S+)/) {
    $key = "$1 $2";
    $count{$key}++;
  }
  END {
    for (sort keys %count) {
      printf "%5d x %s\n", $count{$_}, $_;
    }
  }
' /tmp/sse-output.txt

echo ""
echo "=== Delta vs Thinking_delta Timing ==="
echo ""

# 分别统计 thinking_delta 和 delta 的时间分布
perl -ne '
  if (/^(\d{2}:\d{2}:\d{2})\.(\d{3})\s*\|\s*event:(thinking_delta|delta)/) {
    $type = $3;
    $ts = "$1.$2";
    $count_by_type{$type}{$ts}++;
    $total{$type}++;
  }
  END {
    for $type (sort keys %count_by_type) {
      print "--- $type (total: $total{$type} events) ---\n";
      for (sort keys %{$count_by_type{$type}}) {
        printf "  %5d events at %s\n", $count_by_type{$type}{$_}, $_;
      }
      print "\n";
    }
  }
' /tmp/sse-output.txt
