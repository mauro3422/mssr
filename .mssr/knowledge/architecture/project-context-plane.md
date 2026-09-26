# Project Context Plane architecture

MSSR owns project-context selection, budgeting, health, maintenance and continuity. `.mssr/` is the only active project-control home: PROJECT_* files are compact cross-area authorities, `.mssr/project-context.json` is the selective manifest, and situational detail lives in indexed `.mssr/knowledge/<topic>/` modules. Bridge and other hosts own authorized filesystem/runtime I/O plus delivery/transport; they expose MSSR operations but do not define context meaning.

Knowledge separates authority from classification. `kind` is `context`, `memory`, `state` or scoped `directive`; `topic` classifies the knowledge with optional local `area`. Optional memory is reference-backed by default so `PROJECT_MEMORY.md` stays compact. `.mssr/runtime/` contains reconstructable inbox/receipt/cache/lock state and is not durable truth. MSSR never retrieves project authority from `.bridge/`.

Initialization establishes this contract. Project Context Health detects invalid initialization, legacy artifacts, missing sources, unindexed knowledge and budget pressure. Project-document discoverability, candidate-only recovery, explicit forward registration and rename/delete semantics are defined separately in [Project document reference lifecycle](project-document-reference-lifecycle.md); discovery remains advisory and never establishes ownership or writes the manifest by itself. WATCH starts at 75% of declared `maxChars`; REVIEW at 90%. Budgets are not raised to conceal pressure.

## Maintenance and write preflight

Write preflight measures selected bytes; overflow is invalid. Segmented parents budget `baseline + largest optional segment` separately from physical growth. Backing files keep the 65,536-byte maintenance budget (WATCH 75%, REVIEW 90%) plus a 262,144-byte recovery hard limit. Growth into REVIEW is blocked and shrinking pressured sources remains valid.

MSSR may automatically perform only a semantics-preserving structural move: relocate one exact already-indexed non-core Markdown section into `.mssr/knowledge/` while preserving module id, kind, selectors and bytes. Source/manifest hashes, destination collisions, atomic writes, rollback and readback are checked. MSSR abstains when another selector overlaps those bytes, a whole-file consumer exists, the destination conflicts or source identity changed.

Core narrowing, whole-file semantic segmentation, selector invention, summarization and reclassification require explicit review. Notices, telemetry and learning may surface maintenance evidence but cannot authorize those changes. Bridge never becomes the semantic owner.

## Cross-cutting mutation contracts

A module may declare `requiredWhen: { mutation: true, artifacts?: [...] }`. Matching structured mutation intent makes it required before ranking; read-only work does not. Applicability is repository-declared and budgeted, never inferred from prose and never permission to mutate.
