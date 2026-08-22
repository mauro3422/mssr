[CmdletBinding()]
param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
Push-Location $ProjectRoot
try {
  & npm run check
  if ($LASTEXITCODE -ne 0) { throw "npm run check failed" }
  & npm run test:first-party-skills
  if ($LASTEXITCODE -ne 0) { throw "npm run test:first-party-skills failed" }
  & npm run test:skill-context
  if ($LASTEXITCODE -ne 0) { throw "npm run test:skill-context failed" }
  & npm run test:skill-routing
  if ($LASTEXITCODE -ne 0) { throw "npm run test:skill-routing failed" }
  & npm run audit:check
  if ($LASTEXITCODE -ne 0) { throw "npm run audit:check failed" }
  & pwsh -NoProfile -File .\scripts\test-install-first-party-skills.ps1
  if ($LASTEXITCODE -ne 0) { throw "first-party installer sandbox test failed" }
  Write-Host "first-party skills v1 verification passed (source/package dry-run/routing/context/installer sandbox)"
} finally {
  Pop-Location
}
