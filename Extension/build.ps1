# Build Chrome Web Store upload bundle (manifest.json at zip root)
$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$dist = Join-Path $root "dist"
$staging = Join-Path $dist "staging"
$version = (Get-Content (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json).version
$zipName = "HypeWheel.app-chrome-store-v$version.zip"
$zipPath = Join-Path $dist $zipName

$include = @("manifest.json", "icons", "popup", "content", "shared")

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Force -Path $staging | Out-Null
New-Item -ItemType Directory -Force -Path $dist | Out-Null

foreach ($item in $include) {
  $src = Join-Path $root $item
  if (-not (Test-Path $src)) {
    throw "Missing required path: $src"
  }
  Copy-Item $src (Join-Path $staging $item) -Recurse -Force
}

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item $staging -Recurse -Force

$bytes = (Get-Item $zipPath).Length
Write-Host "Built: $zipPath ($bytes bytes)"
