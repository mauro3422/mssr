# Project context modularization

- **Type:** maintenance recipe
- **Owner:** skill-maintenance-loop
- **Read when:** Project Context Health or a pre-write budget preflight reports growing/oversized PROJECT_* authorities or modules, `root-backed-memory-fanout`, declared `maxChars` pressure, unindexed `.mssr/knowledge/`, or the project-context core is carrying situational detail.
- **Status:** active
- **Last reviewed:** 2026-08-20

## Model

Project context follows the same high-level separation as modular skills without turning project modules into skills:

- `AGENTS.md` = broad repository rules;
- `PROJECT_CONTEXT.md` = compact stable cross-area architecture/facts/invariants;
- `PROJECT_MEMORY.md` = compact root/core durable decisions/lessons, not a default bucket for optional memories;
- `PROJECT_STATE.md` = compact current state/handoff;
- `.mssr/knowledge/<topic>/` = selector-backed project refs selected by `.mssr/project-context.json`; optional `kind=memory` modules belong here by default;
- `.mssr/runtime/` = reconstructable state, never project truth.

Semantic `topic` (`architecture`, `design`, `law`, `pattern`, `vocabulary`, `decision`, `state`, `phase`, `reference`, `operations`, `other`) is independent from physical `kind` (`context`, `memory`, `state`, `directive`). `area` optionally narrows the subsystem. When review proves a critical rule must survive narrow subsystem intent only for a bounded mutation class, prefer explicit `requiredWhen.mutation=true` with optional artifact scope over bloating core or broadening semantic selectors. Never infer or auto-promote this applicability from prose alone.

## Decision ladder

1. Before changing a Markdown source referenced by `.mssr/project-context.json`, run the portable budget preflight against the proposed next text when the host can materialize it. `WATCH` means preserve headroom; projected `REVIEW` loads this maintenance recipe before the write; `contractValid=false` means narrow/split first instead of raising `maxChars`.
2. Run Project Context Health and freeze the relevant manifest/source hashes.
3. If an existing finding is only `WATCH` and no related write is planned, do not interrupt unrelated work; schedule/review during maintenance. `root-backed-memory-fanout` is preventive debt even when `PROJECT_MEMORY.md` is still small.
4. Run the portable modularization planner. For a root-backed optional memory, extraction is valid even when the selected section is below the ordinary large-section threshold: the problem is physical authority fanout, not section size.
5. Classify each candidate:
   - **indexed non-core section:** may be moved byte-for-byte to `.mssr/knowledge/<topic>/` while preserving parent kind/selectors;
   - **core section:** requires an explicit decision about the minimum invariant that must remain always loaded; never auto-extract the whole core merely to reduce size;
   - **large unindexed section:** review semantically first, then either curate it away as stale or capture a reviewed durable statement/module; never auto-index history just because it is large;
   - **runtime/transient material:** remove from durable authorities only after confirming it is reconstructable and not project truth.
6. Verify selected-context behavior before/after. Lower byte count is not success if the relevant task stops receiving required knowledge.

## Exact-move invariant

For an already-indexed section, prefer an exact move over summarization:

1. read source + manifest;
2. verify the planner section SHA-256 against current bytes;
3. write the exact selected Markdown block to the proposed `.mssr/knowledge/<topic>/...` file;
4. preserve the module id/kind/topic/area/selectors unless a reviewed split is explicitly required;
5. update only its source path/sections as necessary;
6. remove the exact original section from PROJECT_*;
7. validate manifest, destination hash, source absence, project-context materialization, and Project Context Health;
8. rollback both source and manifest if any gate fails.

If one module indexes multiple sections, prefer moving the module's selected sections together into one knowledge file so its activation contract remains unchanged. Splitting one module into multiple modules is a semantic routing change and requires explicit review/fixtures.

## Core rule

Core is not a cache of frequently useful detail. Keep only the minimum information needed to safely orient work before intent exists. Current phases, giant target descriptions, long completed histories, incidents, benchmarks, provider details and subsystem-specific recipes usually belong in selectable modules.

A core reduction must prove:

- the surviving core still identifies project/ownership/invariants/current entry point;
- relevant intent loads the extracted module;
- unrelated intent does not pay for it;
- resume/history paths still recover what they need;
- no duplicated stale copy remains in PROJECT_*.

## Automatic attention boundary

Watchers and health scans may automatically detect pressure and emit `WATCH/REVIEW/REQUIRED`, but they do not decide project truth. They may automatically schedule/load this recipe and a read-only planner. Actual semantic capture, core narrowing, deletion or module splitting remains a reviewed maintenance action.
