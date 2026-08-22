# First-party skills v1: distribution, migration, and evaluation

This guide distributes the five bundled MSSR skills without publishing a
package, replacing a user skill unexpectedly, or making runtime discovery an
authority over Git-tracked sources.

## Scope and invariants

The v1 bundle is the exact manifest in
`config/first-party-skills.json`: `mssr-agent-routing`,
`shared-skill-governance`, `skill-routing-maintainer`,
`skill-maintenance-loop`, and `mssr-observability-maintenance`.

- `D:\Dev\mssr\skills` is their source of truth.
- `C:\Users\mauro\.codex\skills\<name>` is an opt-in directory junction.
- The installer touches only manifest names and refuses an unexpected target by
  default. Replacement requires an explicit backup location.
- A junction or byte-identical mounted source is an alias; a divergent reserved
  name is a blocking provenance conflict.
- The bundle is advisory. Installing it neither enables a skill for every task
  nor changes tool permissions, routing requirements, or host responsibility.

## Package preflight

From a clean intended checkout, run:

```powershell
npm run check
npm run test:first-party-skills
pwsh -NoProfile -File .\scripts\test-install-first-party-skills.ps1
```

`test:first-party-skills` verifies manifest/source/frontmatter identity and
uses `npm pack --dry-run`; it does not publish or create a tarball. The
installer test is sandboxed in a temporary directory and proves refusal,
backup, junction replacement, and preservation of unrelated runtime skills.

For the complete local v1 gate (including routing/context and no external
publication), run:

```powershell
pwsh -NoProfile -File .\scripts\verify-first-party-skills-v1.ps1
```

## Opt-in migration

First inspect rather than replace:

```powershell
Get-Item C:\Users\mauro\.codex\skills\mssr-agent-routing -Force |
  Format-List FullName,LinkType,Target,Attributes
```

Then install only when each target is absent or already the expected junction:

```powershell
pwsh -NoProfile -File .\scripts\install-first-party-skills.ps1
```

If a reserved target is a divergent local directory or junction, stop and
review it. Only after preserving its recovery location may an operator opt into
replacement:

```powershell
pwsh -NoProfile -File .\scripts\install-first-party-skills.ps1 `
  -ReplaceExisting -BackupRoot D:\Dev\mssr\.mssr\first-party-skill-backups\manual-review
```

Do not migrate `.system`, plugin cache, custom non-reserved skills, or live
Roblox MCP skills. The installer deliberately has no uninstall or bulk-cleanup
mode. To roll back an installation, remove only a verified expected junction
and restore the recorded backup manually; never recursively remove the runtime
skills root.

## Runtime and routing evaluation

After installation, prove the mount rather than assuming it:

```powershell
Get-Item C:\Users\mauro\.codex\skills\mssr-agent-routing -Force |
  Format-List FullName,LinkType,Target
npm run test:skill-context
npm run test:skill-routing
npm run audit:check
```

The five roots use progressive disclosure. A root `SKILL.md` is a compact
control plane; `context-modules.json` selects direct internal references by
structured intent, stage, and signals. This does not create independently
routable child skills or alter activation metadata.

Evaluate delivery with three independent questions:

1. **Package integrity:** all manifest files and references are in dry-run
   packaging, and frontmatter matches the reserved name.
2. **Migration safety:** the installer creates expected junctions, refuses
   unexpected targets, and preserves unrelated runtime skills.
3. **Context effectiveness:** an applicable route gets the root core plus only
   selected modules; a nearby non-matching route does not receive unrelated
   procedure. Compare `coreCharsLoaded`, `moduleCharsLoaded`,
   `estimatedCharsSaved`, selections, and budget deferrals from bootstrap.

## Operational learning boundary

Skill distribution is not a learning promotion. Keep MSSR learning
`observe-only` and `routingInfluence=false`. Any future learned influence needs
the separate digest audit, historical replay/holdout, calibration, shadow
evaluation, explicit versioned feature flag, rollback, and human review gates
described in [`LEARNING_LOOP.md`](LEARNING_LOOP.md). No installation result,
catalog discovery, acceptance count, or package test authorizes automatic
routing changes.
