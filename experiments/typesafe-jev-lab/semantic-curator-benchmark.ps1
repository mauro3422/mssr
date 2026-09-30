$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$previousKey = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  if (-not $env:TYPESAFE_API_KEY) { throw 'Credencial TypeSafe no visible en esta sesión.' }
  & node "$PSScriptRoot\semantic-curator-benchmark.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló semantic-curator-benchmark.' }
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
