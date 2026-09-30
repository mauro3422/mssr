$ErrorActionPreference = 'Stop'
. "$PSScriptRoot\windows-credential.ps1"
$old = $env:TYPESAFE_API_KEY
try {
  $env:TYPESAFE_API_KEY = Get-TypeSafeCredential
  node "$PSScriptRoot\production-planner-context-smoke.mjs"
  if ($LASTEXITCODE -ne 0) { throw "production-planner-context-smoke failed with exit $LASTEXITCODE" }
}
finally {
  $env:TYPESAFE_API_KEY = $old
}
