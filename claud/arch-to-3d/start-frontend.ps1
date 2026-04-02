Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Join-Path $projectRoot ".runtime\node-v20.18.2-win-x64\node.exe"
$vite = Join-Path $projectRoot "frontend\node_modules\vite\bin\vite.js"
$frontendDir = Join-Path $projectRoot "frontend"

if (-not (Test-Path $node)) {
    throw "Node runtime not found: $node"
}

if (-not (Test-Path $vite)) {
    throw "Vite entrypoint not found: $vite"
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found: $frontendDir"
}

Write-Host "Starting frontend at http://127.0.0.1:5173" -ForegroundColor Cyan
Set-Location $frontendDir
& $node $vite --host 127.0.0.1 --port 5173
