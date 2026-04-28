<#
.SYNOPSIS
    E2E 测试运行脚本（Windows PowerShell 版）

.EXAMPLE
    .\scripts\e2e.ps1 start
    .\scripts\e2e.ps1 test
    .\scripts\e2e.ps1 stop
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "status", "test", "test:ui", "report", "install", "help")]
    [string]$Command = "help"
)

$ErrorActionPreference = "Stop"
Push-Location (Split-Path $PSScriptRoot -Parent)

$env:PLAYWRIGHT_BASE_URL = if ($env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL } else { "http://localhost:5174" }
$env:PLAYWRIGHT_API_URL = if ($env:PLAYWRIGHT_API_URL) { $env:PLAYWRIGHT_API_URL } else { "http://localhost:8082" }
$env:PLAYWRIGHT_ADMIN_USER = if ($env:PLAYWRIGHT_ADMIN_USER) { $env:PLAYWRIGHT_ADMIN_USER } else { "admin" }
$env:PLAYWRIGHT_ADMIN_PASSWORD = if ($env:PLAYWRIGHT_ADMIN_PASSWORD) { $env:PLAYWRIGHT_ADMIN_PASSWORD } else { "ChangeMe123!" }

function Show-Help {
    Write-Host @"
Usage: .\scripts\e2e.ps1 <command>

Commands:
  start       启动 E2E 测试容器（mysql, qdrant, backend, frontend）
  stop        停止并清理 E2E 测试容器
  status      查看容器运行状态
  test        运行 Playwright E2E 测试（自动先 start）
  test:ui     以 UI 模式运行 Playwright 测试
  report      打开 HTML 测试报告
  install     安装 Playwright 浏览器依赖

Environment:
  PLAYWRIGHT_BASE_URL         前端地址（默认 http://localhost:5174）
  PLAYWRIGHT_API_URL          后端 API 地址（默认 http://localhost:8082）
  PLAYWRIGHT_ADMIN_USER       测试管理员用户名（默认 admin）
  PLAYWRIGHT_ADMIN_PASSWORD   测试管理员密码（默认 ChangeMe123!）
"@
}

function Start-Services {
    Write-Host "==> Starting E2E services with docker-compose.e2e.yml ..."
    docker compose -f docker-compose.e2e.yml --env-file .env.e2e up --build -d

    Write-Host ""
    Write-Host "==> Waiting for backend health checks ..."
    $attempts = 0
    while ($true) {
        $attempts++
        try {
            $rag = Invoke-RestMethod -Uri "$env:PLAYWRIGHT_API_URL/api/rag/health" -Method GET -ErrorAction Stop
            $doc = Invoke-RestMethod -Uri "$env:PLAYWRIGHT_API_URL/api/documents/health" -Method GET -ErrorAction Stop
            Write-Host "==> Backend is ready!"
            break
        } catch {
            if ($attempts -ge 60) {
                Write-Host "==> ERROR: Backend did not become ready in time"
                docker compose -f docker-compose.e2e.yml logs backend-e2e --tail 50
                exit 1
            }
            Write-Host "    ... waiting (${attempts}/60)"
            Start-Sleep -Seconds 2
        }
    }

    Write-Host ""
    Write-Host "==> E2E environment is ready!"
    Write-Host "    Frontend: $env:PLAYWRIGHT_BASE_URL"
    Write-Host "    Backend API: $env:PLAYWRIGHT_API_URL"
}

function Stop-Services {
    Write-Host "==> Stopping E2E services ..."
    docker compose -f docker-compose.e2e.yml --env-file .env.e2e down -v
    Write-Host "==> Done."
}

function Show-Status {
    docker compose -f docker-compose.e2e.yml --env-file .env.e2e ps
}

function Run-Tests {
    param([string[]]$Remaining)
    $running = docker compose -f docker-compose.e2e.yml ps | Select-String "Up"
    if (-not $running) {
        Write-Host "==> Services not running, starting them first ..."
        Start-Services
    }

    Write-Host ""
    Write-Host "==> Running Playwright E2E tests ..."
    Push-Location frontend
    try {
        pnpm exec playwright test @Remaining
    } finally {
        Pop-Location
    }
}

function Run-TestsUI {
    param([string[]]$Remaining)
    $running = docker compose -f docker-compose.e2e.yml ps | Select-String "Up"
    if (-not $running) {
        Write-Host "==> Services not running, starting them first ..."
        Start-Services
    }

    Write-Host ""
    Write-Host "==> Running Playwright E2E tests (UI mode) ..."
    Push-Location frontend
    try {
        pnpm exec playwright test --ui @Remaining
    } finally {
        Pop-Location
    }
}

function Show-Report {
    Push-Location frontend
    try {
        pnpm exec playwright show-report
    } finally {
        Pop-Location
    }
}

function Install-Deps {
    Write-Host "==> Installing Playwright browsers ..."
    Push-Location frontend
    try {
        pnpm exec playwright install --with-deps chromium
    } finally {
        Pop-Location
    }
}

switch ($Command) {
    "start" { Start-Services }
    "stop" { Stop-Services }
    "status" { Show-Status }
    "test" { Run-Tests -Remaining $args }
    "test:ui" { Run-TestsUI -Remaining $args }
    "report" { Show-Report }
    "install" { Install-Deps }
    default { Show-Help }
}

Pop-Location
