# MSSR repository structure

## Ownership

This repository is the portable source of truth for MSSR — Modular Semantic Skill Router. It owns advisory classification/routing contracts, provider registry normalization, fixtures, audits and the optional MCP facade. It does not own local tool execution, Bridge transport, ChatGPT UI or project-specific state.

## Canonical layout

```text
src/
├── skill-routing.ts       deterministic routing engine and public intent vocabulary
├── intent-normalizer.ts   portable canonical intent normalization and recovery hints
├── context-selection.ts   generic deterministic semantic module selector
├── skill-context.ts       skill context manifest and selector adapter
├── project-context.ts     modular project context/directive manifest and selector adapter
├── project-context-update.ts pure stable-section and manifest-module update helpers
├── registry.ts            provider snapshots, provenance and degradation state
├── mcp-server.ts          optional MCP facade
└── index.ts               package exports

config/skill-routing/
├── skill-routing.schema.json
├── skill-routing-overrides.json
├── skill-routing-fixtures.json
└── skill-routing-vocabulary.json

config/skill-context/
  Skill context manifest schema and deterministic fixtures.

config/project-context/
  Portable `.bridge/project-context.json` manifest schema.

scripts/
  Core, registry, MCP, routing, skill-context, project-context and intent-normalization tests plus the skill audit generator.

templates/
  Managed bootstrap/instruction templates.

docs/
  Architecture, public protocol, project context, registry, maintenance and incident history.
```

## Aggregate routing files

`skill-routing-overrides.json` and `skill-routing-fixtures.json` are intentionally single canonical aggregates today. Their size is a maintenance signal, not permission to create parallel editable fragments.

Do not split them manually unless a deterministic aggregation system is added in the same change. A valid future partition must provide:

1. one documented source directory for fragments;
2. deterministic ordering and byte-stable aggregate generation;
3. schema validation for every fragment and the aggregate;
4. globally unique workflow, skill and fixture identifiers;
5. duplicate/conflict detection before writing output;
6. a generated-file header or manifest identifying the source fragments;
7. a freshness gate that fails when the aggregate is stale;
8. unchanged routing results across the complete fixture suite;
9. migration and rollback instructions.

Until then, the aggregate JSON files remain the only editable routing authority.

## Generated and runtime outputs

The skill dashboard is generated under the Codex runtime tree:

```text
C:\Users\mauro\.codex\skills\_dashboard\
```

It is not an editable source and is not committed here. `scripts/audit-skills.py` regenerates it from the active skill/provider catalog and the versioned MSSR contract.

These repository paths are local/ignored runtime state:

```text
logs/
tmp/
dist/
node_modules/
.bridge/runtime/ when present
```

Do not turn generated dashboards, provider caches, logs or prompt dumps into a second contract.

## Cross-repository boundaries

```text
C:\Dev\mssr
  Portable routing contract and engine.

C:\Dev\mauroprime-skills
  Git source for Mauro's reusable custom skills.

C:\Users\mauro\.codex\skills
  Runtime junctions and installed/plugin/system providers.

C:\Dev\bridge-mcp
  ChatGPT/local adapter, provider discovery, content loading, observability and tools.

Project repositories
  Project-specific context, guides, facts and verification commands.
```

Bridge may re-export MSSR for compatibility, but must not fork the engine or hard-code an independent routing contract.

## Change classes

### Documentation-only

May update explanations and repository boundaries without changing routing semantics. Run at least `npm run check` and the relevant link/content review; `npm run verify` remains the preferred closure.

### Contract or fixture

Changes to vocabulary, schema, overrides, fixtures, workflows, dependencies, exclusions or phase semantics require:

```powershell
npm run verify
```

They also require changelog/maintenance documentation and Bridge integration verification when adapter behavior is affected.

### Engine or registry

Changes under `src/` require core, registry, MCP and routing tests, plus consumer verification. Preserve MSSR's advisory nature, bounded public intent and provider provenance/degradation semantics.

## Large-file policy

Current review hotspots include:

```text
config/skill-routing/skill-routing-fixtures.json
config/skill-routing/skill-routing-overrides.json
src/skill-routing.ts
docs/skill-routing/INCIDENTS.md
```

Do not split them solely by line count. Extract only around stable ownership boundaries with tests that prove public exports, ordering, fixture outcomes and generated artifacts remain equivalent. Incident history may be archived by dated index only after references and searchability are preserved.

## Hygiene checklist

```text
[ ] no Bridge-specific tool catalog copied into MSSR instructions
[ ] no project paths or state embedded in global routing metadata
[ ] no generated dashboard files staged
[ ] schema and vocabulary remain closed and documented
[ ] positive, nearby negative and continuation fixtures exist where required
[ ] provider provenance and degraded/stale states remain observable
[ ] npm run verify passes
[ ] downstream Bridge adapter verification passes when relevant
```
