$resp = Invoke-WebRequest -Uri "http://localhost:11434/api/generate" -Method POST -Body '{"model":"qwen2.5:7b","prompt":"你好，简单自我介绍一下","stream":true}' -ContentType "application/json" -UseBasicParsing
$lines = ($resp.Content -split "`n") | Select-Object -First 15
$lines | ForEach-Object { Write-Output $_ }
