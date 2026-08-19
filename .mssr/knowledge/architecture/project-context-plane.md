# Project Context Plane architecture

MSSR project knowledge uses `.mssr/` as the only active project-control home. `PROJECT_CONTEXT.md`, `PROJECT_MEMORY.md`, and `PROJECT_STATE.md` are compact cross-area authorities; `.mssr/project-context.json` is the single selective manifest. Situational project-local detail belongs under `.mssr/knowledge/<topic>/` and is loaded only when its stage/intent selectors match.

Knowledge records separate physical authority from semantic topic. `kind` is `context`, `memory`, `state`, or scoped `directive`; `topic` is one of `architecture`, `design`, `law`, `pattern`, `vocabulary`, `decision`, `state`, `phase`, `reference`, `operations`, or `other`, with an optional project-local `area`.

`.mssr/runtime/` owns reconstructable inbox/receipt/cache state and is Git-ignored. Runtime evidence can trigger review but never becomes durable truth by itself. MSSR does not read project authorities, manifests, or inbox state from `.bridge/`.

`initializeMssrProject` and `initializeMssrWorkspace` establish/normalize the contract idempotently. Project Context Health detects missing/invalid initialization, active legacy artifacts, oversized authorities/modules, missing module sources, excessive module counts, and unindexed knowledge. `WATCH` is advisory; `REVIEW` is a maintenance/replan signal. Neither level authorizes an automatic durable rewrite.
