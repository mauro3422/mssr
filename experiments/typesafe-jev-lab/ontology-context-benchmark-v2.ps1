$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$old = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  node "$PSScriptRoot\ontology-context-benchmark-v2.mjs"
  if ($LASTEXITCODE -ne 0) { throw "ontology-context-benchmark failed with exit $LASTEXITCODE" }
}
finally {
  $env:TYPESAFE_API_KEY = $old
}
