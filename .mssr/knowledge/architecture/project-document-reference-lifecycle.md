# Project document reference lifecycle

MSSR owns the portable lifecycle that makes durable project documentation discoverable without turning heuristics into repository truth. The repository still owns meaning; hosts such as Bridge provide authorized I/O only.

## States

A document moves through four distinct states:

1. **Unobserved** — it exists outside selectable MSSR context.
2. **Candidate** — bounded Project Context Health discovery found it. Path/name evidence requests review only; it has no truth authority and causes no manifest write.
3. **Provisional evidence** — `reference-on-miss` may read one bounded disconnected candidate when selected context is insufficient. The result stays `candidate-only`, advisory and non-routing. Reading never promotes it.
4. **Explicitly connected** — reviewed persistence registers its exact source in `.mssr/project-context.json`, or selectable `.mssr` context explicitly points to it. Only this state joins normal durable context selection.

Discovery may suggest; only explicit review may connect.

## Retroactive discovery

Health scans bounded root Markdown plus conventional `docs/`, `documentation/` and `design/` surfaces, excluding generated/history noise. Current-looking filenames affect review priority, never ownership. Strong disconnected candidates can raise `REVIEW_PROJECT_DOC_REFERENCES`; medium/low candidates remain visible without independently raising project-wide attention.

An exact manifest source or exact project-relative pointer from selectable `.mssr` context counts as connected. Basename similarity, model judgment, telemetry or repeated access do not.

## Reference-on-miss

This is recovery, not a second index. It chooses only from the current disconnected-candidate audit after normal context is insufficient. Selection is bounded and deterministic; no-match or unresolved ambiguity abstains. Returned evidence carries exact path/hash and is always `candidate-only`, `advisoryOnly=true`, `truthAuthority=false`, `routingInfluence=false` and `canonicalRewriteAllowed=false`.

Repeated usefulness may justify a registration proposal, but never automatic promotion.

## Forward registration

A workflow that deliberately creates or recognizes durable authority should register it explicitly instead of waiting for future discovery. Planning validates exact source/module identity, bounded Markdown, existing ownership and current source/manifest hashes without writing anything.

Applying is a separate persistence action requiring exact path confirmation plus the expected source and manifest hashes. It writes and reads back the manifest, then verifies the document is no longer disconnected. Discovery, on-miss, notices, learning or model output cannot authorize this operation implicitly.

## Rename, deletion, freshness

A missing declared source remains exact health debt. A renamed current-looking document may appear independently as a new candidate; MSSR never infers replacement identity. Deletion removes that candidate but not the stale declared owner. Any source/manifest hash change invalidates a pending registration plan.

## Human projections

Dashboards/Cockpits may summarize these states and pending review, but remain projections linked to canonical evidence rather than a second source of truth.
