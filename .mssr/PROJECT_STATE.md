# MSSR project state

## Current release
MSSR `0.2.94` is a project-context, dependency-maintenance, and test-readiness release over `0.2.93`; it changes no portable decision logic. Exact Jev document sections are selectively indexed while their source documents and historical evidence stay intact. Full `npm run verify` passed locally on Node 24.16.0 / npm 10.9.9. The build receipt is `mssr-build:sha256:cfaaa9b0f9ad1977` (122 files / 1,365,461 bytes); `npm pack --dry-run --json` passed for 566 entries. The lockfile now resolves `fast-uri` 3.1.8, `hono` 4.13.12, `ip-address` 10.7.2, and `qs` 6.16.0; `npm audit` reports 0 vulnerabilities. OpenCode tests emitted the known best-effort Windows ACL warning; all verification gates passed. The local post-restart check confirmed Bridge `0.6.142` consuming MSSR `0.2.93`; this local host adoption is distinct from npm registry publication, which remains unclaimed after the configured registry returned 404. MSSR `0.2.93` added bounded host-supplied Librarian search/fetch, typed content-addressed semantic judgments, component-isolated Jev relation batches, and exact-source reversible synthesis previews. Its original full verification passed with the same build hash (122 files / 1,365,461 bytes), and `npm pack --dry-run --json` passed for 565 files (1,046,628 compressed / 6,127,189 unpacked bytes). The `0.2.92` package remains recoverable at `D:\Dev\mssr-snapshots\release-0.2.92-20260930\MANIFEST.json` (build `mssr-build:sha256:1f537b23769e1e6e`, full verify passed). Semantic Experience remains observe/shadow-only and its promotion gate remains blocked pending independently verified held-out evidence.

## Jev evaluation and path alignment — 2026-09-30

The rubric-matched live section run remains historical and exploratory: 48/51 action decisions for EvidenceAtom versus 45/51 for parent metadata, while lifecycle accuracy fell from 100% to 88.2%. The 51 requests repeat 17 sections; labels were not independently adjudicated. This does not establish a confidence cutoff, and these archived values are not being changed or used to drive runtime behavior. The current architecture and historical evaluation evidence now load through separate entries, `mssr-jev-confidence-merge-evaluation` and `mssr-jev-confidence-benchmark-history`. MSSR 0.2.93 exposes bounded search/fetch, relation review, and synthesis preview through MCP. A local Bridge 0.6.142 post-restart smoke adopted 0.2.93; it is not a live benchmark, confidence calibration, or public npm publication. MSSR still has no global index or authenticated verifier boundary.

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

### Bilingual retrieval and live Jev candidate selection — 2026-09-30

The frozen 21-document MSSR corpus was queried with 26 paired English/Spanish
questions. The current deterministic Librarian returned the expected exact
section in top 100 for 18/26 English queries and 4/26 Spanish queries; exact
target rank-1 recall was 0/26 in both. An isolated harness then passed those
same top-100 lists to real TypeSafe Jev `jev-1.13.0` for one closed-choice
selection per query. Jev selected the expected exact section for 12/26 English
queries and 3/26 Spanish queries (12/18 and 3/4 when the expected section was
offered). All 52 calls succeeded (501,232 input / 53,347 output tokens; 375.5
ms mean observed latency). A follow-up one-choice call over all 200 heading
sections plus `none` selected the expected exact section for 18/26 English and
16/26 Spanish queries (829,804 input / 105,392 output tokens; 409 ms mean).
On the same 52 queries it added 22 exact selections relative to the shortlist
run, while the shortlist alone added 3; the full-catalog choice therefore had
19 more exact expected-section selections overall. The full catalog resolves
the candidate-absence issue on this small corpus, at higher token use. Exact
fetch validation passed 48/48 full-catalog selections; the shortlist passed
32/33 selected ranges, with one size-limit rejection and zero revision/range/
fingerprint integrity failures in either path.

Run artifacts: `experiments/jev-mssr-live/runs/mssr-librarian-bilingual-retrieval-20260930-v1/`,
`experiments/jev-mssr-live/runs/mssr-librarian-jev-candidate-selection-20260930-v1/`,
and `experiments/jev-mssr-live/runs/mssr-librarian-jev-full-heading-choice-20260930-v1/`.
The target labels were double-reviewed by Luna agents, not approved by the
human document owner; exact-section scores are exploratory and confidence is
not calibrated. The grouped query holdout still uses the same corpus. This
demonstrates a bounded Jev selection call in an isolated harness, not an
automatic production MCP integration. Current Librarian search remains
deterministic; synthesis, contradiction quality, citation faithfulness and
write authority were not tested. Full-catalog results cover only 200 headings;
larger corpora may exceed Jev's 255-choice limit and require an evaluated
hierarchical selector or a higher-recall shortlist. Next, obtain independently
adjudicated multi-answer section labels and evaluate exact fetch plus
citation-faithful synthesis before an end-to-end shadow integration decision.

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

The near-term reliability program remains explicit in `ROADMAP.md`. **R1 Trace Identity Integrity, R2 Automatic Lifecycle Coverage, and R3 Context Economy v2 are complete end-to-end.** R4 ADR 0006 remains in its longitudinal measurement phase: portable Gates A-F and Bridge packaged adoption of the 0.2.72 baseline are complete, while representative precision/recall, abstention/noise and context-cost evidence must still accumulate. `0.2.73` does not broaden R4 semantic authority; it is a routing precision release for the applied Jev decision-system skill. Gate H remains shadow-only: no NLI/cross-encoder has been promoted, validated, or granted routing/notice/write authority. Detailed current-truth policy is indexed as `mssr-semantic-consistency-decision`; relation/retrieval/message/shadow policy is indexed separately as `mssr-semantic-relations-retrieval-decision`. Project Context Health is stable `watch` with no active findings or recommendations; unchanged advisory pressure remains non-blocking.

## Machine-readable current-state claims

<!-- mssr-state:roadmap.r1=completed -->
<!-- mssr-state:roadmap.r2=completed -->
<!-- mssr-state:roadmap.r3=completed -->
<!-- mssr-state:roadmap.r4=pending -->
<!-- mssr-version:mssr.source=0.2.94 -->
<!-- mssr-version:bridge.live=0.6.142 -->
<!-- mssr-version:bridge.mssr=0.2.93 -->
<!-- mssr-owner:semantic.consistency=mssr -->
<!-- mssr-decision:adr.0006=r4-bf-portable -->

## Learning dataset state

Semantic Experience remains separate from routing authority. `0.2.87` automatically projects the privacy-safe `learning-digest-v1` into bounded trace-linked context-selection, drift, maintenance and abstention shadows and records fallback abstentions without self-verification. The store is now accumulating real cross-project shadows, including context-selection, but independent confirmed/corrected evidence remains insufficient for promotion. Preference remains leave-one-project-out gated and blocked until the existing breadth/precision/coverage/zero-wrong thresholds pass. `0.2.88` near-match diagnostics are routing-repair metadata and do not grant Semantic Experience any routing influence. The entire learning plane remains advisory with `authorityInfluence=false`, `routingInfluence=false`, `canonicalRewriteAllowed=false` and `autoApplyAllowed=false`.

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
