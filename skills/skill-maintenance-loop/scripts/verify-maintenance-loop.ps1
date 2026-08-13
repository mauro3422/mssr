[CmdletBinding()]
param(
    [string]$SkillsRoot = "D:\Dev\mauroprime-skills",
    [string]$MssrRoot = "D:\Dev\mssr",
    [string]$BridgeRoot = "D:\Dev\bridge-mcp",
    [ValidateSet("none", "source", "full")]
    [string]$BridgeMode = "source"
)

$ErrorActionPreference = "Stop"

# Developer repositories may live on another volume while the conventional C:\Dev
# path is absent or an empty placeholder. Resolve only when the requested root does
# not contain the expected package; an explicit valid root always wins.
if (-not (Test-Path -LiteralPath (Join-Path $MssrRoot "package.json") -PathType Leaf)) {
    $alternateMssrRoot = "D:\Dev\mssr"
    if (Test-Path -LiteralPath (Join-Path $alternateMssrRoot "package.json") -PathType Leaf) {
        $MssrRoot = $alternateMssrRoot
    }
}

$startedAt = Get-Date
$results = New-Object System.Collections.Generic.List[object]

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) {
        throw "Missing working directory for '$Name': $WorkingDirectory"
    }

    $stepStart = Get-Date
    Write-Host "[maintenance-loop] $Name" -ForegroundColor Cyan
    Push-Location $WorkingDirectory
    try {
        & $Action
        if ($LASTEXITCODE -ne $null -and $LASTEXITCODE -ne 0) {
            throw "Step '$Name' exited with code $LASTEXITCODE"
        }
        $results.Add([pscustomobject]@{
            name = $Name
            ok = $true
            durationMs = [int]((Get-Date) - $stepStart).TotalMilliseconds
        })
    }
    catch {
        $results.Add([pscustomobject]@{
            name = $Name
            ok = $false
            durationMs = [int]((Get-Date) - $stepStart).TotalMilliseconds
            error = $_.Exception.Message
        })
        throw
    }
    finally {
        Pop-Location
    }
}

try {
    Invoke-Step "mssr:first-party-learning-review-proposal-regression" $MssrRoot { python ".\skills\skill-maintenance-loop\scripts\build_change_proposal.py" --self-test }
    Invoke-Step "skills:install-junctions" $SkillsRoot { & ".\scripts\install-junctions.ps1" }
    Invoke-Step "skills:junction-replacement-regression" $SkillsRoot { & ".\scripts\test-install-junctions.ps1" }
    Invoke-Step "skills:verify" $SkillsRoot { & ".\scripts\verify-skills.ps1" }
    Invoke-Step "skills:codex-discovery" $SkillsRoot { & ".\scripts\test-codex-discovery.ps1" }
    Invoke-Step "skills:diff-check" $SkillsRoot { git diff --check }

    Invoke-Step "mssr:check" $MssrRoot { npm.cmd run check }
    Invoke-Step "mssr:build" $MssrRoot { npm.cmd run build }
    Invoke-Step "mssr:routing" $MssrRoot { npm.cmd run test:skill-routing }
    Invoke-Step "mssr:audit" $MssrRoot { python scripts\audit-skills.py }
    Invoke-Step "mssr:diff-check" $MssrRoot { git diff --check }

    if ($BridgeMode -ne "none") {
        Invoke-Step "bridge:check" $BridgeRoot { npm.cmd run check }
        Invoke-Step "bridge:build" $BridgeRoot { npm.cmd run build }
        Invoke-Step "bridge:regressions" $BridgeRoot { npm.cmd run test:regressions }
        Invoke-Step "bridge:routing" $BridgeRoot { npm.cmd run test:skill-routing }
        Invoke-Step "bridge:docs" $BridgeRoot { npm.cmd run docs:tools:check }
        Invoke-Step "bridge:diff-check" $BridgeRoot { git diff --check }
    }

    if ($BridgeMode -eq "full") {
        Invoke-Step "bridge:full-live-verification" $BridgeRoot { npm.cmd run verify:all }
    }

    $summary = [pscustomobject]@{
        ok = $true
        bridgeMode = $BridgeMode
        durationMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
        results = $results
        note = if ($BridgeMode -eq "source") {
            "Source checks passed. Restart and live-version/catalog verification remain a separate release gate."
        } elseif ($BridgeMode -eq "none") {
            "Bridge checks were skipped explicitly."
        } else {
            "Source and live Bridge verification passed."
        }
    }
    $summary | ConvertTo-Json -Depth 6
    exit 0
}
catch {
    [pscustomobject]@{
        ok = $false
        bridgeMode = $BridgeMode
        durationMs = [int]((Get-Date) - $startedAt).TotalMilliseconds
        error = $_.Exception.Message
        results = $results
    } | ConvertTo-Json -Depth 6
    exit 1
}
