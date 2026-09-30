$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. "$PSScriptRoot\windows-credential.ps1"

$key = Get-TypeSafeCredential
if (-not $key) {
  Write-Host "No TypeSafe credential found in Windows Credential Manager."
  & "$PSScriptRoot\save-credential.ps1"
  $key = Get-TypeSafeCredential
}
if (-not $key) { throw "TypeSafe API key is unavailable." }

$previousKey = $env:TYPESAFE_API_KEY
$env:TYPESAFE_API_KEY = $key
$key = $null
try {
if (-not (Test-Path ".\node_modules\@typesafe-ai\sdk")) {
  Write-Host "Installing @typesafe-ai/sdk..."
  npm install
}

Write-Host "Loaded TypeSafe API key from Windows Credential Manager."
Write-Host "Starting Jev Lab on http://127.0.0.1:8788"
npm start
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
