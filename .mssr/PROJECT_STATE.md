# MSSR project state

## Current release
MSSR 0.2.105 is the latest local release-gated package: `mauroprime-mssr-0.2.105.tgz`, 1,108,872 bytes, SHA-256 `96aba5308ed126da12da6d9602c90429d174905a0a7422133a2630043576ec3b` (`pkg:0.2.105#96aba530`); it is unpublished. Full `npm run verify` and `npm run release:gate` passed on 2026-10-04. Receipt: `.mssr/runtime/releases/0.2.105.json`.

## Librarian and Jev host status — 2026-10-04

An earlier Jev smoke's Choice 0.27/Noul 0.65 remain uncalibrated. In this task, a direct MCP route projected two current sidecar entries and completed real Spanish/English search → exact fetch → verbatim evidence-pack checks; local 0.2.104 removed the reproduced English stopword-only false match, and 0.2.105 promotes fetchable exact ranges over oversized candidates only when their lexical scores tie. These are connectivity/integrity checks, not quality labels. Existing preflight evidence remains at `D:\MSSR-benchmark-artifacts\jev-sidecar-preflight-20261004-v1` (archive commit `2452933`); v18 lacked a Librarian sidecar.

At close on 2026-10-04, Codex-local MSSR diagnostics report loaded build `mssr-build:sha256:24589ca94bee83fd` and available 0.2.105 build `mssr-build:sha256:58b3d5447d10b847`, status `stale`. The active MCP's negative English control still returns three candidates from unrelated text sharing only a common article; local 0.2.104 returns zero. The positive real-document search/fetch/evidence-pack path passes, and 0.2.105 locally fixes tied oversized-parent ordering. Codex must reconnect or respawn the MCP server before this fix is adopted; no host restart or deployment has been performed. Keep the control wording outside retrieved documents to avoid contaminating later real-corpus probes.

## Natural-query diagnostic — 2026-10-04

Offline natural-query v3 (8 bilingual seeds/27 docs): top-20 overlap 159/160 and 16/16 exact fingerprints; ES top-1 ranges exceeded the 20K fetch cap while rank 2 remained fetchable. Ranking/fetchability only, not quality or calibration. Archive commit `ac56327` preserves v3 plus the corrected 38-range worksheet, provisional cluster map, and six unadjudicated seed proposals; all 38 file/range hashes, bounds, and headings now verify. Owner labels remain blank and no grouped split or confidence threshold is accepted. Summary: `experiments/jev-metadata-integration/evidence/natural-query-diagnostic-20261004.json`; full run: `D:\MSSR-benchmark-artifacts\jev-natural-query-diagnostic-20261004-v3`.

## Bridge catalog and checkout — 2026-10-04

Registry refresh at 2026-10-04 19:30 UTC reports the Bridge provider healthy with 185 uncached capabilities and unknown freshness. Its catalog has Librarian search/fetch/Jev selection/relation/preview, but no `mssr_librarian_evidence_pack`; active package identity remains unknown. The `D:\Dev\bridge-mcp` checkout is `codex/jev-bridge-adoption-20260930`, version 0.6.144/vendor MSSR 0.2.96, with extensive tracked and untracked changes; it was left untouched. Bridge adoption of MSSR source 0.2.105 and isolated candidate 0.6.156 remain unverified/not deployed.

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
