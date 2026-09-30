$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$previousKey = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  if (-not $env:TYPESAFE_API_KEY) { throw 'Credencial no disponible.' }
  & node "$PSScriptRoot\reference-benchmark.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló benchmark de referencias.' }
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
