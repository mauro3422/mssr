# Priority handoff — Small-task / resume context economy

Date: 2026-08-27
Priority: **P0 after the current Smartwatcher GPS pre-release gate**
Status: **queued investigation; no fix implemented by this handoff**
Current published/source baseline: MSSR `0.2.57`
Current unrelated unreleased work: `0.2.58` draft visual-lifecycle correction (`MSSR-041`)

## Purpose

Resume this investigation after the Smartwatcher GPS release candidate is closed. The observed problem is not simply that MSSR lacks context pagination: `0.2.57` already supports bounded paged skill context and Bridge `0.6.117` previously completed a live 32k chain in four pages. The new issue is **proportionality**: a small read-only/resume task can still select enough routing, lifecycle, project context, context messages and procedural skill material to consume the envelope, activate unrelated obligations, or block closure.

Do not conflate this handoff with `MSSR-041`. The `0.2.58` draft fixes a visual-evidence false positive by requiring `visual-qa` + `human-approval` through `allNeeds`; it does not claim to solve the context-economy problem described here.

## Trigger task

A ChatGPT Web session resumed `D:\Dev\zomboid-smartwatch-network` with a narrow goal: read the latest handoff/current project state/Git state, report where work stopped, and do no mutation or publication.

Expected shape: a cheap read-only resume/review.

Observed shape: substantial routing/lifecycle/context activation before the project handoff itself could be read.

## Confirmed evidence

### 1. Bootstrap blocked on an indivisible selected unit

The first `skill_bootstrap` attempt failed with:

`Selected skill context contains an indivisible unit that cannot fit the 32000-character response envelope (page budget 389, compact metadata 22392). Increase maxEnvelopeChars or modularize the owning skill.`

This is explicit blocker evidence under the current paged-context contract. It is not a silent overflow.

### 2. Read-only resume over-routed into publication/maintenance lifecycle

The structured retry used read-only risk, `discover/review/analyze/verify`, and project/repository/document artifacts. Route trace:

`mssr-20260828010415-22f85d29-02f`

The route selected four required roots, including `git-change-publication` and `skill-maintenance-loop`, even though the task explicitly required no Git publication or persistence. At close, the route still reported persistence/maintenance lifecycle obligations. A success outcome was then rejected with:

`mssr-success-outcome-blocked-stale-close`

This does not by itself prove each selected workflow is wrong, but it proves the lifecycle cost was disproportionate to the observable task.

### 3. The handoff-writing task reproduced high context pressure

A second structured trace was opened specifically to document this issue:

`mssr-20260828012157-60c79a01-b6e`

For a documentation-only task, Project Context selection left only **383 chars** of a 12,000-char project-context budget. Context Message selection consumed **5,558/6,000 chars**, leaving **442 chars**.

The Context Message set also exposed duplicate ADR observations for the same documents under both historical `C:/Dev/mssr` and canonical `D:/Dev/mssr` owners. This is concrete alias/deduplication pressure worth investigating; it is not yet proven to be the primary cause of the original bootstrap blocker.

### 4. A real deploy close reproduced stale-close after all checkpoints

The Linux dedicated Smartwatch deployment used a separate trace:

`mssr-20260828011443-59f7c2e4-566`

That task had observable runtime success: the exact 68-file build `a877693865478a37` was hash-verified on the remote host, persisted with a backup, restarted, and reached `SERVER STARTED` with Smartwatch integrity `status=ok`. The trace then recorded successful verification and persistence plus an explicit maintenance review. After a `close` replan with all phases listed complete, `outcome=success` was still rejected with `mssr-success-outcome-blocked-stale-close`. A second close replan again showed no missing phases, yet the outcome was rejected by the same stale-close gate.

This strengthens the lifecycle concern because the failure reproduced outside the original read-only handoff inspection. It does **not** invalidate the remote deployment; it is an observability/closure failure in the MSSR trace contract or host integration and should be isolated separately from payload/runtime correctness.

### 5. Existing prior fixes are relevant but insufficient

`MSSR-040` already corrected underestimated serialized Context Message accounting. The current problem occurs after measured budgeting exists.

MSSR `0.2.57` already supports variable page budgets and bounded continuation. Bridge `0.6.117` previously completed a full live 32k continuation in four pages without blocked units. Therefore the investigation should focus on **selection quality, metadata/envelope cost, unit granularity, aliases and lifecycle proportionality**, not merely add more pagination or increase budgets.

## Working hypotheses — not conclusions

1. Compact routing/project/context metadata can consume too much of the first response envelope before procedural paging begins.
2. Generic `review`, `verify`, `project`, `repository`, `document`, `history-recovery` or `cross-agent` signals may intersect too broadly and select unrelated project modules/messages.
3. Workflow requirements may activate publication/persistence/maintenance roots from domain/action overlap even when `risk=read-only` and no mutating action exists.
4. Close/persistence/maintenance obligations may not scale down enough for read-only work that produced no canonical mutation.
5. Historical canonical-owner aliases (`C:/Dev/mssr` versus `D:/Dev/mssr`) may defeat message deduplication and inflate bounded context.
6. Some selected skill/reference units may still be too coarse to fit a healthy page once metadata consumes the envelope.
7. Host-gated mode may correctly defer optional skills but still inherit oversized required workflow roots that should never have been required for the narrow intent.

Do not treat any hypothesis as root cause until a fixture/trace isolates it.

## Investigation contract

Start with evidence, not a budget increase.

Build a small benchmark matrix with at least:

- tiny read-only factual inspection;
- project resume + handoff read;
- read-only Git/status review;
- ordinary local code edit;
- verify-only task;
- real persist/release task;
- non-nominal debugging task.

For each case record only privacy-safe structured telemetry:

- intent/risk/stage;
- active + deferred + required skills/workflows;
- compact metadata chars;
- project-context selected chars/modules;
- Context Message selected chars/count;
- skill page budget, units, `partial/mustContinue`, blockers;
- phase/lifecycle obligations;
- tool-call count and replans;
- final outcome/closure requirements.

Compare ChatGPT Web and Codex-hosted paths when possible. Do not store raw prompts, transcripts, secrets or chain-of-thought.

Inspect at minimum:

- `src/skill-routing.ts`
- `config/skill-routing/skill-routing-overrides.json`
- `config/skill-routing/skill-routing-fixtures.json`
- Context Message selection/accounting code
- skill-context page/envelope assembly
- workflow required-root expansion
- close/persistence/maintenance lifecycle derivation
- canonical-owner/dedupe normalization for Context Messages
- first-party skill `context-modules.json` granularity
- `docs/skill-routing/INCIDENTS.md` (`MSSR-040`, `MSSR-041`)

Use `mssr_trace_evidence` / observatory data for the trace ids above before changing semantics.

## Acceptance criteria

A future fix is not done until all of these are demonstrated:

1. A small read-only resume can complete without an indivisible-unit envelope blocker under the normal 32k host envelope.
2. Read-only tasks do not acquire publication/persistence workflow roots solely from broad domain/artifact overlap.
3. Maintenance/close obligations are evidence-driven and proportional; a no-mutation inspection can close without artificial persistence debt.
4. Equivalent canonical-owner aliases are deduplicated or normalized without hiding genuinely different sources.
5. Context selection leaves a measurable healthy envelope for procedural guidance instead of routinely exhausting first-page metadata budgets.
6. Required skills remain fail-closed when they are genuinely required; optimization must not silently skip safety, integrity, packaging, localization or other explicit contracts.
7. Existing legitimate visual workflows remain active after `MSSR-041`; the Smoke Lab negative remains clean.
8. Add focused regression fixtures for every confirmed root cause.
9. `npm run test:skill-routing`, routing audit, `npm run verify`, and release gate pass after any semantic change.
10. A benchmark before/after shows lower selected chars/skills/tool churn for small tasks without false-negative routing on mutation/release/debug cases.
11. Any durable routing/schema/bootstrap semantic change gets its own versioned changelog and explicit PROJECT_CONTEXT / PROJECT_MEMORY / PROJECT_STATE impact declarations before persistence.

## Non-goals for the first pass

- Do not simply raise `maxContextChars`, host envelope size or module budgets to make warnings disappear.
- Do not weaken required-skill semantics globally.
- Do not remove lifecycle verification from real mutations/releases.
- Do not fold Bridge-specific execution policy into portable MSSR core unless the portable contract truly owns the behavior.
- Do not rewrite project knowledge automatically from telemetry.

## Resume order

1. Finish Smartwatcher GPS pre-release first.
2. Re-read this handoff plus current `PROJECT_STATE` and Git diff; preserve the existing `0.2.58` visual-lifecycle work.
3. Reconstruct evidence for `mssr-20260828010415-22f85d29-02f` and `mssr-20260828012157-60c79a01-b6e`.
4. Turn the smallest reproducible small-task case into a routing/context fixture or benchmark before implementation.
5. Isolate one cause at a time: workflow selection, context-message aliasing, metadata envelope cost, unit granularity, then close lifecycle.
6. Implement only verified causes and measure the before/after context economy.

This handoff is an investigation priority, not authorization to release `0.2.58`, bump the package version, publish, or modify Bridge adoption.


## 2026-09-03 coordination with vNext Lite evidence work

This investigation now also serves as one of the first real-data producers for `docs/HANDOFF_MSSR_LONGITUDINAL_ATTENTION_2026-09-03.md`.

When fixing context proportionality, preserve enough structured evidence to distinguish:

- candidate skill/context unit;
- host-gated decision (`accepted`, `pending`, explicit skip) and the deterministic reason;
- later signal-driven decision transition;
- exact materialized core/modules and measured character cost;
- observable application evidence rather than assuming `loaded == used`;
- downstream outcome/replan/user-correction evidence by comparable cohort.

Do not solve this handoff by adding embeddings, vector retrieval, a second model judge, or active historical routing influence. First prove whether current deterministic selection can reduce false activation and wasted context while preserving genuinely required obligations. Legacy traces remain diagnostic evidence; new instrumentation should be versionable as a cleaner activation-evidence cohort when its semantics differ.
