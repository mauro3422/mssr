# Jev Librarian integration and Git handoff

## Repository snapshot and preservation

The detailed pre-integration handoff is preserved at docs/history/jev-librarian-integration-handoff-pre-0.2.104.md; its branch and gate statements are historical. This indexed handoff is the compact current view.

The 2026-10-02 audit found `codex/jev-confidence-merge-evaluation` at `ad25a9a`, clean and 29 commits ahead of main. Its 255-path diff included 206 frozen Jev run files (53,079,986 bytes). At that time `codex/benchmark-archive` at `05ccb68` did not yet contain them; that statement is historical. On 2026-10-04 the separate archive branch contains frozen v1-v18 at `b4af87c`. Never merge the evaluation branch wholesale into product or rewrite/prune run manifests, outputs, labels, reviews or hashes.

## Product lineage audit

The 2026-10-02 review established `origin/main` (`dfb2956`) as the base and identified the dependency chain from semantic evidence through exact-handle retrieval and the 0.2.101 sidecar. The planned clean integration has since been completed: `codex/jev-citation-evidence-pack-clean` at `e3e0391` contains the reviewed product integration as MSSR 0.2.104, passes full verification/release gates, and excludes frozen run payloads. Keep the source/evaluation snapshot and benchmark archive separate; do not merge the 29-commit research branch wholesale.

The isolated Bridge 0.6.156/MSSR 0.2.104 candidate is pushed at `5a1dbf0` with candidate gates passing. Active Bridge remains 0.6.153/MSSR 0.2.101 and has not been replaced or restarted. Neither clean integration branch has been merged to main or published to npm.

## MSSR contract work

The 0.2.101 sidecar and package receipt remain preserved in the candidate receipts below. The D: source branch `codex/jev-citation-evidence-pack` remains MSSR 0.2.102 at `130447a`; this checkout is intentionally retained as that source line. Its clean main-rooted product integration continued separately as `codex/jev-citation-evidence-pack-clean` at `e3e0391` (MSSR 0.2.104); `npm run verify` and `npm run release:gate` passed. The package is 1,104,067 bytes, SHA-256 `714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca`. No main merge or npm publication occurred.

## 0.2.102 cited evidence-pack continuation — 2026-10-04

Current source work is on `codex/jev-citation-evidence-pack`, branched from the
verified local 0.2.101 commit `ba1599b`. It adds the read-only
`mssr_librarian_evidence_pack` MCP tool: up to 16 exact handles are re-fetched
from caller-supplied current Markdown and returned verbatim with per-range
owner/source/revision/line/fingerprint citations. Stale, duplicate, unmatched,
privacy-excluded or over-budget evidence fails closed. This endpoint provides exact evidence acquisition after Jev or host selection; it is one step in the Bibliotecario, not the whole system. The host can chain deterministic text/metadata retrieval, Jev choice and relation review, exact fetch, contradiction inspection, and citation packing. A host agent can then recover structure, compact evidence, and assemble cited paragraphs. The endpoint does not crawl beyond supplied sources or write canonical sources. `npm run verify` and
`npm run release:gate` passed. The unpublished local 0.2.102 package is
1,099,614 bytes, SHA-256
`a26e74b7dd8605a19062277615885bb63ba0d8e48cfb63c7d5f2640b1a24617b`
(`pkg:0.2.102#a26e74b7`); its full receipt is
`.mssr/runtime/releases/0.2.102.json`.

A real-document Jev -> evidence-pack smoke passed using three current MSSR
documents and eight exact candidates. One `typesafe-jev` / `jev-1.13.0` call
selected `changelogs/0.2.102.md` lines 1-29 (1,670 input / 127 output tokens,
480.6 ms; Choice 0.27; Noul 0.65). The caller-supplied source slice matched the
2,511-character packed range, and citation handle/source/revision/range/fingerprint
matched. These uncalibrated signals are not quality labels. Receipt:
`.mssr/runtime/jev-smokes/evidence-pack-20261004T032043309Z.json`; raw provider
output was not persisted.

The Codex user launcher enables Windows system CA trust only for the Jev child process and retains TLS validation; a standalone provider smoke passed. On 2026-10-04, MSSR bootstrap reports the active Codex MCP loaded build `ecf594115342fa3c`, available build `24589ca94bee83fd`, status `stale`. Adoption of the 0.2.104 build through the active Codex host is therefore unverified. After the user's restart/reload, re-read the exact build and run only the selection-to-evidence-pack plumbing smoke; this is separate from quality scoring. Do not restart the active Bridge as part of this work.

## Bridge candidate

The older 0.6.146 per-section review is historical: it read `.mssr/project-context.json` but did not consume the Librarian sidecar. The current isolated candidate is Bridge 0.6.156/MSSR 0.2.104 on `codex/jev-mssr-0.2.103-adoption-20261004` at `5a1dbf0`; vendored MSSR package identity and candidate release gates were verified. It is pushed but not deployed. Active Bridge remains 0.6.153/MSSR 0.2.101 and was not changed or restarted. Require a separate controlled adoption and live runtime readback; a candidate branch does not prove production use.

## 0.2.101 candidate receipts

The real-document smoke used the built 0.2.101 projection over four exact
headings in the current MSSR repository: 4 declarations projected, 4 metadata
searches returned the intended exact handles, and all 4 exact fetches passed.
Receipts are under ignored `.mssr/runtime/` as
`project-context-librarian-real-doc-smoke-20261002T223744Z.json`,
`project-context-librarian-real-doc-smoke-20261002T223846Z.json`, and the final
post-state-update receipt `project-context-librarian-real-doc-smoke-20261002T230440Z.json` (the earlier post-compaction check was `project-context-librarian-real-doc-smoke-20261002T224536Z.json`). Build id was
`mssr-build:sha256:ecf594115342fa3c`; sidecar SHA-256 was
`40cc2dc59afbf87a10db098c9ac96bb49e571fb90204e4f4a1efb3772b03c1af`.
This is integration evidence, not a retrieval-quality benchmark.

One actual Jev provider call used two metadata-filtered exact handles. Jev
selected “100 hipótesis de uso” (providerConfidence 0.82; evidence sufficiency
0.75, both explicitly uncalibrated/unverified); the returned exact handle then
fetched 7,728 UTF-16/code units with matching source fingerprint. The call used
828 input and 67 output tokens and took about 494 ms. Its bounded receipt is
`.mssr/runtime/project-context-librarian-jev-smoke-20261002T223846Z.json`; it
stores hashes and outcome metadata, not the raw query. The active MSSR MCP
server still advertises the old build `86070e2a0e734090`, so this proves the
current tool chain accepts a sidecar-derived handle; it does not prove host
adoption of package 0.2.101.

## Resolved verification friction

The first release-gate attempt stopped because root `CHANGELOG.md` still
identified 0.2.100. Updating its current-release pointer to 0.2.101 allowed
the full gate to pass. The first verify-stage route also rejected
`PROJECT_STATE.md`: its `## Current release` section had grown to 2,895
characters against the 2,500-character core budget. The summary was compacted
to 1,079 characters; receipts and details remain here, and routing plus the
real-document smoke passed afterward. These were documentation/state
maintenance issues, not sidecar runtime defects.

## Evaluation gates

MSSR 0.2.104 release verification passed; this is not a Jev quality result. Historical 48/51, 45/51, 31/52, 35/52, 34/52 and smoke scores remain exploratory: labels were author/Luna-created, ranges were incomplete and document holdouts overlapped or were opened during tuning. The 48/51 EvidenceAtom run covered 17 sections from four modules with repeated variants. The 21-document bilingual comparison scored 35/52, 34/52 and 31/52 on strict headings, not owner-adjudicated acceptable sets. Exact-fetch success proves handle integrity only.

In frozen live-gate runs v1 has an unknown provider-call count; v2-v18 have zero calls. V18 is offline preflight only. V17 route and bootstrap evidence report differently scoped core indicators (6,453 route core characters versus 13,695 bootstrap context characters across nine refs); reconcile before claiming context coverage.

The 2026-10-04 Codex-local 0.2.104 smoke and a separate frozen sidecar-aware offline preflight passed structural projection/search/fetch checks; the preflight passed 4/4 entries and produced zero exact-target hits without atoms. Queries echoed selectors, so these are plumbing only. Its hash-verified receipt summary is in `codex/benchmark-archive` at `2452933`, `experiments/jev-metadata-integration/evidence/metadata-preflight-20261004.json`; full snapshot: `D:\MSSR-benchmark-artifacts\jev-sidecar-preflight-20261004-v1`. The v18 corpus had no Librarian sidecar. Next freeze a natural-query corpus; separately measure acceptable-range recall, Jev choice/distribution, sufficiency, contradiction, abstention, citation integrity and host composition. Group EN/ES and source/concept clusters, obtain owner labels before tuning, and preserve an unopened holdout. Confidence remains uncalibrated; thresholds are unset.

## Next gates

- **Product:** clean MSSR 0.2.104 and isolated Bridge 0.6.156 candidates are pushed and gated; active Bridge remains 0.6.153/0.2.101. Adoption, restart, main merge and npm publication remain separate gates.
- **Librarian:** composed workflow: deterministic text/metadata search, Jev selection/relation review, exact revision/range fetch, contradiction review and citation packs; the host can recover structure, compact and assemble cited paragraphs. It does not write canonical sources.
- **Benchmark:** preserve archive v1-v18. The owner worksheet has 32 bilingual concepts, 38 proposed citations across 28 paths and blank labels; C18 is unresolved, C19 incomplete. The v18 preflight had no Librarian sidecar; the .104 sidecar-aware structural preflight is now complete and archived, but neither establishes relevance or quality. Historical .2.97 strict-heading scores and Brier/log loss remain exploratory; no threshold/calibration is accepted. Next create a frozen natural-query set; obtain owner-adjudicated ranges, sufficiency and abstention labels; then measure metadata recall, Jev choice/distribution, Noul, contradiction, citation and synthesis separately. Group EN/ES and source/concept clusters; preserve an unopened grouped holdout. Keep new artifacts outside experiments/**/runs/**.
- **Live Jev:** require a fresh complete provider-gate receipt and user review; make zero provider calls until the user sends the exact START_JEV token.
