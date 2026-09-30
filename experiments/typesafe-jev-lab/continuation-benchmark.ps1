$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$previousKey = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  if (-not $env:TYPESAFE_API_KEY) { throw 'Credencial TypeSafe no visible en esta sesión.' }
  & node "$PSScriptRoot\continuation-benchmark.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló benchmark de continuación.' }
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
