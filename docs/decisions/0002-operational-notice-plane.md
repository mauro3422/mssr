# ADR 0002 — Operational Notice Plane ownership

- Status: accepted
- Date: 2026-08-15

## Context

MauroPrime already had several ways to surface operational evidence: Bridge `bridgeNotices`, MSSR lifecycle/routing notices, daily Skill Health, Project Context Health, Context Messages, outcomes, and project-specific watcher diagnostics. OmnySystem also demonstrated a mature adjacent pattern: recent logger/watcher/runtime diagnostics are collected around MCP tool calls and injected into ordinary tool results.

Without an explicit ownership boundary, new producers could create parallel queues, confuse Context Messages with operational alerts, or repeatedly notify stable REVIEW states after each daily snapshot.

## Decision

Create one conceptual **Operational Notice Plane** with split ownership:

- **portable MSSR owns host-neutral attention/transition semantics**;
- **Bridge and other hosts own observation I/O and delivery transports**;
- **Bridge keeps `bridgeNotices` as its only general notice queue/delivery mechanism**;
- **producers supply bounded evidence/fingerprints and never gain mutation authority**;
- **trace, outcome, Context Message, and operational notice remain distinct contracts**.

Default levels are `ok < watch < review < error`, with `review` as the attention threshold. Stable OK/WATCH stays quiet. Stable actionable evidence does not re-notify. Entering/changing/escalating/deescalating/leaving the actionable threshold creates an advisory transition candidate.

A notice may recommend a host action, but it never authorizes or executes that action automatically.

Gate D (MSSR 0.2.29) makes that policy parity observable without changing ownership: native, Codex and OpenCode register the same `mssr_operational_notice_evaluate` schema and evaluator, and cross-host tests require identical decisions/candidates for identical bounded evidence. The tool is evaluation-only; delivery queues, TTL/history, push/piggyback/UI and executable host actions remain adapter responsibilities and are intentionally not normalized by this gate.

Gate E1 (MSSR 0.2.30) realizes the semantic half of that refinement: portable MSSR owns the strict versioned `MssrNotice v1` payload/identity, including stable lifecycle `noticeId`, fixed SHA-256 event/evidence `dedupeKey`, provenance/attention/severity, bounded details and `advisoryOnly`. The transition evaluator still compares the original semantic fingerprint; the envelope keeps single-line fingerprints up to 240 characters inline and represents larger/non-single-line fingerprints as `sha256:<length>:<digest>`.

Gate E2 (MSSR 0.2.31) makes the separation mechanically testable. MSSR exposes deterministic validated semantic serialization/equality for `MssrNotice`; host wrappers may add or change delivery metadata without entering that semantic representation. Tests prove that queue ids, TTL/timestamps, attempts, delivery state, history/UI/actions and object-key ordering cannot alter a preserved notice, while any actual semantic field change remains observable. The strict schema rejects delivery metadata inside the notice and inside `details`. E2 deliberately introduces no queue, sink, retry spool, scheduler or host delivery adapter.

Gate E3 is now adopted live by Bridge 0.6.106 with packaged MSSR 0.2.31. `BridgeNotice` remains Bridge-owned and the existing Bridge queue remains the only Bridge transport; a genuine `MssrNotice` is preserved as a separately validated nested payload with stable lifecycle identity, while Bridge queue ids, TTL/timestamps, occurrences, UI/details mirrors and executable suggestions stay outside portable semantics. Bridge-native and foreign MCP notices retain their source identity and are not normalized into synthetic MSSR notices.

Gate E4 (MSSR 0.2.32) adds direct-host parity without standardizing transport. `deliverMssrNoticeV1(...)` validates and immediately hands one semantic notice to an explicit host callback; native/CLI-style hosts may use it directly, and Codex/OpenCode inherit the same boundary through `MssrAdapter.noticeDelivery` / `deliverNotice(...)`. Host receipts are opaque and may differ arbitrarily. An absent boundary fails closed, host exceptions propagate, and portable MSSR does not add retry, queue, persistence, scheduling, UI, actions, or permission semantics. Gate D remains evaluation-only and the MCP catalog remains unchanged. Gate E5 remains the final migration/invariant integration gate.

## Consequences

Positive:

- no duplicate notification transport;
- daily health audits become transition-driven rather than repetitive;
- the same pure policy can be inherited by Bridge, Codex, OpenCode, or future adapters;
- host-specific delivery remains free to use MCP response piggybacking, CLI output, or another explicit boundary;
- operational attention can evolve without contaminating durable project truth.

Costs:

- producers need a previous observation or equivalent lifecycle evidence to suppress stable states;
- each host must map portable candidates to its own bounded delivery envelope;
- source tests do not prove runtime delivery, so package/restart/readback remains a separate gate.

## Rejected alternatives

### Create an MSSR-owned Bridge-style queue

Rejected because Bridge already has the correct queue/TTL/dedupe/history/delivery infrastructure. A second queue would create split authority and duplicate lifecycle semantics.

### Reuse Context Messages for all alerts

Rejected because Context Messages carry selected task facts/continuity with repository/provider ownership and explicit durable inbox semantics. Operational alerts are attention transitions and may be transient host/runtime conditions.

### Treat outcomes as alerts

Rejected because outcomes are closure evidence. Missing/invalid outcome state may produce a notice, but the outcome itself is not the notice transport.

### Notify every non-OK observation

Rejected as noisy and self-defeating. WATCH is quiet by default, and persisted previous-state comparison suppresses repeated unchanged REVIEW observations.

## Follow-up

The first slice applies this policy to Skill Health and Project Context Health. Existing lifecycle/outcome, project-maintenance, freshness, provider/runtime, and routing anomaly producers should migrate incrementally with regression coverage rather than through one broad rewrite.
