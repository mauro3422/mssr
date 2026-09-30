param([switch]$ScopeCheck)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$previousKey = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  if (-not $env:TYPESAFE_API_KEY) { throw 'Credencial TypeSafe no visible en esta sesión.' }
  if ($ScopeCheck) { & node "$PSScriptRoot\context-benchmark.mjs" '--scope-check' }
  else { & node "$PSScriptRoot\context-benchmark.mjs" }
  if ($LASTEXITCODE -ne 0) { throw 'Falló benchmark de contexto.' }
  & node "$PSScriptRoot\context-report.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló verificación o informe de contexto.' }
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
