param(
  [int]$Port = 8091
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pagePath = Join-Path $scriptDir "trtc-local-publisher.html"

if (-not (Test-Path -LiteralPath $pagePath)) {
  throw "Cannot find $pagePath"
}

$listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -WindowStyle Hidden -FilePath python -ArgumentList @(
    "-m",
    "http.server",
    "$Port",
    "--bind",
    "127.0.0.1",
    "--directory",
    "$scriptDir"
  )
  Start-Sleep -Milliseconds 500
}

$url = "http://127.0.0.1:$Port/trtc-local-publisher.html"
Start-Process $url
Write-Output $url
