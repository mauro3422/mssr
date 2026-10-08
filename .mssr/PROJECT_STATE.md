# MSSR project state

## Current release
MSSR 0.2.110 is release-gated and unpublished: `mauroprime-mssr-0.2.110.tgz`, 1,115,994 bytes, SHA-256 `44f5c57a8eacc53fe3f9012cd113fa27775a382b855cde344c7b3ed4279b25ea` (`pkg:0.2.110#44f5c57a`); `npm run verify`, `npm run release:gate`, and isolated Bridge 0.6.161 `verify:all` passed (`failedRequired=0`). It restores bounded read-only `rangeOverlapDiagnostics` omitted from the preserved 0.2.109 artifact (1,113,978 bytes, SHA-256 `90ea5401a0dad5d2b4edaa264837d9cc36fbab76bae2ea7747e5c4df993baff8`, alias `pkg:0.2.109#90ea5401`). The final Bridge verification transcript and initial harness-path failure are preserved outside Git under `D:\MSSR-benchmark-artifacts\bridge-0.6.161-mssr-0.2.110-verify-20261008-v1\runtime\logs\`; intermediate release artifacts are preserved under `provisional-artifacts\`. The corrected candidate remains isolated; production activation and public publication are separate and not yet performed. Receipt `.mssr/runtime/releases/0.2.110.json`; prior release receipts remain under `.mssr/runtime/releases/`.

## Librarian and Jev runtime status — 2026-10-08
The active Bridge is 0.6.159, boot `837b6744-b79a-4b56-987d-329a9020a0ae`; healthz/readyz returned 200 and no restart is pending. Its installed MSSR package is 0.2.108, whose `dist/semantic-judgment.js` still applies the old same-validity/overlap rule to `supersedes`. A real Bridge Jev relation probe over exact handoff blocks selected `supersedes` at raw confidence 0.37; it remained unverified and review-only, while the runtime evaluator incorrectly reported temporal conflict. This is one exploratory behavior probe, not benchmark or calibration evidence. Source fix and runtime mismatch evidence are in `.mssr/knowledge/operations/jev-librarian-integration-handoff.md`.

Next: persist the verified source and candidate changes in Git, then perform one controlled adoption of Bridge 0.6.161 / MSSR 0.2.110 if the exact production handoff and rollback gates still match. The existing 2026-10-05 startup snapshot below is historical and does not describe the current active process.

## Librarian and Jev host status — 2026-10-05
Active Bridge and startup were verified on 2026-10-05. The HTTP server runs Bridge 0.6.155 from `D:\Dev\bridge-mcp-jev-diagnostics`, with runtime/data in `D:\Dev\bridge-mcp`, vendored MSSR 0.2.103 (SHA-256 `8191881b18a0e4a84b87b59750e6587d60be77e94893b55a52c740fb9e7c0fd5`), one watchdog (PID 11904), one HTTP process (PID 3928), boot `09182c0d-7721-4f4a-a2b0-667449952580`, and a ready tunnel on port 8081. The only Bridge Startup entry is `BridgeMCP-Watchdog.cmd`; it points to the diagnostics code root and keeps the main checkout as data root. The two batch snippets supplied for comparison are not two active Startup entries. Controlled watchdog restart ACK: `8e816a1f-11a2-4348-9058-71777d3e69df`.

The exact candidate passed `npm run check`, `npm run build`, semantic-evidence regression, the 186-tool registry gate, generated tool-doc freshness, skill-routing tests, full regressions, and `bridge_verify_all` (15/15 gates, exit code 0). The live evidence-pack flow searched the current MSSR ADR and returned its exact cited source range at `docs/decisions/0009-semantic-evidence-plane.md:L108-L108`. Bridge runtime catalog is 186 tools, while this connector directly exposes 185; `mssr_librarian_evidence_pack` works through the Bridge wrapper and still needs a connector refresh for direct exposure.

One real Jev exploratory choice against two exact ADR handles selected the relevant block (line 108). Provider `typesafe-jev` / `jev-1.13.0`: 864 input / 67 output tokens; provider confidence 0.67 and evidence sufficiency 0.34 are explicitly uncalibrated; verification is unverified and the result advisory-only. This is a connectivity smoke, not an adjudicated benchmark or quality/calibration result. No confidence threshold or automatic action is justified.

Project Context Health remains at review level because PROJECT_MEMORY and PROJECT_STATE are oversized and indexed knowledge has modularization pressure. Context and memory were reviewed with no semantic change; modularization candidates remain advisory and were not applied. Next gates: refresh/reopen the Bridge connector and verify direct evidence-pack exposure; run the frozen, owner-adjudicated benchmark before making quality or confidence claims.

## Natural-query diagnostic — 2026-10-04

Offline natural-query v3 (8 bilingual seeds/27 docs): top-20 overlap 159/160 and 16/16 exact fingerprints; ES top-1 ranges exceeded the 20K fetch cap while rank 2 remained fetchable. Ranking/fetchability only, not quality or calibration. Archive commit `ac56327` preserves v3 plus the corrected 38-range worksheet, provisional cluster map, and six unadjudicated seed proposals; all 38 file/range hashes, bounds, and headings now verify. Owner labels remain blank and no grouped split or confidence threshold is accepted. Summary: `experiments/jev-metadata-integration/evidence/natural-query-diagnostic-20261004.json`; full run: `D:\MSSR-benchmark-artifacts\jev-natural-query-diagnostic-20261004-v3`.

## MSSR 0.2.105 sidecar-aware offline runs - 2026-10-04

Pinned candidate: `0c1ca590d3dcf9a8ba721f6a2975c909e13972c2`, MSSR 0.2.105, build `mssr-build:sha256:58b3d5447d10b847`.

The offline sidecar preflight projected 4/4 entries, passed 4/4 metadata searches and exact-fetch fingerprints, and rejected missing-sidecar and stale-fingerprint controls. The 27-document bilingual ranking diagnostic used 8 queries and four source clusters. Atoms added/removed no candidates across 147 available top-K slots; five existing ranks changed in C01 EN, moving its unadjudicated anchor from rank 9 to 5. C01 ES remained absent. All 16 exact-fetch fingerprints passed.

These runs made no Jev/provider/MCP/network calls and read no labels. Anchors are unadjudicated, so this is plumbing and ranking evidence only, not relevance/recall, Jev/Noul, contradiction, synthesis, calibration, or Bridge-adoption evidence. The references manifest was absent in the preflight.

Receipts: `experiments/jev-metadata-integration/evidence/metadata-preflight-0.2.105-20261004.json` and `experiments/jev-metadata-integration/evidence/natural-query-diagnostic-0.2.105-20261004.json` on `codex/benchmark-archive`; immutable artifacts are under `D:\MSSR-benchmark-artifacts\jev-sidecar-preflight-20261004-0.2.105-v1` and `D:\MSSR-benchmark-artifacts\jev-natural-query-diagnostic-20261004-0.2.105-v1`.

The live-selection smoke is prepared at `D:\MSSR-benchmark-artifacts\jev-live-smoke-20261004-0.2.105-v1`. Four direct read-only MCP searches (two passes each for C01 Spanish/English) were captured; the latest order matches pinned 0.2.105. Each returned 20 advisory candidates: Spanish has 19 exact-fetchable/1 oversized; English 18/2. Frozen requests use 1 and 10 current source snapshots respectively. The C01 English combined-metadata search has one projection match at rank 5 (`action=review`, `artifact=repository`). The v4 factorial below confirms this rank effect requires parent records plus EvidenceAtoms; either layer alone produces no change. The frozen live/local C01 ordered handles and scores match 40/40. This is ranking-mechanics evidence, not relevance quality. A separate frozen offline probe concatenated the existing C01 English query to Spanish: Top-20 overlap was 2/20, with 18 added and 18 removed handles; unique source refs rose from 1 to 11 and exact-fetchable candidates fell from 19/20 to 17/20. The unrelated negative control grew from zero to 20 candidates across six files. Raw query concatenation is therefore rejected as a product fix. No labels or live Jev/provider/MCP/network calls were used by the offline probe; product ranking is unchanged. Evidence: `D:\MSSR-benchmark-artifacts\jev-bilingual-query-expansion-diagnostic-20261004-0.2.105-v1` and `codex/benchmark-archive`.

The separate-query v2 diagnostic searched Spanish and English independently, then deduplicated by exact handle id. It produced 40 unique C01 handles across 11 sources (no shared ids), 37 exact-fetchable and 3 oversized; the pinned local selector received all 40, marked 37 eligible, omitted the 3 oversized ranges, and required exact fetch. Its input contained both parent records and atoms, so those union results describe the combined layer, not an atom-only ablation. The control produced 0 Spanish and 20 English candidates (20-handle union across 6 refs); without owner labels this is candidate-fanout evidence only, not relevance or false-positive truth. All 11 frozen-input checksums and all 4 v2 artifact hashes verify. No labels, network, MCP, or external provider calls occurred; no product code changed. Output: `D:\MSSR-benchmark-artifacts\jev-bilingual-query-expansion-diagnostic-20261004-0.2.105-v2`; harness and protocol are recorded in `codex/benchmark-archive` commit `373c665b636ec30a10552ea2ac28fac9e86181b4`.

The canonical offline factorial is `D:\MSSR-benchmark-artifacts\jev-bilingual-multicluster-union-20261004-0.2.105-v4`: eight C01/C02/C04/C24 bilingual queries over 27 matching Markdown documents, in lexical-only, parent-records-only, atoms-only and combined modes. Only combined C01 English produced one `action=review`/`artifact=repository` projection match; it moved an existing range from rank 9 to 5 and displaced four adjacent ranges, with no Top-20 additions or removals. All 127 fetchable combined-union handles passed exact fingerprint and code-unit-length checks; frozen C01 MCP order and scores matched 40/40. The four combined unions fit one local selector pass each through offline stubs (largest state 18,996 chars; evidence 17,329 chars). Stub choices are arbitrary. No labels or Jev/provider/MCP/network call were made in this run; no quality or calibration claim follows. A fresh v5 rerun reproduced five deterministic files byte-for-byte; all six hashes verified and its manifest matched after excluding run ID/timestamp. A provenance hardening pass made the runner verify all 37 natural-package checksums and exact manifest membership; v6 passed and reproduced the four deterministic JSON result files from v5, with all six v6 output hashes verified. v4 remains canonical; v5/v6 are retained as reproducibility checks. Runner, query-only seed fixture, output hashes and full table are in `codex/benchmark-archive`.

The request schema and exact-handle revalidation passed an offline no-network stub. All 11 artifact checksums and receipt/request hashes verify. No Jev/provider call has occurred.

Next: inspect the frozen request summary and receipt, then run only after the exact `START_JEV` message required by the benchmark protocol. The two requests run sequentially; Choice and Noul are combined per request, the SDK may retry once (maximum four provider transport attempts), and no agent retry is planned. Results will remain uncalibrated smoke evidence; owner-adjudicated ranges and grouped calibration/holdout data are still required before any quality claim.

## 0.2.98 package release receipt — historical

The full `npm run verify` and `npm run release:gate` passed for 0.2.98. Its canonical local package was `mauroprime-mssr-0.2.98.tgz`, 1,075,096 bytes, SHA-256 `156eef3c564027232578c139eb4f35c8dd2ea6b30fb743bc7ce74cda164b246e` (`pkg:0.2.98#156eef3c`). It has not been published. The 0.2.98 gate's host observation was pid 27232 with build `mssr-build:sha256:bc288853f02be406`; a later restart superseded that process observation.

## 0.2.98 live Jev smoke and comparison follow-up — 2026-10-02

### Context-loader budget friction — resolved

A close-stage route initially rejected `.mssr/PROJECT_STATE.md` because the selected core section exceeded its declared 2,500-byte budget; the section measured 3,268 characters before this correction, versus 1,933 characters at the checked-in baseline. Release, smoke, and comparison history had accumulated under `## Current release`. Moving that material below this separate heading reduced the current-release slice to 1,391 bytes. `npm run test:project-context`, `npm run test:project-context-health`, and a structured close route with core loading now pass. No reusable routing change is indicated.

### Live real-document Jev selection smoke

Run `experiments/jev-mssr-live/runs/mssr-librarian-real-doc-bilingual-confidence-smoke-20261002T155515Z-v1/`: three live choices over two real MSSR architecture documents (Spanish/English) and a narrower Spanish rerun all selected the same exact section. Raw confidence varied from 0.49 to 0.79; no labels, equal option set, or holdout were used. A separately supplied fetch returned stale; re-selection and exact fetch with one snapshot passed. This is exploratory selection/fetch consistency evidence, not accuracy, calibration, or a threshold, and did not exercise the new atom projection because no EvidenceAtoms/records were supplied.

Controlled bilingual run evidence and the next evaluation gate: `experiments/jev-mssr-live/runs/MSSR-LIBRARIAN-JEV-COMPARISON-20261001.md`. Repeated 80k direct scores were 35/52 and 34/52; the paired 64k hierarchy scored 31/52. Labels are Luna-reviewed, alternate valid ranges and abstention quality are unlabeled, and confidence remains uncalibrated. The runs do not justify an automatic threshold or host activation.
### Live exact-search-handle Jev smoke — 2026-10-01

Run: `experiments/jev-mssr-live/runs/mssr-bridge-real-docs-exact-handles-20261001T045022Z-6dc93a/`. Real Jev through Bridge `0.6.144` selected the author-preferred exact handle in 3/3 cases; all 3 exact fetches passed. A blind Luna review found all selected ranges directly answerable, but overlapping block/section ranges mean the single-handle author match is only a narrow metric. The 0.42-confidence answer was correct in this sample; do not infer a cutoff. Inputs, completion receipt, review and results are hashed. `experiments/CONTROLLED_RUN_PROTOCOL.md` now requires future selection benchmarks to freeze acceptable range sets before inference and clarifies immutable-manifest completion receipts.

## Jev evaluation and path alignment — 2026-09-30

The rubric-matched live section run remains historical and exploratory: 48/51 action decisions for EvidenceAtom versus 45/51 for parent metadata, while lifecycle accuracy fell from 100% to 88.2%. The 51 requests repeat 17 sections; labels were not independently adjudicated. This does not establish a confidence cutoff, and these archived values are not being changed or used to drive runtime behavior. The current architecture and historical evaluation evidence now load through separate entries, `mssr-jev-confidence-merge-evaluation` and `mssr-jev-confidence-benchmark-history`. MSSR 0.2.93 exposes bounded search/fetch, relation review, and synthesis preview through MCP; 0.2.95 adds an explicitly invoked heading-choice tool. The local Bridge 0.6.142 post-restart smoke adopted only 0.2.93; it is not evidence of 0.2.95 adoption, a confidence calibration, or public npm publication. MSSR still has no global index or authenticated verifier boundary.

### Live Jev provider check — 2026-09-30

The initial bounded live attempt through `mssr_semantic_curation_project_review` (`mode=jev`, `persist=false`, at most two blocks and one pair) stopped at TypeSafe client configuration because `TYPESAFE_API_KEY` was absent from that MCP process. The credential was then resolved from the existing Windows Credential Manager entry and used only in an ephemeral local process; it was not printed or persisted. A separate real MSSR request completed with TypeSafe Jev `jev-1.13.0`: one question and one evidence pair, candidate relation `supports`, selected-option confidence `0.85`, usage 2,154 input / 69 output tokens, 410 ms. The judgment remains `verified=false` and advisory-only; raw provider output was not persisted. This is a smoke test, not a benchmark, independent adjudication, or confidence calibration. The later Codex launcher configuration and active-process status are recorded below; benchmark claims still require a held-out, independently adjudicated evaluation.

### Codex-local Jev credential launcher — 2026-09-30

Codex's user-level `config.toml` now points the MSSR stdio server at `C:\Users\mauro\.codex\scripts\mssr-jev-credential-launcher.mjs`. The Node launcher reads the existing Windows Credential Manager entry through a local PowerShell reader at process startup and passes the credential only in the MSSR child process environment; the key is not in Codex config, command arguments, Git, logs, or MSSR telemetry. The local non-persisting smoke helper is `C:\Users\mauro\.codex\scripts\mssr-jev-credential-smoke.mjs`.

The launcher completed an isolated stdio MCP handshake and one live Jev relation request: `typesafe-jev` / `jev-1.13.0`, `supports`, raw confidence `0.90`, 5,786 input / 69 output tokens, about 613 ms. After the user's restart, a direct `mssr_semantic_evidence_relation_review` call through the active Codex MCP completed one exact-source pair: `supports`, raw confidence `0.89`, 5,785 input / 69 output tokens, about 498 ms. Route diagnostics reported loaded and available build `mssr-build:sha256:cfaaa9b0f9ad1977`, status `current`; the old missing-key failure is resolved. Both judgments remain `verification=unverified` and advisory-only; neither was persisted. A separate two-/four-source project scan found no eligible pair and made zero provider calls. These are smoke checks, not benchmark evidence or confidence calibration.

Operational incident and correction: the first PowerShell stdio relay stalled at MCP initialize; the precise internal stream failure is unresolved. Replacing the outer relay with Node inherited stdio, while keeping PowerShell limited to Credential Manager retrieval, passed MCP handshake, tool discovery and the live request. The first pair was also rejected before inference because the exact fetched source ranges plus request wrapper exceeded the 24,000-character limit; a bounded 36,000-character retry passed. The post-restart active MCP call and build readback close the integration follow-up. No general skill or routing change is justified by this project-local friction.

### Current bounded live MSSR data smoke — 2026-09-30

Run report and immutable inputs/records:
`experiments/jev-mssr-live/runs/mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1/`.
On commit `7fd0f7414e636d17cfac385cbffea9b55f83e78c`, the Librarian found
the expected section in top 5 for 4/4 queries, but top 1 for 0/4 (ranks
3/2/5/2); exact block fetch passed 8/8. Four real Jev `jev-1.13.0` relation
requests matched 3/4 author-created labels (6,906 input / 278 output tokens,
337 ms mean latency). The unknown-scope/time case was labeled unresolved but
Jev chose `supports` at 0.45; MSSR evaluation and preview flagged missing
scope/validity and kept it review-only. Both previews had
`applyAllowed=false`. These labels were not independently adjudicated; no
true contradiction case, holdout or calibration was included. This confirms
live use through the explicit MSSR MCP path; it does not activate automatic
search reranking or project writes. The 153-request historical ablation and
its values remain unchanged.

**Next gate:** independently adjudicate a larger, document-grouped real corpus
including true contradictions, supersession, duplicates, support, unrelated
and unresolved cases; keep Librarian recall/fetch, Jev relation quality,
candidate selection, and citation-faithful synthesis as separate measurements.
Keep all proposals shadow/review-only until a separate held-out policy supports
any activation decision.

### Bilingual retrieval and Jev selection — updated 2026-10-02

The 21-document / 26-pair history remains exploratory. Deterministic search
returned the expected section in top 100 for 18/26 English and 4/26 Spanish
queries. Real Jev selection from those shortlists reached 12/26 English and
3/26 Spanish; full-heading selection reached 18/26 and 16/26. The repeated
0.2.97 direct Choice runs scored 35/52 and 34/52; the 64k hierarchy scored
31/52. These labels were Luna-reviewed, not approved by the document owner;
the same corpus and opened queries were reused, so they do not establish
unseen-document quality or a confidence threshold. Exact fetches passed
48/48 for full headings and 32/33 for the original shortlist (one oversized
range rejection; no integrity failures). Details remain in the immutable
runs experiments/jev-mssr-live/runs/mssr-librarian-bilingual-retrieval-20260930-v1/,
experiments/jev-mssr-live/runs/mssr-librarian-jev-candidate-selection-20260930-v1/,
and experiments/jev-mssr-live/runs/mssr-librarian-jev-full-heading-choice-20260930-v1/;
the 0.2.97 comparison is summarized in experiments/jev-mssr-live/runs/MSSR-LIBRARIAN-JEV-COMPARISON-20261001.md.

The October 2 lexical rewrite was offline and made zero Jev calls: Spanish
recall@100 rose from 4/26 to 9/26 overall and from 4/20 to 9/20 on development,
but remained 0/6 on the previously opened holdout. English fell from 18/26 to
14/26 overall (13/20 to 11/20 on development; 5/6 to 3/6 on the opened
holdout). Full offline evidence remains in
experiments/jev-mssr-live/runs/mssr-librarian-bilingual-expansion-20261002T133846Z-v1/
and experiments/jev-mssr-live/runs/mssr-librarian-bilingual-expansion-20261002T135011Z-v2/.
Do not adopt the frozen dictionary. A new
live repeatability run selected the same exact block-26 for both paired
queries and passed both exact fetches (2/2); it is a one-concept smoke, not a
quality score. See
experiments/jev-mssr-live/runs/mssr-librarian-jev-shortlist-repeatability-20261002T143234Z-v1/.

Current decision: keep deterministic search and explicit Jev choice as
separate calls; use exact fetch before citing or composing. Full-heading Jev
is a useful candidate-absence fallback while the option budget allows it;
larger catalogs need a measured high-recall hierarchy. Do not enable automatic
reranking or a raw-confidence cutoff. The next gate is a fresh,
document-grouped corpus with owner-adjudicated acceptable ranges, followed
by separate fetch and citation-faithful composition checks.
### Live MCP Jev selection smoke — 2026-09-30

The compiled MSSR 0.2.95 MCP handler was connected to an in-memory MCP client
and the real TypeSafe Jev provider. One Spanish question was sent with the
frozen 21-document corpus and all 200 heading sections plus `none`. Jev
selected the expected heading `Evidence atom and source boundary` in
`.mssr/knowledge/architecture/semantic-evidence-plane.md`. A second MCP call
used the returned handle to exact-fetch the frozen source; the fingerprint
matched. The one selection reported 18,192 input / 2,027 output tokens,
confidence 0.79 (uncalibrated), and 5,670.1 ms latency. The expected target
label was double-reviewed by Lunas, not approved by the human document owner.
This verifies MCP/provider/fetch wiring for one case only; it is not a quality
estimate, compaction/paragraph-synthesis test, production Bridge adoption, or
authority to rerank search. The search tool remains deterministic. The run's
manifest, score, report and SHA256SUMS are under
`experiments/jev-mssr-live/runs/mssr-librarian-jev-mcp-selector-smoke-20260930-v1/`.

### Jev Project Context budget review — 2026-09-30

- **Status:** the two Jev module budget exceedances are addressed with exact heading selectors; original Markdown and historical result bytes are unchanged.
- **Before:** health reported `mssr-architecture-core` at 4,811/5,000 bytes, `mssr-jev-confidence-merge-evaluation` at 12,297/10,000, and `mssr-jev-decision-model-use-cases` at 25,431/12,000.
- **After:** the Jev architecture, evaluation history, decision-model research, public evidence, and unvalidated hypotheses are separate selective entries, each below its declared limit. The architecture core remains close to its 5,000-byte budget; `PROJECT_MEMORY` and `PROJECT_STATE` remain advisory growth watches.
- **Closure:** Project Context Health has no `module-entry-budget-exceeded` finding for the Jev entries; project-context tests and full `npm run verify` pass. Source Markdown hashes are unchanged.

The canonical working tree is physically at D:\Dev\mssr; Git, .codex/config.toml, and project context identify D: as source. C:\Dev\mssr is a junction and remains the path stored by the Codex local-project registry. Keep the junction until that registry is migrated; deleting it now would leave the saved project path dangling. Previous inventory counts of 193 untracked and 43 modified files described the pre-integration state; those changes and experiment records are preserved in commits and D:\Dev\mssr-snapshots\pre-integration-20260930-01. The earlier mainline reconciliation at dfb295653b2e3f0f2a6f0d25bb2bc5cbe9634962 and separate P7 reconciliation handoff under .mssr/sessions remain historical recovery evidence; the 0.2.93 feature and this follow-up are on branch codex/jev-confidence-merge-evaluation. Read Git status for its current tip and worktree state.

### Deferred path debt — Codex project registration

- **Status:** confirmed-debt, 2026-09-30. Codex `list_projects` reports the saved local-project path as `C:\Dev\mssr`; filesystem inspection confirms that path is a junction to the physical Git root `D:\Dev\mssr`. Repository config and project context already name D: as canonical.
- **Impact:** a Codex-launched task can start through the compatibility alias and reintroduce path/authority confusion. The junction currently resolves, so deleting it before updating the app's saved path would break the registered project.
- **Deferred because:** the available Codex project tools can inspect but cannot edit the saved local path. Do not mutate private app registry state or delete the working junction as a workaround.
- **Next gate:** use a supported Codex project-management flow to register/open `D:\Dev\mssr`, then read back the saved path and verify the selected checkout's physical path and Git root both resolve to D:.
- **Closure:** Codex's saved project record resolves to `D:\Dev\mssr`; no active task depends on `C:\Dev\mssr`; then remove the compatibility junction only if it is still desired and verify its absence plus the D: Git root.

## R5 foundation — 2026-09-29

## 0.2.92 implementation close review — 2026-09-30

Coverage-map review found that a filtered producer inventory could inherit `globalCoverageComplete=true`; it also found architecture prose stale relative to the 14-family registry and overbroad implications around freshness/privacy. Coverage v2 now labels full versus selected scope, prevents global negative claims from subsets, and rejects unknown ids. The map records the current adapter counts and the distinction between portable tested declarations and live host observations. Full `npm run verify` passed on build `mssr-build:sha256:1f537b23769e1e6e`. The recovered `({id` default stream is empty, but its `v.producerId` NTFS alternate stream contains 69,385 bytes of source references; the stream and a hashed text recovery copy are retained in the external quarantine manifest pending a separate deletion decision.

## 0.2.91 implementation close review — 2026-09-30

Transient compile/test failures during implementation were limited to in-progress schema fixtures and call-site typing, corrected before release verification. The new EvidenceAtom and Jev transport regressions cover the affected boundaries. No recurring cross-project skill, routing, or product-incident pattern was found; maintenance outcome: `reviewed-none`.

The `0.2.91` candidate builds on the first Semantic Evidence Plane implementation slices without claiming R5 completion: `EvidenceAtom v2` (exact-observation freshness), `Document Surface v1`, deterministic `Librarian Contract v1`, explicit `Librarian Coverage v1`, and privacy-bounded adapters for every required producer family. R5.C has its first production migration through `document-context`; Project Context and skill loaders remain separate compatibility slices. The 14-family coverage inventory now reports 11 fully instrumented required producers, 2 partial conditional producers (`host-tool-runtime-metrics`, `git-filesystem-revisions`) and 1 missing conditional producer (`visual-qa-evidence`): required coverage is complete, while global coverage remains incomplete with exactly 3 conditional gaps. The portable host-runtime adapter validates bounded `tool-call`, `runtime-generation`, `runtime-health` and `metric` observations while rejecting raw arguments/results, free-form error text, prompts/transcripts and host storage paths; this moves portable runtime coverage from missing to partial. Bridge `0.6.141` now provides explicit host-scoped adoption evidence for that adapter through exact package `pkg:0.2.89#b362ba6f`; the host also maps `context_assembly` and `project_context_selection` telemetry while preserving event ids. Explicit verification still requires independent verifier/proposal provenance before feedback can count as truth, and Semantic Experience promotion thresholds remain unchanged. Focused regressions and full `npm run verify` pass on `mssr-build:sha256:67a0cda845b8baa1` (116 files / 1,278,957 bytes), including the host-runtime adapter, all Librarian/EvidenceAtom coverage, cross-host conformance and read-only skill audit with no blocking warnings. The 0.2.89 package is built and its local consuming-host adoption is verified; public publication remains separate. The 0.2.90 correction narrows same-source-revision grouping to matching namespace, kind, source revision and payload fingerprint; full `npm run verify` passes on `mssr-build:sha256:9f2a5f71a4121802` (116 files / 1,279,113 bytes). The 0.2.91 release candidate adds EvidenceAtom v2 proof-bound freshness, injectable Jev transport, and bounded Librarian metadata; full `npm run verify` and host conformance pass on `mssr-build:sha256:4aa3c3c9a9258b34` (117 files / 1,286,924 bytes).

## Active execution priority — 2026-09-19
The near-term reliability program remains explicit in `ROADMAP.md`. **R1 Trace Identity Integrity, R2 Automatic Lifecycle Coverage, and R3 Context Economy v2 are complete end-to-end.** R4 ADR 0006 remains in longitudinal measurement: representative precision/recall, abstention/noise, and context-cost evidence must still accumulate; no classifier has been promoted to routing, notice, or write authority. Detailed current-truth and relation/retrieval boundaries remain in their indexed modules.

Latest Project Context Health on 2026-10-04 reports a valid 30-module manifest at level `review`; the recalculated `mssr-learning-dataset-state` fingerprint is current and the stale-sidecar finding cleared. The prior 15 planner candidates remain review-only: nine confidence/research sections inherit broad selectors and would not reduce delivered context without fragmenting related evidence; other handoff/state candidates were reviewed in place. The Librarian metadata source now has three exact-heading modules: ownership invariants (434/700 bytes), declaration plus compatibility (1,673/2,400), and projection/stale-data behavior (1,564/2,200). The Markdown source remains byte-identical. Loader regressions prove implementation (`coding/edit/code/nominal`) and debugging (`coding/debug/code/error-observed`) load invariant plus projection (1,998 bytes), while design/document loads declaration plus invariants (2,107 bytes); unrelated artifacts/actions do not load projection. The direct health readback found zero Librarian module-budget findings; overall project health remains `review` for separate findings. `PROJECT_MEMORY` and `PROJECT_STATE` remain large, and the `Current release` core slice is 1,757 characters with no current-release budget finding.

The visible maintenance review changed no stable architecture or decision; PROJECT_CONTEXT and PROJECT_MEMORY remain unchanged. The matcher inspection and Librarian metadata split are complete in 0.2.103, with source bytes unchanged and positive/negative real-manifest loader fixtures passing. No routing algorithm or skill route changed. Next: recheck Project Context Health after the next real module/manifest change; leave the nine broad planner candidates review-only until a selective-ref proof shows they reduce delivered context without fragmenting related evidence. Core narrowing and telemetry-derived knowledge remain review-only.

The owner worksheet has 32 bilingual concept pairs; its 38 proposed citations span 28 source paths, with 32 blank owner-label blocks. Source/concept clusters are not independent until grouped, and no ranges are owner-adjudicated. Two blind AI reviews of the original 18 remain review aids, not gold labels. An offline diagnostic of two frozen MSSR 0.2.97 runs reports strict-heading Brier/log loss only (direct 0.17809/0.51479; hierarchical 0.16692/0.48701); these do not calibrate answer quality or Noul and do not set a threshold. Full method and gates are recorded on codex/benchmark-archive in experiments/jev-metadata-integration/CONFIDENCE_DIAGNOSTIC.md. The next gate is owner adjudication plus a fresh grouped benchmark plan; live Jev still requires a reviewed immutable receipt and exact user token.

## Machine-readable current-state claims
<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.105 -->
<!-- mssr-version:bridge.live=0.6.153 -->

<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

Semantic Experience remains separate from routing authority. `0.2.87` automatically projects the privacy-safe `learning-digest-v1` into bounded trace-linked context-selection, drift, maintenance and abstention shadows and records fallback abstentions without self-verification. The store is now accumulating real cross-project shadows, including context-selection, but independent confirmed/corrected evidence remains insufficient for promotion. Preference remains leave-one-project-out gated and blocked until the existing breadth/precision/coverage/zero-wrong thresholds pass. `0.2.88` near-match diagnostics are routing-repair metadata and do not grant Semantic Experience any routing influence. The entire learning plane remains advisory with `authorityInfluence=false`, `routingInfluence=false`, `canonicalRewriteAllowed=false` and `autoApplyAllowed=false`.

Bridge readback on 2026-10-04 at 13:34 UTC returned 3,688 Semantic Experience observations, all shadow-only: 3,248 context-selection, 436 maintenance-disposition, and 4 semantic-relation; verified, corrected, rejected, eligible, and generated-rule counts were all zero. The separate Semantic Curation Learning store returned zero observations. These global runtime counts are not ground truth, calibration examples, or permission to promote a rule.

## Core skill package state

The first-party package remains five MSSR operational skill roots. `0.2.91` added evidence provenance/freshness validation and an injectable Jev host boundary; `0.2.90` fixed false same-source-revision duplicate groups; no new routed skill is introduced. Semantic Experience remains portable core/MCP capability rather than a routed skill. The older Bridge `0.6.141` / MSSR `0.2.89` receipt is historical and superseded by the local Bridge `0.6.142` post-restart adoption of MSSR `0.2.93` recorded above.

## Semantic Experience handoff — 2026-09-29 (historical)

The file `docs/HANDOFF_SEMANTIC_EXPERIENCE_LAYER_2026-09-29.md` remains preserved as recovery history. Its version-specific 0.2.86/0.2.88/0.2.91 next steps are superseded by the implementation and host status above. The historical Jev benchmark archive remains on `codex/benchmark-archive` with its audit note; preserve its original measurements and do not treat them as current calibration. Semantic Experience promotion remains blocked pending independently verified held-out evidence.

## Context-economy follow-up

The earlier Project Context segmentation work remains intact: parent-internal baseline+optional segments keep history pressure bounded without changing logical identity or raising selected-payload budgets. R3 `0.2.70` applies the same economy principle to procedural skill guidance across replans through exact host-attested retained unit ids plus content fingerprints. `0.2.79` extends the principle to inheritance and arbitrary Markdown while reconciling routing proportionality: parent authority no longer promotes optional descendants into required paging, adjacent document manifests expose compact authority cores plus proportional relevant/deep modules, broad domain breadth is capped, and read-only friction does not create maintenance by itself. Historical delivery is never retention evidence; omitted or stale receipts re-enable normal delivery. Architecture Core slimming still preserves universal invariants and the existing 5,000-character core budget.

## Future event-trigger capability handoff

`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` remains a separate future design candidate. It is not part of the `0.2.63` semantic-segmentation contract.

## Repository reconciliation — 2026-09-17

The canonical repository is now mainline-only after a branch/worktree audit. `C:\Dev\mssr` is a junction to `D:\Dev\mssr`. `feat/context-semantic-segmentation` was exactly `main`; `feat/context-auto-modularization` was one commit behind with zero unique commits. Both local and remote feature refs were removed after containment checks. Detached Codex worktree `5142` was inactive since 2026-09-03; all substantive routing, schema, fixture, host-gated test and documentation additions in that tree are already present on current `main`, while its remaining unmatched state/index text was obsolete. The worktree was removed without merge/cherry-pick. Three unreachable `NO` commits are duplicate snapshots of that superseded tree and require no recovery. Bridge `0.6.128` is aligned to MSSR `0.2.63`. Independent dirty work in `D:\Dev\mauroprime-skills` remains outside this repository and must not be reset from MSSR maintenance. See `docs/HANDOFF_REPOSITORY_RECONCILIATION_2026-09-17.md`.
