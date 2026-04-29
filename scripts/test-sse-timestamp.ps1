# SSE 流式响应时间戳测试脚本 (PowerShell)
# 用法: .\test-sse-timestamp.ps1 [-BaseUrl <url>] [-Question <question>] [-MaxResults <n>] [-Timeout <seconds>]
# 示例:
#   .\test-sse-timestamp.ps1 -BaseUrl "http://localhost:8081/api/rag/ask/stream" -Question "hi"
#   .\test-sse-timestamp.ps1 -BaseUrl "http://localhost:8080/api/rag/ask/stream" -Question "hi"
#
# 输出每个 SSE 事件的精确时间戳，用于诊断事件是否成块返回。
# 如果大量事件聚集在同一毫秒，说明存在缓冲问题。

param(
    [string]$BaseUrl = "http://localhost:8081/api/rag/ask/stream",
    [string]$Question = "你好，请介绍一下 Spring Boot",
    [int]$MaxResults = 3,
    [int]$Timeout = 60
)

$ConvId = "test-$(Get-Date -UFormat %s)"
$TempFile = [System.IO.Path]::GetTempFileName()

Write-Host "=== SSE Timestamp Test ===" -ForegroundColor Cyan
Write-Host "URL:         $BaseUrl"
Write-Host "Question:    $Question"
Write-Host "ConvId:      $ConvId"
Write-Host "Timeout:     ${Timeout}s"
Write-Host ""

# 构建请求体
$Body = @{ question = $Question; conversationId = $ConvId; maxResults = $MaxResults } | ConvertTo-Json -Compress

# 使用 Start-Process 或 curl.exe 实时获取输出并打时间戳
# 为了逐行实时处理，我们使用 System.Net.Http.HttpClient 手动读取 Stream

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [System.TimeSpan]::FromSeconds($Timeout)

$content = New-Object System.Net.Http.StringContent($Body, [System.Text.Encoding]::UTF8, "application/json")
$request = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Post, $BaseUrl)
$request.Content = $content
$request.Headers.Add("Accept", "text/event-stream")
$request.Headers.Add("Cache-Control", "no-cache")

try {
    $response = $client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).Result
    if (-not $response.IsSuccessStatusCode) {
        Write-Error "HTTP Error: $($response.StatusCode)"
        exit 1
    }

    $stream = $response.Content.ReadAsStreamAsync().Result
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    $sb = New-Object System.Text.StringBuilder

    $outputLines = @()
    while ($null -ne ($line = $reader.ReadLine())) {
        $ts = Get-Date -Format "HH:mm:ss.fff"
        $formatted = "$ts | $line"
        Write-Host $formatted
        $outputLines += $formatted
    }

    $reader.Close()
    $stream.Close()
    $response.Dispose()
} catch {
    Write-Error "Request failed: $_"
    exit 1
} finally {
    $client.Dispose()
}

Write-Host ""
Write-Host "=== Event Timing Summary ===" -ForegroundColor Cyan
Write-Host ""

# 统计每个时间点的事件数量
$eventCounts = @{}
foreach ($line in $outputLines) {
    if ($line -match "^(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|\s*event:(\S+)") {
        $key = "$($Matches[1]) $($Matches[2])"
        if (-not $eventCounts.ContainsKey($key)) {
            $eventCounts[$key] = 0
        }
        $eventCounts[$key]++
    }
}

foreach ($key in ($eventCounts.Keys | Sort-Object)) {
    $count = $eventCounts[$key]
    Write-Host ("{0,5} x {1}" -f $count, $key)
}

Write-Host ""
Write-Host "=== Delta vs Thinking_delta Timing ===" -ForegroundColor Cyan
Write-Host ""

$deltaCounts = @{}
$thinkingCounts = @{}
$totalDelta = 0
$totalThinking = 0

foreach ($line in $outputLines) {
    if ($line -match "^(\d{2}:\d{2}:\d{2})\.(\d{3})\s*\|\s*event:(thinking_delta|delta)") {
        $type = $Matches[3]
        $ts = "$($Matches[1]).$($Matches[2])"
        if ($type -eq "delta") {
            if (-not $deltaCounts.ContainsKey($ts)) { $deltaCounts[$ts] = 0 }
            $deltaCounts[$ts]++
            $totalDelta++
        } else {
            if (-not $thinkingCounts.ContainsKey($ts)) { $thinkingCounts[$ts] = 0 }
            $thinkingCounts[$ts]++
            $totalThinking++
        }
    }
}

Write-Host "--- delta (total: $totalDelta events) ---" -ForegroundColor Green
foreach ($ts in ($deltaCounts.Keys | Sort-Object)) {
    Write-Host ("  {0,5} events at {1}" -f $deltaCounts[$ts], $ts)
}

Write-Host ""
Write-Host "--- thinking_delta (total: $totalThinking events) ---" -ForegroundColor Yellow
foreach ($ts in ($thinkingCounts.Keys | Sort-Object)) {
    Write-Host ("  {0,5} events at {1}" -f $thinkingCounts[$ts], $ts)
}

# 计算并输出关键指标
Write-Host ""
Write-Host "=== Key Metrics ===" -ForegroundColor Cyan
Write-Host ""

# 找出包含最多事件的单个时间点
$maxEventsAtOnce = 0
$maxEventTs = ""
$allTimestamps = @{}
foreach ($line in $outputLines) {
    if ($line -match "^(\d{2}:\d{2}:\d{2}\.\d{3})\s*\|\s*event:(thinking_delta|delta)") {
        $ts = $Matches[1]
        if (-not $allTimestamps.ContainsKey($ts)) { $allTimestamps[$ts] = 0 }
        $allTimestamps[$ts]++
    }
}
foreach ($ts in $allTimestamps.Keys) {
    if ($allTimestamps[$ts] -gt $maxEventsAtOnce) {
        $maxEventsAtOnce = $allTimestamps[$ts]
        $maxEventTs = $ts
    }
}

Write-Host "Max delta/thinking_delta events in same millisecond: $maxEventsAtOnce (at $maxEventTs)"
Write-Host "Total unique timestamps for delta/thinking_delta: $($allTimestamps.Count)"
Write-Host "Total delta+thinking_delta events: $($totalDelta + $totalThinking)"
if ($allTimestamps.Count -gt 0) {
    $avgEventsPerTimestamp = [math]::Round(($totalDelta + $totalThinking) / $allTimestamps.Count, 2)
    Write-Host "Average events per timestamp: $avgEventsPerTimestamp"
}

# 判断是否有成块问题：如果同一毫秒超过5个事件，或者独立时间戳数量明显少于事件总数
if ($maxEventsAtOnce -ge 5 -or ($allTimestamps.Count -gt 0 -and ($totalDelta + $totalThinking) / $allTimestamps.Count -gt 2)) {
    Write-Host ""
    Write-Host "WARNING: Possible chunking/buffering detected!" -ForegroundColor Red
} else {
    Write-Host ""
    Write-Host "OK: Events appear to arrive smoothly." -ForegroundColor Green
}
