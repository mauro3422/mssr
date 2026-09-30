$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$old = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  node "$PSScriptRoot\real-section-split-benchmark.mjs"
  if ($LASTEXITCODE -ne 0) { throw "real-section-split-benchmark failed with exit $LASTEXITCODE" }
}
finally {
  $env:TYPESAFE_API_KEY = $old
}
