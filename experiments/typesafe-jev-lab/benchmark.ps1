param([int]$Repetitions = 3)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$previousKey = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  if (-not $env:TYPESAFE_API_KEY) { throw 'Credencial TypeSafe ausente.' }
  & node "$PSScriptRoot\benchmark.mjs" "--repetitions=$Repetitions"
  if ($LASTEXITCODE -ne 0) { throw 'Falló el benchmark.' }
  & node "$PSScriptRoot\verify-results.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló la validación de resultados.' }
  & node "$PSScriptRoot\report.mjs"
  if ($LASTEXITCODE -ne 0) { throw 'Falló el informe visual.' }
} finally {
  $env:TYPESAFE_API_KEY = $previousKey
  $previousKey = $null
}
