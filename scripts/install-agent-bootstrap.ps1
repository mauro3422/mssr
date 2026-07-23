[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter()]
    [string]$TargetPath = "C:\Users\mauro\.codex\AGENTS.md",

    [Parameter()]
    [switch]$NoBackup
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $PSCommandPath
$repositoryRoot = Split-Path -Parent $scriptRoot
$templatePath = Join-Path $repositoryRoot "templates\AGENTS.mssr.md"
$startMarker = "<!-- mssr:managed:start -->"
$endMarker = "<!-- mssr:managed:end -->"

if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    throw "MSSR bootstrap template is missing: $templatePath"
}

$template = [System.IO.File]::ReadAllText($templatePath).Trim() + [Environment]::NewLine
$targetDirectory = Split-Path -Parent $TargetPath
if ($targetDirectory -and -not (Test-Path -LiteralPath $targetDirectory)) {
    if ($PSCmdlet.ShouldProcess($targetDirectory, "Create target directory")) {
        New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
    }
}

$existing = if (Test-Path -LiteralPath $TargetPath -PathType Leaf) {
    [System.IO.File]::ReadAllText($TargetPath)
} else { "" }

$pattern = "(?s)$([regex]::Escape($startMarker)).*?$([regex]::Escape($endMarker))\s*"
$managedMatch = [regex]::Match($existing, $pattern)
$updated = if ($managedMatch.Success) {
    $existing.Substring(0, $managedMatch.Index) +
        $template +
        $existing.Substring($managedMatch.Index + $managedMatch.Length)
} elseif ([string]::IsNullOrWhiteSpace($existing)) {
    $template
} else {
    $template + [Environment]::NewLine + $existing.TrimStart()
}

if ($updated -ceq $existing) {
    Write-Output "MSSR bootstrap already current: $TargetPath"
    return
}

if ((Test-Path -LiteralPath $TargetPath -PathType Leaf) -and -not $NoBackup) {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = "$TargetPath.mssr-backup-$timestamp"
    if ($PSCmdlet.ShouldProcess($backupPath, "Create backup")) {
        Copy-Item -LiteralPath $TargetPath -Destination $backupPath -Force
    }
}

if ($PSCmdlet.ShouldProcess($TargetPath, "Install/update managed MSSR bootstrap")) {
    [System.IO.File]::WriteAllText($TargetPath, $updated, [System.Text.UTF8Encoding]::new($false))
    Write-Output "Installed MSSR bootstrap: $TargetPath"
}
