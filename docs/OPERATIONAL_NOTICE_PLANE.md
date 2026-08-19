# MauroPrime Operational Notice Plane

## Purpose

The Operational Notice Plane is the cross-host advisory channel for conditions that deserve an agent's attention while work is in progress or when a later tool boundary becomes available.

It formalizes an existing pattern instead of creating a second notification subsystem:

- portable MSSR decides whether bounded evidence represents a meaningful attention transition;
- the active host decides how to deliver that candidate;
- Bridge already owns `bridgeNotices`, including bounded payloads, queueing, TTL, dedupe, automatic drain into ordinary MCP tool responses, and recent history;
- project/runtime systems may produce evidence, but they do not gain authority to execute recovery actions.

The design was validated against the existing OmnySystem pattern, where logger/watcher/runtime/governance diagnostics are collected around MCP tool execution and `_recentErrors` is attached to normal tool results. MauroPrime keeps the useful property—ambient operational evidence reaches the agent without requiring a special polling tool—but uses the already-general `bridgeNotices` host transport rather than copying `_recentErrors`.

## What this is not

The Notice Plane is not:

- a replacement for MSSR traces;
- a replacement for outcomes;
- a replacement for Context Messages or the durable Context Plane inbox;
- a new durable source of project truth;
- a permission or auto-fix channel;
- proof that the host UI can receive unsolicited server push.

A notice may only be delivered when the host has an observable delivery boundary. In Bridge today that normally means the next MCP tool response. No contract may assume a notice itself creates a new ChatGPT turn.

## Four distinct concepts

### Trace

A trace correlates one task lifecycle: route, active skills, phase transitions, verification, persistence, maintenance, and outcome.

### Outcome

An outcome records how an execution or task ended and what evidence supports that result. Outcomes are closure evidence, not an ambient alert stream.

### Context Message

A Context Message transports bounded facts or continuity evidence selected for the task. Repository/provider facts retain their canonical owners. Durable inbox delivery uses explicit acknowledgement semantics.

### Operational Notice

A notice says that bounded evidence crossed an attention boundary and the current/future agent should see it. Examples:

- routing compliance is missing;
- an MSSR lifecycle is stale or incomplete;
- Skill Health moved into REVIEW;
- Project Context Health moved into REVIEW;
- a previously actionable condition resolved;
- runtime/provider health changed materially;
- project-context freshness became unsafe to trust;
- a host transport restarted and prior in-memory coordination may need recovery.

The dashboard is only a human projection over these systems and their histories.

## Ownership

### Portable MSSR owns

- the host-neutral attention levels and transition semantics;
- the rule deciding whether a new observation should create an advisory candidate;
- opened/changed/escalated/deescalated/resolved transition classification;
- the no-authority invariant;
- cross-host tests for the pure policy.

Portable entry point:

```ts
evaluateMssrOperationalNoticeTransition(...)
```

Gate D (0.2.29) also exposes the same evaluator as `mssr_operational_notice_evaluate` on native, Codex-local and OpenCode-local MCP servers. This is an **evaluation parity contract**, not a delivery contract: all three hosts must publish the same input schema and return identical advisory decisions/candidates for identical bounded transition evidence. The tool does not enqueue, persist, push, display, drain, attach TTL/history, or execute recommendations. A consuming host may map the returned candidate to CLI output, MCP response piggybacking, Bridge `bridgeNotices`, or another explicit boundary without changing the portable candidate semantics.

### Host adapter owns

- observing host/runtime/project evidence;
- producing bounded fingerprints from that evidence;
- mapping a portable candidate to the host's transport envelope;
- queueing, TTL, delivery, history, UI projection, and host-specific suggested actions;
- proving delivery/runtime adoption separately from source tests.

Bridge uses its existing `BridgeNotice` transport. There must not be a parallel MSSR notice queue inside Bridge.

### `MssrNotice v1` semantic/delivery split

Gate E1 (0.2.30) promotes the portable notice itself to the strict versioned `mssr-notice-v1` semantic contract. The boundary is deliberately narrower than a universal notice runtime:

- `MssrNotice` owns portable meaning, provenance, a stable lifecycle `noticeId`, event/evidence-specific collision-safe `dedupeKey`, attention/severity, bounded evidence/details, recommendation, and the no-authority invariant;
- `noticeId` is stable for one source/code/subject lifecycle. `dedupeKey` is a fixed SHA-256 identity over that lifecycle plus event, current level and the original semantic fingerprint, so changed evidence or resolution remains distinguishable without embedding a potentially large fingerprint in the protocol;
- fingerprints up to 240 single-line characters remain inspectable inline. Longer or non-single-line producer fingerprints are represented in `MssrNotice.details.fingerprint` as `sha256:<original-length>:<digest>`; transition/stability comparison still uses the original upstream semantic fingerprint before envelope construction; queue state, TTL, delivery timestamps/attempts, recent history, UI projection, and executable host suggestions remain rejected host delivery metadata;
- Gate E1 proves identical emitted payload semantics on native MSSR, Codex and OpenCode through the existing `mssr_operational_notice_evaluate` contract; it does not create another MCP tool or delivery queue;
- Bridge keeps `BridgeNotice` for Bridge-native runtime/tool/provider/mismatch notices and as its queue/delivery envelope. Gate E3 is live in Bridge 0.6.106 with packaged MSSR 0.2.31: a genuine `MssrNotice` is validated and preserved as a separate nested payload, while Bridge queue ids, TTL/timestamps, occurrences, UI/details mirrors and executable suggestions remain outside it;
- a foreign MCP notice/error that does not implement `MssrNotice` is still relayed by Bridge as a source-attributed Bridge/native notice and is never silently relabeled as MSSR semantics;
- Gate E4 (0.2.32) adds direct-host parity without Bridge: native/CLI-style hosts call `deliverMssrNoticeV1(...)`, while Codex/OpenCode inherit `MssrAdapter.noticeDelivery` and `deliverNotice(...)`. Each host may return arbitrary opaque delivery receipts while the portable semantic notice remains unchanged.

Gate E2 (0.2.31) freezes the semantic/delivery boundary as an executable contract rather than documentation only. `serializeMssrNoticeV1(...)` first validates and then emits one deterministic semantic representation, while `hasSameMssrNoticeV1Semantics(...)` compares only that portable payload. Contract fixtures deliberately wrap the same notice in Bridge-like, CLI-like and OpenCode-like delivery metadata, reorder source object keys, and vary queue ids/timestamps/attempts without changing semantic equality; conversely, any semantic field change remains observable. The strict notice schema rejects queue/TTL/attempt/timestamp/history/UI/action fields both at the top level and inside `details`. These helpers are parity/preservation checks only: E2 adds no queue, sink, spool, scheduler or delivery adapter, and existing Context Message/OpenCode telemetry queues remain separate contracts.

Gate E4's immediate delivery helper does not add queueing, persistence, retry, scheduling, UI, actions or permission semantics. An unconfigured adapter fails closed rather than inventing transport; a host delivery exception is surfaced to the caller exactly as a host failure and MSSR does not retry or reinterpret it. Gate E5 remains the final migration/invariant integration gate. Bridge 0.6.106 remains on packaged MSSR 0.2.31 until a later explicit host adoption; the 0.2.32 source release does not silently upgrade Bridge.

### Producer owns

A producer owns only the evidence it can legitimately observe. It must not silently turn a notice into a mutation. For example, Project Context Health can say that a manifest is under structural pressure; it cannot rewrite `.mssr/project-context.json` from the scheduler.

## Portable levels

The initial shared level vocabulary is:

```txt
ok < watch < review < error
```

Default attention threshold is `review`.

`watch` is intentionally quiet by default. A specific producer may opt into WATCH notifications, but that is an explicit policy choice rather than a global behavior.

## Transition policy

Default policy:

| Previous | Current | Same bounded fingerprint? | Notice |
|---|---|---:|---|
| unobserved | OK | n/a | no |
| unobserved | WATCH | n/a | no |
| unobserved | REVIEW/ERROR | n/a | opened |
| OK/WATCH | REVIEW/ERROR | n/a | opened |
| REVIEW | REVIEW | yes | no |
| REVIEW | REVIEW | no | changed |
| REVIEW | ERROR | any | escalated |
| ERROR | REVIEW | any | deescalated |
| REVIEW/ERROR | OK/WATCH | n/a | resolved |
| OK/WATCH | OK/WATCH | any | no |

This is deliberately stronger than queue-level dedupe. A host queue can suppress repeated notices while an item remains pending, but a daily scheduler would otherwise recreate the same REVIEW after the previous notice had already been drained. The portable transition evaluator suppresses that stable state using the previous persisted observation.

## Fingerprints

A fingerprint represents only the bounded evidence that makes the condition materially different.

Good fingerprint inputs:

- stable issue/reason codes;
- affected bounded target identifiers;
- health state or manifest state;
- a content/evidence revision when that revision materially changes the diagnosis.

Bad fingerprint inputs:

- timestamps;
- raw prompts or transcripts;
- full source file contents;
- volatile counters that would cause a notice every observation;
- secrets or private reasoning.

Bridge's first health adapters hash bounded structural inputs before passing them to the portable policy.

## Candidate contract

A portable decision may contain a candidate with:

```txt
severity
code
source
subject
message
recommendation?
dedupeKey
details:
  event
  previousLevel
  currentLevel
  fingerprint
  advisoryOnly=true
```

Host-specific executable tool names are intentionally outside the portable contract. Bridge may attach a bounded suggested action such as `project_context_audit`, but that action remains a recommendation and never grants authorization.

## Delivery semantics

Bridge delivery currently follows:

```txt
producer evidence
  -> portable transition decision
  -> BridgeNoticeInput adapter
  -> emitBridgeNotice()
  -> bounded pending queue + recent history
  -> automatic drain on a later normal MCP response
  -> agent observes and decides what to do
```

Important consequences:

1. notices cannot interrupt an opaque active tool call;
2. a transient HTTP/connector failure does not prove the underlying tool operation failed;
3. restart can invalidate RAM-only coordination, so persisted/explicit correlation must remain available;
4. delivered notices remain advisory evidence even when they include a suggested preflight/recovery tool.

## First implementation slice

MSSR 0.2.19 establishes the portable transition evaluator.

Bridge 0.6.99 consumes it for:

- Skill Health daily snapshots;
- Project Context Health daily snapshots.

The schedulers now expose their previous persisted snapshot to the host adapter. Bridge computes structural fingerprints per skill/project and emits only meaningful transitions.

This changes the old Project Health behavior from "emit every daily snapshot containing REVIEW" to "emit when a project enters REVIEW, materially changes while actionable, escalates/deescalates, or leaves the actionable threshold."

Skill Health gains the same behavior without adding a new transport.

## Second slice: lifecycle, maintenance, freshness

MSSR 0.2.20 adds portable projections from lifecycle, project-knowledge maintenance, and Context Plane freshness into the shared attention levels. MSSR 0.2.21 adds C2a infrastructure/provider projections; MSSR 0.2.22 adds C2b routing-compliance projections; MSSR 0.2.23 adds C2c consistency projection over bounded structured claims; MSSR 0.2.24 adds C2d evidence-first recommendation planning over that C2c diagnosis. These policies do not deliver notices and do not perform I/O:

- trace lifecycle: the host may report a bounded idle observation, but silence can only project to `REVIEW`; it never proves completion, synthesizes an outcome, or escalates to `ERROR` by itself;
- project-knowledge maintenance: `review -> REVIEW`, `required -> ERROR`; an accrued maintenance obligation remains actionable until maintenance is closed for the current lifecycle revision, then resolves, and a later material invalidation can reopen it;
- Context Plane freshness: `fresh -> OK`, unknown-only evidence -> `WATCH`, stale/unavailable evidence -> `REVIEW`, and conflicting owner/provenance/reference evidence -> `ERROR`;
- infrastructure health: tunnel, runtime continuity, restart state, and a separately supplied transport symptom are correlated without collapsing them into one status. Response loss/upstream HTTP failure alone is `WATCH`; response loss plus independently proven runtime restart is `REVIEW`; unavailable tunnel/runtime or failed restart is `ERROR`;
- provider health: provider/catalog availability and target readiness/continuity are distinct. Warming/inactive target state is quiet `WATCH`; missing/ambiguous/inspection-failed target is `REVIEW`; provider unavailability is `ERROR`;
- routing compliance: ordinary unrouted evidence stays quiet `WATCH`; substantial work without routing, missing/ambiguous trace attribution, phase-boundary required-skill misses, and premature trace replacement become `REVIEW`; trace mismatch or invalid outcome closure becomes `ERROR` where attribution/closure safety is at risk. Only required skills/phases are compliance obligations; optional selected-but-not-loaded skills are not failures.
- consistency projection: hosts submit bounded observations under one semantic `key`, with independent `role` (`source`, `generated`, `installed`, `runtime`, `memory`, `receipt`, `state`, `reference`, `other`) and `authority` (`canonical`, `replica`, `historical`). Freshness and current consistency are separate: a historical receipt may be intact/fresh as historical evidence while its claim is stale against the current canonical authority. Canonical conflicts are `ERROR`; ordinary replica/historical mismatches are `REVIEW`; required generated/installed/runtime mismatches at `pre-release`, `post-restart`, or `outcome` boundaries are `ERROR`; missing optional evidence remains quiet `WATCH`. Recovery actions remain advisory and no free-form project memory is heuristically rewritten.
- consistency recommendation planning: C2d keeps C2c diagnosis immutable and ranks advisory candidates under `evidence-first-v1`. Hard source-of-truth/dependency gates are evaluated before score; ready/deferred status, confidence, information gain, risk, reversibility, cost, blast radius, mismatch coverage and score breakdown remain bounded/auditable. Canonical conflict prioritizes owner inspection; unproven source defers generated repair; known generated drift defers downstream runtime verification; historical disagreement prioritizes evidence revalidation; empty evidence may abstain. Numeric ranking never grants permission or executes recovery.

Fingerprints are deterministic and portable. They intentionally exclude volatile host fields such as idle milliseconds, PID, runtime boot UUID, timestamps, request text, prompts, and activity counters, so repeated observations of the same underlying condition stay quiet while changed semantic evidence still produces `changed`/`escalated`/`deescalated` transitions.

A host that observed a client-side `502 Bad Gateway` or lost response must not fabricate an MSSR runtime failure. The transport symptom can be supplied as bounded evidence and correlated with independently observed boot/restart/tunnel/provider state. If that evidence is unavailable, the correct state is uncertainty/WATCH rather than a guessed restart or failed operation.

## Next producers

Continue incrementally rather than rewriting all notices at once. Routing compliance/required-skill anomalies are on C2b and structured project-knowledge/version mismatch semantics are on C2c. Remaining candidates are:

1. host evidence adapters that translate additional explicit project/runtime claims into C2c observations without parsing or rewriting free-form project truth;
2. selected project-specific watcher/diagnostic producers where a reusable contract exists.

Each migration must preserve existing safety behavior and add regression tests before removing producer-specific logic.

## Verification gates

For each producer family:

- pure transition policy test;
- stable-state negative test (no repeated notice);
- actionable-entry test;
- material-fingerprint-change test;
- resolution test;
- payload privacy/bounds test;
- no-auto-action invariant;
- host delivery test where applicable;
- source/runtime package and restart readback when host executable behavior changes.

## Non-goals for the first slice

The first slice intentionally does not:

- add MCP server push;
- persist a second notice database;
- replace Bridge notice history;
- add learned notice prioritization;
- make WATCH noisy;
- infer agent authorization from a notice;
- auto-run a suggested action;
- migrate every existing Bridge notice producer in one release.
