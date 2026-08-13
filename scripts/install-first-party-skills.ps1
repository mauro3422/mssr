[CmdletBinding()]
param(
  [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$CodexSkillsRoot = (Join-Path $env:USERPROFILE ".codex\skills"),
  [switch]$ReplaceExisting,
  [string]$BackupRoot
)

$ErrorActionPreference = "Stop"

function Resolve-FullPath([string]$PathValue) {
  return [System.IO.Path]::GetFullPath($PathValue)
}

function Read-FirstPartyManifest([string]$Root) {
  $manifestPath = Join-Path $Root "config\first-party-skills.json"
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "First-party manifest was not found: $manifestPath"
  }
  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  if ($manifest.schemaVersion -ne 1 -or $null -eq $manifest.skills -or $manifest.skills.Count -lt 1) {
    throw "First-party manifest is invalid: $manifestPath"
  }
  $names = @($manifest.skills | ForEach-Object { [string]$_.name })
  if (($names | Where-Object { $_ -notmatch '^[a-z0-9][a-z0-9-]{0,159}$' }).Count -gt 0 -or ($names | Select-Object -Unique).Count -ne $names.Count) {
    throw "First-party manifest has invalid or duplicate skill names: $manifestPath"
  }
  return $names
}

function Get-SkillFrontmatterName([string]$SkillFile) {
  $text = Get-Content -LiteralPath $SkillFile -Raw
  if ($text -notmatch '(?ms)^---\s*\r?\n(.*?)\r?\n---') { throw "SKILL.md is missing frontmatter: $SkillFile" }
  $frontmatter = $Matches[1]
  if ($frontmatter -notmatch '(?m)^name:\s*["'']?([^"''\r\n#]+?)["'']?\s*$') { throw "SKILL.md is missing a valid name: $SkillFile" }
  $name = $Matches[1].Trim()
  if ($name -notmatch '^[a-z0-9][a-z0-9-]{0,159}$') { throw "SKILL.md frontmatter name is invalid: $SkillFile" }
  return $name
}

function Test-ExpectedJunction([string]$Target, [string]$Source) {
  $item = Get-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue
  if ($null -eq $item -or -not ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { return $false }
  $reportedTargets = @($item.Target | Where-Object { $_ })
  if ($reportedTargets.Count -ne 1) { return $false }
  try { return ((Resolve-FullPath ([string]$reportedTargets[0])).TrimEnd('\\') -ieq (Resolve-FullPath $Source).TrimEnd('\\')) } catch { return $false }
}

function Backup-And-RemoveTarget([string]$Target, [string]$Name, [string]$DestinationRoot) {
  $item = Get-Item -LiteralPath $Target -Force -ErrorAction Stop
  New-Item -ItemType Directory -Path $DestinationRoot -Force | Out-Null
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    $record = [ordered]@{
      replacedAt = [DateTime]::UtcNow.ToString("o")
      path = $Target
      target = @($item.Target)
      linkType = if ($item.LinkType) { $item.LinkType } else { "reparse-point" }
    }
    $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DestinationRoot "$Name.junction.json") -Encoding utf8
    [System.IO.Directory]::Delete($Target, $false)
    return
  }
  $backupTarget = Join-Path $DestinationRoot $Name
  if (Test-Path -LiteralPath $backupTarget) { throw "Backup target already exists: $backupTarget" }
  Move-Item -LiteralPath $Target -Destination $backupTarget
}

$ProjectRoot = Resolve-FullPath $ProjectRoot
$CodexSkillsRoot = Resolve-FullPath $CodexSkillsRoot
$names = Read-FirstPartyManifest $ProjectRoot
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $ProjectRoot (".mssr\first-party-skill-backups\" + [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssfff") + "-" + [Guid]::NewGuid().ToString("N"))
} else {
  $BackupRoot = Resolve-FullPath $BackupRoot
}

New-Item -ItemType Directory -Path $CodexSkillsRoot -Force | Out-Null
foreach ($name in $names) {
  # Both locations are assembled only from a validated manifest name. This
  # installer never enumerates or mutates arbitrary Codex skill directories.
  $source = Join-Path $ProjectRoot ("skills\" + $name)
  $skillFile = Join-Path $source "SKILL.md"
  $target = Join-Path $CodexSkillsRoot $name
  if (-not (Test-Path -LiteralPath $source -PathType Container) -or -not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
    throw "Bundled first-party skill source is missing: $source"
  }
  if ((Get-SkillFrontmatterName $skillFile) -cne $name) {
    throw "Bundled first-party skill frontmatter name does not match manifest target: $name"
  }
  if (Test-ExpectedJunction $target $source) {
    Write-Host "Kept expected junction: $target"
    continue
  }
  if (Get-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue) {
    if (-not $ReplaceExisting) {
      throw "Refusing to replace unexpected existing Codex skill path: $target. Re-run with -ReplaceExisting and an explicit backup location if desired."
    }
    Backup-And-RemoveTarget $target $name $BackupRoot
  }
  New-Item -ItemType Junction -Path $target -Target $source | Out-Null
  if (-not (Test-ExpectedJunction $target $source)) { throw "Failed to create expected Codex junction: $target" }
  Write-Host "Installed first-party junction: $target"
}
