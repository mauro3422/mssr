# Jev Librarian integration and Git handoff

## Repository snapshot and preservation

The detailed pre-integration handoff is preserved at docs/history/jev-librarian-integration-handoff-pre-0.2.104.md; its branch and gate statements are historical. This indexed handoff is the compact current view.

The 2026-10-02 audit found `codex/jev-confidence-merge-evaluation` at `ad25a9a`, clean and 29 commits ahead of main. Its 255-path diff included 206 frozen Jev run files (53,079,986 bytes). The separate `codex/benchmark-archive` now preserves v1-v18 plus diagnostic/proposal evidence at `ac56327`; this documentation commit left frozen run payloads intact. Never merge the evaluation branch wholesale into product or rewrite/prune run manifests, outputs, labels, reviews or hashes.

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

The older metadata and ontology runs remain exploratory: labels were author/Luna-created, ranges incomplete, and some document sets were opened during tuning. Exact-fetch success establishes handle integrity, not relevance. Preserve those runs as historical evidence; do not use their scores as confidence thresholds.

The 2026-10-08 production state is Bridge 0.6.161 with MSSR 0.2.110, recorded in `.mssr/PROJECT_STATE.md`. Live production smokes cover Jev selection, exact fetch/evidence packing, and relation-to-preview plumbing. Host-side structure-recovery experiments v1-v5 are syntax-labeled diagnostics; v5 recovered 14/14 boundaries and rendered exact Markdown on one excerpt. None is an independently adjudicated quality or calibration set. Raw Choice/Noul values remain uncalibrated; no automatic source merge or canonical write is enabled.

The user's current instruction explicitly authorizes live Jev calls for this MSSR work; the historical `START_JEV` token is not required for these tests. Credentials are retrieved from Windows Credential Manager under `TypeSafe:MSSR:JevLab` and are not recorded in receipts. This authorization covers bounded evaluation calls, not applying unverified judgments to canonical sources.

## Next gates

- **Product:** Bridge 0.6.161 currently runs MSSR 0.2.110 in production. The tool chain supports deterministic Librarian search, Jev selection/relation review, exact fetch, evidence packs, contradiction-aware review, and reversible source-text previews. No dedicated structure-recovery or generated-paragraph endpoint exists; previews do not write canonical sources. Keep npm publication and any new tool/API as separate release decisions.
- **Bibliotecario evaluation:** keep retrieval recall, exact-fetch integrity, Jev choice/sufficiency, relation and contradiction quality, structure segmentation, citation retention, and synthesis faithfulness as separate measures. Build a fresh document-grouped sample with owner-adjudicated boundaries, list/callout/code hard negatives, Spanish/English cases, and an untouched holdout. The v1-v5 structure receipts are development evidence only; no threshold or production promotion follows from them.
- **Next structure run:** extend beyond one excerpt with unmarked JSON plus nearby list items, callouts, headings, and prose from distinct MSSR documents. Preserve exact per-line citations, record raw distributions, and score false merges/splits and render fidelity. Compare thresholds only on an independently labeled development set before opening a separate holdout.
- **Live Jev:** bounded provider testing remains authorized by the user's current instruction. Save manifests/results outside `experiments/**/runs/**`, keep credentials out of receipts, and leave every unverified judgment review-only.

## 2026-10-06 — Jev smoke on the active Bridge and separate direct-MCP staleness

The active Bridge is healthy at 0.6.159 (PID 29180, runtime boot 837b6744-b79a-4b56-987d-329a9020a0ae). Its process entrypoint is D:\Dev\bridge-mcp-mssr-0.2.105-0.6.158\dist\http.js; despite the legacy directory label, npm ls, package.json, the lockfile and installed build receipt identify @mauroprime/mssr 0.2.108 (mssr-build:sha256:283b1ddeefa2a162, 127 files / 1,442,442 bytes). The packaged tarball SHA-256 is 8478731d2c653e50b2a5718f4fe5b30b3b40f8ddc99df67163b8c9a9b72b9f21. Tunnel readyz returned 200/ready, baseline transport failures since the 21:23 reset remained zero, and no restart request is pending.

A real Bridge Librarian -> Jev 1.13.0 -> exact-fetch smoke used two revision-bound handles from .mssr/PROJECT_STATE.md and .mssr/PROJECT_CONTEXT.md. A broad junction question abstained (provider confidence 0.44, sufficiency 0.29); a narrower query selected .mssr/PROJECT_STATE.md block-34, lines 163–167 (0.74 / 0.40), and a post-selection fetch matched the same handle, revision and fingerprint. This is plumbing evidence, not a quality benchmark or calibration result; the scores are uncalibrated, and no deletion of the compatibility junction is authorized by this result. Receipt: D:\MSSR-benchmark-artifacts\mssr-jev-librarian-bridge-followup-20261006-v1.

The standalone mcp__MSSR__ service is separate. Its route reported loaded mssr-build:sha256:58b3d5447d10b847, available receipt mssr-build:sha256:e5ba7ccf1a0f7933 (0.2.105), status stale. The earlier 12-pair relation run went through that direct service without capturing its build identity at call time; its labels remain exploratory, but it must not be counted as an evaluation of the active Bridge package. Provenance correction and hashes: D:\MSSR-benchmark-artifacts\mssr-semantic-curation-jev-relations-20261006T2142-v1\PROVENANCE-CORRECTION.md.

Next: use the active Bridge path for further candidate-build comparisons. If direct MSSR MCP coverage is needed, reconnect it through its supported host flow and verify loaded build equals available before repeating the 12-pair relation review. Preserve the pre-existing edit to .mssr/PROJECT_STATE.md; this follow-up did not change it.

Jev authorization: the latest user instruction for this ongoing MSSR work explicitly permits live Jev calls for testing without requiring the historical START_JEV token. Use this authorization for the current MSSR task; do not treat it as permission to persist unreviewed judgments or modify canonical project documents automatically.

The 2026-10-06 Bridge/MSSR 0.2.108 replay also sent one exact pair through semantic relation review: Jev 1.13.0 returned duplicate (raw 0.76); MSSR kept it review-only because independent verification was absent and temporal comparability was unknown. This matched the earlier manual correction for the same two facts, but remains a one-pair plumbing replay, not independent corpus-owner adjudication or calibration. No merge was applied. The input snapshots and bounded receipt are in the Bridge follow-up artifact folder listed above.

## 2026-10-06 — Bridge 0.2.108 relation granularity iteration

Four live TypeSafe Jev 1.13.0 relation calls were made through the healthy active Bridge 0.6.159 / MSSR 0.2.108 path after Librarian exact search/fetch (eight range fetches). Caller-selected smoke labels matched in three of four cases: `unrelated` 0.86, `supports` 0.89, a broad junction/context pair returned `supports` 0.81 despite a duplicate expectation, and a narrower same-fact checkout/junction pair returned `duplicate` 0.61. All confidences are raw/sin calibrar (`calibratedConfidence=null`); all judgments are unverified and the deterministic evaluation disposition remained `review` because independent verification and temporal comparability were unavailable. No synthesis preview or source merge occurred.

Interpretation: relation choice was sensitive to evidence granularity. The narrow duplicate score falls below the exploratory 0.75 preview gate; do not lower that gate based on this smoke. The expected labels are caller-selected test cases, not owner-adjudicated truth. Caller-projected atom record fingerprints use SHA-256(handle id, payload fingerprint, revision) and are not official Librarian catalog record fingerprints. Full report, handle revisions/fingerprints, summarized judgments and source snapshots are in `D:\MSSR-benchmark-artifacts\mssr-jev-bridge-relation-iteration-20261006-v1` (SHA256SUMS.txt).

Follow-up experiment: build an independently owner-adjudicated, document-grouped set for duplicate/support/unrelated/contradict/supersedes/unresolved; include matched narrow ranges and broad-vs-narrow controls. Continue to separate retrieval/fetch, relation quality, temporal/scope evaluation, preview eligibility, citations and host composition. Keep this smoke review-only; no calibration or activation threshold is established.

## 2026-10-06 — Temporal `supersedes` evaluator correction (source-only)

A live, revision-bound comparison of the current MSSR handoff block against its historical block returned Jev `supersedes` at raw confidence 0.96. The left/current claim began 2026-10-06; the right/historical claim began 2026-10-02 and ended 2026-10-05. MSSR correctly kept the result in `review` because independent verification was unavailable, but also incorrectly added `relation-temporal-comparability-conflict`: the deterministic evaluator required every relation to share one validity label and overlapping intervals.

Portable source now evaluates time according to relation direction. `supports`, `contradicts`, and `duplicate` retain their prior matching-validity/overlap requirement. `supersedes` still requires known validity and start times and rejects reverse chronology; it permits a later left replacement to point to an earlier right target across validity states or disjoint intervals. This change does not satisfy independent verification, authorize canonical edits, or merge sources; synthesis keeps superseded sources separate. Regression coverage checks both forward and reverse chronology.

Verification on 2026-10-06: `npm run build` passed (`mssr-build:sha256:fa33d6e8f9e31485`, package version remains 0.2.105); `npm run test:semantic-curation`, `npm run test:change-history`, and `npm run check` passed. Regressions cover forward/reverse chronology, missing temporal evidence, and a verified supersession remaining split into two source-preserving synthesis groups with `applyAllowed=false`. The existing Bridge process remains 0.6.159 / boot `837b6744-b79a-4b56-987d-329a9020a0ae`, healthz/readyz 200, no restart pending, and zero transport failures since its captured baseline. It was not restarted or replaced; this source correction is not yet adopted by the running Bridge package and still requires a separately verified package/build/runtime-adoption gate.

The temporal pair is one provider smoke, not an adjudicated benchmark or calibration sample. Preserve the raw confidence as uncalibrated; no score threshold changed. `.mssr/PROJECT_MEMORY.md` was reviewed: the stable relation contract belongs in the indexed semantic-relations decision module, so no additional memory entry is needed (`reviewed-none`).

## 2026-10-07 — Live temporal replay exposes Bridge package adoption gap

The active Bridge 0.6.159 / boot `837b6744-b79a-4b56-987d-329a9020a0ae` remained healthy (`healthz`/`readyz` 200; restart pending false). Through its live Librarian, two exact blocks from this handoff were searched and fetched at revision `a79eec8c1af111cd309c4ef1f53afa69c5dfbf7bf172432bd1c62fbdb1c751f0`: line 13 records active Bridge 0.6.153/MSSR 0.2.101 in the 2026-10-02 product-lineage entry; line 100 records active Bridge 0.6.159/MSSR 0.2.108 in the 2026-10-06 runtime entry. The returned payload fingerprints were `8f0df274941adea63a96309ec21e0ba7af926207ed0ecb2cece0093139ca2144` and `3fdb71c79c879477afea09c6023f059472f7f79631013bcfa2ea3fd3708e9e6d` respectively.

One live TypeSafe Jev 1.13.0 relation request selected `supersedes` from the later runtime observation to the earlier one at raw confidence `0.37`. The judgment was unverified, `calibratedConfidence=null`, and remained candidate/review-only. The active MSSR evaluator returned both `independent-verification-unavailable` and `relation-temporal-comparability-conflict`, although the left interval begins 2026-10-06 and the right begins 2026-10-02. This is one plumbing/behavioral probe, not an independent benchmark or owner-adjudicated label.

The active package was then inspected directly at `D:\Dev\bridge-mcp-mssr-0.2.105-0.6.158\node_modules\@mauroprime\mssr`: its installed `package.json` is 0.2.108, but `dist/semantic-judgment.js` still applies same-validity plus interval-overlap checks to every relation. This explains the live temporal conflict and proves that the directional `supersedes` fix in this checkout is not present in the loaded Bridge package, despite the runtime package version. The local source remains package version 0.2.105; changelog entries 0.2.106–0.2.108 are marked local-only. `npm run check`, `npm run test:semantic-curation`, and `npm run test:change-history` passed after this replay.

Next gate: reconcile the current project-state authority without overwriting its pre-existing user edit; then package the local source entries under a new version, pass `npm run verify` and `npm run release:gate`, and validate the exact temporal pair against an isolated Bridge candidate before any controlled active-runtime adoption. Do not tune confidence or count this one replay as a benchmark result.
