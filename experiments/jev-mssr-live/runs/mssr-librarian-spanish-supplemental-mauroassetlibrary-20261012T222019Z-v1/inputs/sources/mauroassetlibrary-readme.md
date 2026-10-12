# Mauro Asset Library

A local, static, cross-project library for visual/game assets. It reuses the strongest ideas from the MyceliumFront visual dashboard—logical asset identity, versions, evidence, hashes, review state and provenance—without making MyceliumFront the owner of assets from other projects.

## What it owns

This repository owns only:

- provider adapters;
- normalized cross-project manifests;
- a static dashboard that works from `file://`;
- derived presentation previews copied from provider review images;
- integrity and approval-gate verification.

The original projects keep ownership of `.blend`, `.glb`, Godot scenes, Roblox places, scripts, approval manifests and all other canonical source/runtime files.

## Current providers

- **MyceliumFront** — consumes `evidence/visual-benchmarks/dashboard/manifest.json`; every existing `assetTrack` becomes a namespaced library asset and its original Mycelium detail dashboard remains the deep-detail destination.
- **Electronics Repair Simulator** — consumes explicit approval/completion/review/validation evidence for Workbench, Portable Radio, A1 Screwdriver, A2 Battery Compartment Insert, A3 Battery Contacts and A4 Battery Cell.

## Identity

```text
projectId/assetTrackId
projectId/assetTrackId/runId
```

Technical packages, folders and engines are metadata. They do not merge logical histories.

## Commands

```powershell
npm run build
npm run verify
npm test
.\open-dashboard.cmd
```

`npm run build` recreates `dist/`. `npm run verify` reads that generated output back and verifies provider source existence, bytes/hashes, preview copies, namespaced identity, provider counts and approval gates.

## Safety contract

Only PNG/JPEG/WebP presentation derivatives may be copied into `dist/previews/`. The build fails if forbidden canonical formats such as `.blend`, `.glb`, `.rbxl`, `.rbxlx` or `.tscn` appear inside generated output.

Declared provider hashes are validation inputs. Immutable previews must match exactly or the build fails. Canonical working sources are measured independently: when a live `.blend` no longer matches its validated snapshot, the library preserves both hashes and publishes the asset only as `blocked-source-drift`; it never rewrites the expected hash or calls the changed source validated.

## Human approval is independent

A technical pass does not imply human approval. The initial A4 Battery Cell record intentionally demonstrates this: Blender validation is `63/63 PASS`, while human visual approval remains pending and export/Godot permissions remain blocked. The dashboard must preserve that distinction.

## Adding another project

1. Add a provider to `projects/projects.json`.
2. Implement a read-only adapter in `src/adapters/`.
3. Prefer the provider's structured identities/statuses over filename inference.
4. Return canonical source evidence and one presentation preview per logical asset.
5. Add provider-specific invariants to `src/verify.mjs` only when they protect a real durable contract.
6. Run `npm test` and visually inspect the generated dashboard before considering the provider integrated.

`dist/` is generated and intentionally ignored by Git. Rebuild it whenever provider evidence changes.
