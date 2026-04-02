Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $projectRoot ".runtime\python\python.exe"
$backendDir = Join-Path $projectRoot "backend"

if (-not (Test-Path $python)) {
    throw "Python runtime not found: $python"
}

if (-not (Test-Path $backendDir)) {
    throw "Backend directory not found: $backendDir"
}

Write-Host "Starting backend at http://127.0.0.1:8000" -ForegroundColor Cyan
Set-Location $backendDir
& $python -m uvicorn main:app --app-dir . --host 127.0.0.1 --port 8000
