param(
  [int]$BatchSize = 25,
  [int]$Batch = 0,
  [switch]$AutoLoop,
  [int]$Cooldown = 120,
  [int]$Concurrency = 2,
  [string]$Format = "webm"
)

$argsList = @(
  "scripts/download-tracks.mjs",
  "--batch-size", $BatchSize,
  "--concurrency", $Concurrency,
  "--format", $Format,
  "--cooldown", $Cooldown,
  "--sync-library"
)

if ($Batch -gt 0) {
  $argsList += @("--batch", $Batch)
}

if ($AutoLoop) {
  $argsList += @("--auto-loop")
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Bandita Player: Batch Downloader" -ForegroundColor Cyan
Write-Host "Batch size: $BatchSize | Concurrency: $Concurrency | Format: $Format" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

node @argsList
