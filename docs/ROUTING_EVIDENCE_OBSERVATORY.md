# Routing evidence, notices, and outcome observability

## Purpose

MSSR routes from observable operational evidence, not from private chain-of-thought. The model or host may reason internally, but the routing boundary receives only a compact structured result that can be validated, logged, replayed, and compared.

This document defines three connected contracts:

1. the **Routing Evidence Checkpoint** produced before substantial specialized work;
2. the **context notice inbox** that adds new runtime/project evidence between actions;
3. the **outcome attribution contract** used to measure whether routed work actually succeeded.

## Reasoning-to-routing boundary

The normal host loop is:

```text
user message + visible context
  -> private model deliberation
  -> observable routing evidence checkpoint
  -> MSSR deterministic recommendations
  -> host decision for optional candidates (accepted / skipped)
  -> procedural context for required + accepted skills
  -> authorized tools
  -> new observable evidence
  -> replan at a meaningful boundary
```

MSSR cannot inspect or intercept private reasoning. The host must emit the checkpoint as a tool call or equivalent structured action. This is the activation hook that makes routing observable.

A checkpoint contains resolved operational conclusions such as:

```json
{
  "domains": ["skill-system", "coding"],
  "actions": ["analyze", "edit", "verify"],
  "artifacts": ["skill", "mcp", "document"],
  "needs": ["cross-agent", "integrity-verification"],
  "signals": ["error-observed", "replan-needed"],
  "risk": "write",
  "ambiguity": "low",
  "capabilityNeeds": ["restore editor interaction and measure the final outcome"]
}
```

It never contains a transcript, raw prompt, secret, or chain-of-thought.

## Activation guarantee

For substantial specialized work, the host protocol is:

1. load the smallest durable project context relevant to the task;
2. produce the Routing Evidence Checkpoint;
3. call `skill_route_plan` or `skill_bootstrap`;
4. preserve the returned `traceId`;
5. load the required skills for the active phase and any optional skills the agent judges useful;
6. replan after a phase transition, material failure, new capability, contradictory evidence, or repeated friction;
7. close with verification, persistence, and one attributed outcome.

Many candidates are acceptable. MSSR may optimize for high recall in metadata while the agent loads only the procedures needed for the active phase. The critical failure is not an extra candidate; it is omitted routing or an omitted required procedure.

For optional candidates, recommendation, decision and load are separate observations. A host may record `accepted` or `skipped` plus a bounded reason code such as `useful`, `irrelevant-domain`, `redundant`, `deferred-phase`, `context-budget`, or `not-evaluated`. A skip is feedback about that candidate in that task signature; it is not a global negative label for the skill and must not silently disable it elsewhere.

Historical selection feedback should first be grouped by auditable semantic signatures such as stage plus canonical domains/actions/artifacts/needs/signals. Frequency may propose a routing review; it must not directly rewrite scores or rules. Vector/embedding similarity may later help retrieve nearby historical signatures, but deterministic routing gates, fixtures, and explicit review remain authoritative.

`mssr-agent-routing` is the transversal owner of this protocol. Phrases such as “tags”, “metadata del pensamiento”, “segundo tick”, “activadores”, “MSSR helper”, “qué skill cargar” or “contexto inyectado” refer to this architecture when the conversation concerns routing or agent orchestration.

## Trace contract v1

The deterministic MSSR core remains stateless. A host adapter may maintain local session continuity plus a bounded process-shared lease. After a successful route it may propagate automatically only when one compatible trace can be identified:

```text
route
  -> required/current-phase skill loads
  -> trace-aware domain tools
  -> replan
  -> verification
  -> persistence
  -> close replan
  -> required maintenance on the latest persisted state
  -> latest effective outcome
```

Within the same session, callers should not have to copy `traceId` into every action. When a host issues stateless calls, the adapter may recover one unique candidate from observable task fingerprints, caller identity, selected/required skills, lifecycle state, and a bounded lease. It must emit an ambiguity notice and decline injection when several candidates fit. Explicit IDs remain necessary after restart, across processes, for ambiguous candidates, deliberate historical selection, or hosts that do not implement propagation. Generic dispatch wrappers must propagate into the delegated tool as well as direct calls.

The host emits bounded notices when continuity becomes unreliable:

- `mssr-orphan-skill-load`;
- `mssr-trace-missing`;
- `mssr-trace-mismatch`;
- `mssr-required-skill-not-loaded`;
- `mssr-outcome-without-route`;
- `mssr-success-outcome-blocked-stale-close` when required maintenance belongs to an older lifecycle generation than later work or persistence;
- active trace replacement before an outcome;
- `mssr-trace-ambiguous` when several concurrent traces fit.

An outcome closes the current task trace. A later `stage=start` request for another task receives a new trace. Replans, retries, verification, persistence, and later review of the same task retain the existing trace. When `maintenance` is required, a successful outcome additionally requires a `stage=close` route and successful maintenance completion newer than the latest non-close replan and persistence checkpoint. A later continuation invalidates the previous close evidence and requires a fresh close pass; non-success outcomes remain recordable.

The portable close preflight exposes `closureDue`, missing required skills/phases, fresh-close/maintenance state, and `nextRequiredAction`. Host adapters should translate that state into bounded notices such as `mssr-trace-closure-due` or `mssr-trace-stale-open`. A timeout may nominate an open trace for review but never proves task completion or authorizes `success`.

A host may also keep **ephemeral trace working memory** while the trace is open: a bounded resolved summary, hypotheses, decisions/evidence, and next gate. This state is for continuation/recovery, not durable observatory history. It is purged on outcome; only separately promoted durable evidence remains in telemetry, project documentation, skills, routing fixtures, or other owning artifacts.

## Observability epochs

Telemetry is not deleted to improve rates. A host may introduce a logical epoch when a measurement contract changes:

- `scope=active` evaluates only events stamped with the current epoch and begins at its persisted `baselineAt`;
- `scope=all` preserves previous events for historical comparison;
- every new event records `observabilityEpoch` and `contractVersion` as bounded metadata;
- epoch state is runtime data, not source-controlled configuration.

The first host implementation uses `trace-contract-v1`. Its clean baseline begins only after automatic continuity and its end-to-end regression are active.

## Context messages, inboxes, and receipts

MSSR Context Plane v1 treats a notice as one kind of bounded context message.
A host may attach a message to the next tool result or expose a drainable inbox;
this delivery choice is adapter I/O, not a semantic ownership transfer. Messages
are runtime-authored or repository-sourced evidence, not autonomous model
thoughts and never authorization to mutate.

Useful notice classes include:

- tool errors, warnings, schema drift, provider degradation, and stale runtime/source versions;
- active agents, owned files, locks, worktrees, or concurrent mutation risk;
- pending whiteboard/capture/dashboard review;
- changed files, recent commits, unresolved incidents, failed verification, or missing persistence;
- missing MSSR activation, required skills not loaded, absent replans, or unusual observatory metrics;
- project context that became stale or contradictory during the task.

Each notice should contain a bounded code, severity, source, timestamp, dedupe key, short message, optional evidence reference, and suggested next action. A notice may trigger a replan or context request, but never authorizes a destructive action.

Delivery may be pull-based or piggybacked on the next tool response. This is generally more reliable than assuming every MCP client will turn a server push notification into a new model inference.

A portable receipt for a delivered context message should also preserve the
source class, canonical owner, provenance/revision when available, observed
time, freshness state, trace association when compatible, and bounded purpose.
The observatory may retain receipt metadata and evidence references, but not
raw document bodies, prompts, transcripts, secrets, or private reasoning.
Unknown, stale, conflicting, or unavailable evidence remains visible as such.

Continuation uses a compact receipt of selected sources, unresolved evidence,
and the next gate. It must not make a new host session appear to have read a
document it cannot prove it loaded. A persistence suggestion is recorded as a
reviewable proposal for the repository or other canonical owner; observability
does not auto-write project knowledge, skills, routing fixtures, or changelogs.

## Progressive context providers

MSSR decides what procedural capability is needed. Providers answer bounded context requests.

```text
MSSR             -> what procedure/context class is needed
Bridge           -> host adapter and context facade
project docs     -> stable semantics and current state
Git/runtime      -> recent observable facts
OmnySystem later -> optional structural/indexed code evidence
Observatory      -> historical activation and outcome evidence
```

Project retrieval should progress from summary to relevant module, symbols, file, and exact lines. Generated structural facts may refresh automatically; semantic decisions, state transitions, and global skill changes require review.

## One outcome per task trace

Every substantial routed task closes with one latest effective `outcome` on its trace.

Required attribution:

- `primarySkill`: exactly one skill accountable for the delivered result;
- `supportingSkills`: applied collaborators that receive contribution counts but no duplicate success;
- `status`: `success`, `partial`, `failed`, or `skipped`;
- optional `accepted`: whether the artifact/result passed its domain contract;
- optional normalized `score` from 0 to 1;
- optional `metricName`, `evidenceKind`, and bounded `evidenceRef`.

Objective evidence is preferred: manifests, tests, runtime readback, explicit human review, or a documented mixed rubric. A loaded skill is not evidence that it helped.

Retries and later reviews reuse the same trace. Observatory uses the latest outcome per trace so a preliminary technical success can be replaced by a final visual rejection without inflating success rates.

Domain tools may record preliminary outcomes automatically when they own authoritative evidence. The primary skill remains responsible for final delivery when additional review changes acceptance.

## Metrics model

No single percentage describes MSSR quality. The dashboard separates:

### Activation and routing

- routed task coverage;
- structured-semantic route rate versus lexical fallback;
- project-context coverage;
- replan coverage after material evidence.

### Selection and compliance

- required skill loads expected and satisfied;
- required-load compliance;
- skill-load coverage and correlated route→load coverage as separate metrics;
- orphan skill loads and orphan-load rate;
- selected-versus-loaded distributions;
- optional candidate decision counts (`accepted`, `skipped`, `not-evaluated`) and bounded reason-code distributions;
- acceptance/skip rates by skill **and semantic task signature**, never as an unconditional global penalty.

### Execution discipline

- verification coverage;
- persistence coverage;
- user corrections and friction recurrence;
- duration and failures by phase/provider.

### Outcome quality

- outcome attribution coverage;
- success rate by primary skill;
- acceptance rate where acceptance was measured;
- average normalized score where a real rubric exists;
- supporting-skill contribution counts;
- recurrence after an apparently successful result.

A dashboard may display current numbers, but maintenance decisions require enough samples and examination of concrete traces. Frequency alone never rewrites routing or skills.

### Portable intent analysis

`mssr-telemetry-v1` route events may include an additive `route.intent` object
with only canonical `domains`, `actions`, `artifacts`, `needs`, `signals`,
`risk`, and `ambiguity`. The envelope deliberately excludes the intent summary,
raw task/context, capability prose, prompts, transcripts, and private reasoning.
Older route events without `route.intent` remain valid; analyzers must not infer
the missing dimensions from task hashes or prose.

`analyzeMssrTelemetry` deduplicates valid envelopes by `eventId`, groups them by
`traceId`, and uses the latest route and latest outcome per trace. Its rate
denominators are explicit:

- structured routing: routed traces;
- required-load compliance: required active-skill selections;
- route-to-load coverage: all active-skill selections;
- verification/persistence: routed traces whose latest route requires that phase;
- outcome attribution and success: traces with an outcome;
- acceptance: outcomes where `accepted` was explicitly measured.

A zero denominator produces `value=null`, not a fabricated zero. The analyzer
may emit review-only maintenance candidates after the same exact non-nominal
signal or missing required skill occurs on at least three distinct traces by
default. The threshold is configurable, trace references are bounded, and a
candidate never edits routing or skills automatically.

## Current host implementation and limits

MauroPrime Bridge provides:

- per-session automatic `traceId` propagation for direct calls and generic dispatch wrappers;
- `mssr_observatory_query` for active-epoch or all-history status, summary, benchmark, recent events, and trace inspection;
- `mssr_trace_record` for bounded checkpoints and attributed outcomes;
- SQLite plus JSONL storage without raw prompts/transcripts and a persisted runtime epoch state;
- dashboard cards for structured routing, route→load continuity, required-load compliance, outcome success, acceptance, and per-primary-skill results;
- Bridge notices for orphan loads, mismatches, omitted required skills, outcomes without routes, stale close/maintenance attempts, errors, and workflow/context anomalies;
- an end-to-end MCP regression proving route→loads→replan→verification→persistence→fresh close/maintenance→outcome continuity, including stale-close recovery after coordinator-memory loss.

This is a Bridge adapter implementation, not a claim that Bridge owns project
semantics or that every Context Plane v1 message/runtime gate is implemented on
every host. The native facade remains stateless; Codex-local and OpenCode-local
adapters have process-local continuity; ChatGPT Web and full cross-host
lifecycle/digest/replay/rollback parity remain explicit verification work.

The deterministic MSSR core remains host-neutral. Observability, notices, and context delivery belong to adapters because only a host can know whether the protocol was actually invoked and which tools/results occurred.

## Non-goals

- exposing private reasoning;
- loading every `SKILL.md` or every project file;
- granting tool permission through tags;
- counting every supporting skill as a separate success;
- treating generated files as accepted artifacts without verification;
- autoediting routing or skills from one event or from frequency alone.
