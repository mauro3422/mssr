$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
. "$PSScriptRoot\windows-credential.ps1"

Write-Host ""
Write-Host "Save TypeSafe API key to Windows Credential Manager"
Write-Host "Target: TypeSafe:MSSR:JevLab"
Write-Host "The key will not be displayed or written to a project file."
$secret = Read-Host "Paste TYPESAFE_API_KEY" -AsSecureString
Set-TypeSafeCredential -Secret $secret
Write-Host "Saved in Windows Credential Manager."
Write-Host "Future .\start.ps1 runs will load it automatically."
