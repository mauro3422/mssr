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
  -> MSSR deterministic route
  -> selected skill metadata/content
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

## Observability epochs

Telemetry is not deleted to improve rates. A host may introduce a logical epoch when a measurement contract changes:

- `scope=active` evaluates only events stamped with the current epoch and begins at its persisted `baselineAt`;
- `scope=all` preserves previous events for historical comparison;
- every new event records `observabilityEpoch` and `contractVersion` as bounded metadata;
- epoch state is runtime data, not source-controlled configuration.

The first host implementation uses `trace-contract-v1`. Its clean baseline begins only after automatic continuity and its end-to-end regression are active.

## Context notice inbox

A host may attach bounded notices to the next tool result or expose a drainable inbox. Notices are runtime-authored evidence, not autonomous model thoughts.

Useful notice classes include:

- tool errors, warnings, schema drift, provider degradation, and stale runtime/source versions;
- active agents, owned files, locks, worktrees, or concurrent mutation risk;
- pending whiteboard/capture/dashboard review;
- changed files, recent commits, unresolved incidents, failed verification, or missing persistence;
- missing MSSR activation, required skills not loaded, absent replans, or unusual observatory metrics;
- project context that became stale or contradictory during the task.

Each notice should contain a bounded code, severity, source, timestamp, dedupe key, short message, optional evidence reference, and suggested next action. A notice may trigger a replan or context request, but never authorizes a destructive action.

Delivery may be pull-based or piggybacked on the next tool response. This is generally more reliable than assuming every MCP client will turn a server push notification into a new model inference.

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
- selected-versus-loaded distributions.

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

## Current host implementation

MauroPrime Bridge provides:

- per-session automatic `traceId` propagation for direct calls and generic dispatch wrappers;
- `mssr_observatory_query` for active-epoch or all-history status, summary, benchmark, recent events, and trace inspection;
- `mssr_trace_record` for bounded checkpoints and attributed outcomes;
- SQLite plus JSONL storage without raw prompts/transcripts and a persisted runtime epoch state;
- dashboard cards for structured routing, route→load continuity, required-load compliance, outcome success, acceptance, and per-primary-skill results;
- Bridge notices for orphan loads, mismatches, omitted required skills, outcomes without routes, stale close/maintenance attempts, errors, and workflow/context anomalies;
- an end-to-end MCP regression proving route→loads→replan→verification→persistence→fresh close/maintenance→outcome continuity, including stale-close recovery after coordinator-memory loss.

The deterministic MSSR core remains host-neutral. Observability, notices, and context delivery belong to adapters because only a host can know whether the protocol was actually invoked and which tools/results occurred.

## Non-goals

- exposing private reasoning;
- loading every `SKILL.md` or every project file;
- granting tool permission through tags;
- counting every supporting skill as a separate success;
- treating generated files as accepted artifacts without verification;
- autoediting routing or skills from one event or from frequency alone.
