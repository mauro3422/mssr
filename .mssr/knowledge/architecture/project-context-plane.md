# Project Context Plane architecture

MSSR owns project-context selection, budgeting, health, maintenance and continuity. `.mssr/` is the only active project-control home: PROJECT_* files are compact cross-area authorities, `.mssr/project-context.json` is the selective manifest, and situational detail lives in indexed `.mssr/knowledge/<topic>/` modules. Bridge and other hosts own authorized filesystem/runtime I/O plus delivery/transport; they expose MSSR operations but do not define context meaning.

Knowledge separates authority from classification. `kind` is `context`, `memory`, `state` or scoped `directive`; `topic` classifies the knowledge with optional local `area`. Optional memory is reference-backed by default so `PROJECT_MEMORY.md` stays compact. `.mssr/runtime/` contains reconstructable inbox/receipt/cache/lock state and is not durable truth. MSSR never retrieves project authority from `.bridge/`.

Initialization establishes this contract. Project Context Health detects invalid initialization, legacy artifacts, missing sources, unindexed knowledge and budget pressure. WATCH starts at 75% of declared `maxChars`; REVIEW at 90%. Budgets are not raised to conceal pressure.

## Maintenance and write preflight

A proposed write is measured by selected bytes. Overflow is invalid. For segmented parents, the selected budget is `baseline + largest optional segment`; physical growth is separate. Backing files use the normal 65,536-byte maintenance budget (WATCH 75%, REVIEW 90%) plus a 262,144-byte recovery hard limit so pressured history remains readable for repair. Growth into either REVIEW is blocked and returns `mssr_project_maintain`; hard-limit overflow is invalid, while shrinking pressured sources remains valid.

MSSR may automatically perform only a semantics-preserving structural move: relocate one exact already-indexed non-core Markdown section into `.mssr/knowledge/` while preserving module id, kind, selectors and bytes. Source/manifest hashes, destination collisions, atomic writes, rollback and readback are checked. MSSR abstains when another selector overlaps those bytes, a whole-file consumer exists, the destination conflicts or source identity changed.

Core narrowing, whole-file semantic segmentation, selector invention, summarization and reclassification remain explicit review work. Notices, telemetry and learning may surface maintenance evidence but cannot authorize or synthesize those changes. MSSR therefore maintains its context structure without making Bridge a semantic owner or silently rewriting project meaning.

## Cross-cutting mutation contracts

A module may declare `requiredWhen: { mutation: true, artifacts?: [...] }`. Matching structured mutation intent makes it required before ranking; read-only work does not. Applicability is repository-declared and budgeted, never inferred from prose and never permission to mutate.
