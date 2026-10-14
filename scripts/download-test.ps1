param(
  [int]$Limit = 5,
  [int]$DelayMin = 2,
  [int]$DelayMax = 5
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Bandita Player: Test Download (Limit: $Limit tracks)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

node scripts/download-tracks.mjs --limit $Limit --delay-min $DelayMin --delay-max $DelayMax --sync-library

Write-Host "`n[DONE] Test batch completed! Start the server to test offline playback." -ForegroundColor Green
