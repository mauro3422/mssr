# Project Context Plane architecture

MSSR project knowledge uses `.mssr/` as the only active project-control home. `PROJECT_CONTEXT.md`, `PROJECT_MEMORY.md`, and `PROJECT_STATE.md` are compact cross-area authorities; `.mssr/project-context.json` is the single selective manifest. Situational project-local detail belongs under `.mssr/knowledge/<topic>/` and is loaded only when its stage/intent selectors match.

Knowledge records separate physical authority from semantic topic. `kind` is `context`, `memory`, `state`, or scoped `directive`; `topic` is one of `architecture`, `design`, `law`, `pattern`, `vocabulary`, `decision`, `state`, `phase`, `reference`, `operations`, or `other`, with an optional project-local `area`.

Optional `kind: "memory"` modules are reference-backed under `.mssr/knowledge/<topic>/` by default. `PROJECT_MEMORY.md` is reserved for compact core/cross-area durable memory rather than acting as a section container for selectable memories. Multiple optional memory modules backed by the root authority are preventive `root-backed-memory-fanout` debt even before the file is large; modularization moves exact indexed bytes to refs while preserving module identity and selectors. `.mssr/project-context.json` remains the only selector manifest.

`.mssr/runtime/` owns reconstructable inbox/receipt/cache state and is Git-ignored. Runtime evidence can trigger review but never becomes durable truth by itself. MSSR does not read project authorities, manifests, or inbox state from `.bridge/`.

`initializeMssrProject` and `initializeMssrWorkspace` establish/normalize the contract idempotently. Project Context Health detects missing/invalid initialization, active legacy artifacts, oversized authorities/modules, missing module sources, excessive module counts, and unindexed knowledge. `WATCH` is advisory; `REVIEW` is a maintenance/replan signal. Neither level authorizes an automatic durable rewrite.

## Budget pressure preflight

Project Context Health evaluates each manifest entry against its declared `maxChars`. Hosts that can materialize proposed Markdown run preflight before writes: WATCH starts at 75%, REVIEW at 90%, and overflow is an invalid projected contract. REVIEW recommends `skill-maintenance-loop` plus `project_context_modularization_plan`; budgets are not raised to hide pressure.

## Cross-cutting mutation contracts

A selective module may declare `requiredWhen: { mutation: true, artifacts?: [...] }`. When structured intent proves a mutation (non-read-only risk or an explicit mutating action) and any declared artifact scope overlaps, the module becomes effectively required before semantic ranking and reserves required-context budget. Read-only work does not activate it; declarations remain repository-owned and do not grant permission. Use this for bounded critical invariants such as encoding/localization, packaging, trust boundaries, or runtime payload rules that must not disappear merely because subsystem intent is narrow.
