$ErrorActionPreference = "Stop"
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\install-first-party-skills.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mssr-first-party-installer-" + [Guid]::NewGuid().ToString("N"))

function Remove-TestJunction([string]$PathValue) {
  $item = Get-Item -LiteralPath $PathValue -Force
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    [System.IO.Directory]::Delete($PathValue, $false)
  } else {
    Remove-Item -LiteralPath $PathValue -Recurse -Force
  }
}

try {
  $project = Join-Path $tempRoot "project"
  $runtime = Join-Path $tempRoot "runtime"
  $backup = Join-Path $tempRoot "backup"
  New-Item -ItemType Directory -Path (Join-Path $project "config"), $runtime | Out-Null
  $manifest = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) "config\first-party-skills.json") -Raw
  Set-Content -LiteralPath (Join-Path $project "config\first-party-skills.json") -Value $manifest -Encoding utf8
  $names = @((ConvertFrom-Json $manifest).skills | ForEach-Object { [string]$_.name })
  foreach ($name in $names) {
    $source = Join-Path $project ("skills\" + $name)
    New-Item -ItemType Directory -Path $source -Force | Out-Null
    Set-Content -LiteralPath (Join-Path $source "SKILL.md") -Value "---`nname: $name`ndescription: Sandboxed installer test.`n---`n" -Encoding utf8
  }

  & $installer -ProjectRoot $project -CodexSkillsRoot $runtime
  foreach ($name in $names) {
    $target = Join-Path $runtime $name
    if (-not ((Get-Item -LiteralPath $target -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { throw "Expected junction was not created: $target" }
  }

  $blockedName = $names[0]
  $blockedTarget = Join-Path $runtime $blockedName
  Remove-TestJunction $blockedTarget
  New-Item -ItemType Directory -Path $blockedTarget | Out-Null
  Set-Content -LiteralPath (Join-Path $blockedTarget "keep.txt") -Value "do not overwrite" -Encoding utf8
  $blocked = $false
  try { & $installer -ProjectRoot $project -CodexSkillsRoot $runtime } catch { $blocked = $true }
  if (-not $blocked -or -not (Test-Path -LiteralPath (Join-Path $blockedTarget "keep.txt"))) { throw "Installer did not preserve an unexpected existing path" }

  & $installer -ProjectRoot $project -CodexSkillsRoot $runtime -ReplaceExisting -BackupRoot $backup
  if (-not (Test-Path -LiteralPath (Join-Path $backup "$blockedName\keep.txt"))) { throw "Replace mode did not back up the replaced directory" }

  $junctionName = $names[1]
  $junctionTarget = Join-Path $runtime $junctionName
  $external = Join-Path $tempRoot "external-skill"
  Remove-TestJunction $junctionTarget
  New-Item -ItemType Directory -Path $external | Out-Null
  Set-Content -LiteralPath (Join-Path $external "sentinel.txt") -Value "external remains" -Encoding utf8
  New-Item -ItemType Junction -Path $junctionTarget -Target $external | Out-Null
  & $installer -ProjectRoot $project -CodexSkillsRoot $runtime -ReplaceExisting -BackupRoot $backup
  if (-not (Test-Path -LiteralPath (Join-Path $backup "$junctionName.junction.json")) -or -not (Test-Path -LiteralPath (Join-Path $external "sentinel.txt"))) { throw "Replace mode did not safely record an unexpected junction" }

  $unrelated = Join-Path $runtime "unrelated-skill"
  New-Item -ItemType Directory -Path $unrelated | Out-Null
  & $installer -ProjectRoot $project -CodexSkillsRoot $runtime
  if (-not (Test-Path -LiteralPath $unrelated)) { throw "Installer touched a non-reserved Codex skill path" }
  Write-Host "first-party installer sandbox test passed"
} finally {
  if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force }
}
