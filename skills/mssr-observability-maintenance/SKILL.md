---
name: mssr-observability-maintenance
description: Audit and maintain MauroPrime Bridge and MSSR observability when callers, models, effort, sessions, projects, routed skills, required loads, verification, persistence, outcomes, active epochs, or dashboard labels are missing, misleading, duplicated, or inconsistent. Use for silent or looping ChatGPT Web tool runs, orphan or ambiguous traces, premature or duplicate outcomes, unknown attribution, route-to-load gaps, privacy-safe telemetry changes, and MSSR dashboard regressions.
---

# MSSR Observability Maintenance

## Purpose

Diagnose what Bridge and MSSR can actually observe, repair the smallest owning layer, and leave a reproducible trace contract. Measure observable lifecycle and timing; never claim access to hidden chain-of-thought.

## Establish the observation boundary

Classify every signal before interpreting the dashboard:

- Bridge records only calls that traverse Bridge plus explicit MSSR checkpoints.
- Host-native tools, final UI rendering, private reasoning, and unexposed host metadata remain outside that boundary.
- Treat absent model, reasoning effort, project, or session as `unknown` or `not exposed`; do not infer it from prose.
- Keep caller, session, project, workflow, task, trace, runtime generation, and active observability epoch separate.
- When auditing telemetry produced by a domain task, treat that domain as evidence rather than an active work domain unless the current task will inspect or mutate its authoritative runtime. An MSSR audit mentioning Roblox assets must not route Studio skills when it only changes Bridge, metrics, routing, or dashboard code.

## Preserve the execution identity hierarchy

Use each identifier only for the boundary it can prove:

- `sessionKey`: hashed host-provided scope such as `openai/session`; it correlates MCP calls but is not guaranteed to equal the visible ChatGPT chat, message, tab, automation run, or account.
- `workflowKey`: stable local identifier chosen for a recurring or related family of executions, for example `mauroprime-system-loop`. It may span many Web sessions, task texts and traces.
- `taskKey`: local hash of the bounded task description. It groups equivalent task text but may change when the accepted goal or summary changes.
- `traceId`: one logical routed execution and its phase lifecycle. Continue the same trace for clarification, implementation, verification, persistence and close of the same accepted task; open a new trace for a materially independent task.
- `runtimeBootId`: UUID generated once per Bridge process start. Use it to distinguish restart generations even when a PID is reused.
- `pid`, child PID and terminal session id: runtime diagnostics for process ownership. Never use them as the primary identity of a Web task.
- commit hashes, remote refs, snapshot ids, file hashes and restart acknowledgements: persistence evidence. Associate them through bounded `evidenceRef` values rather than storing raw command output.

When `mssr_trace_evidence` is available, use it as the primary read-only reconstruction for one trace before manually joining metrics, events and Git evidence. It must report missing evidence honestly and must not infer host identifiers that were never exposed.

A long chat may legitimately contain multiple workflows, tasks and open traces under the same `sessionKey`. Do not merge them by recency alone. Use explicit `traceId` after restart or whenever more than one compatible trace exists.

An idle timer proves only that Bridge has not observed another substantive MCP call. It does not prove that ChatGPT rendered a final response, that the user accepted the result, or that the task succeeded. Emit a reminder and keep the trace open until an explicit outcome or explicit failed/abandoned close is recorded.
### Heartbeat y resultados multidimensionales

Un checkpoint `progress` renueva un lease acotado de una traza Web activa; no completa discovery, implementation, verification, persistence ni close. Úsalo durante builds, verificaciones, publicaciones o esperas largas cuando la tarea sigue viva. No lo emitas mecánicamente entre cada tool ni para ocultar un bloqueo. El reminder de cierre sólo debe aparecer cuando vencieron tanto el idle base como el lease reciente.

Un outcome conserva una sola `primarySkill` y un estado global. Cuando subsistemas distintos terminan de manera diferente, agrega dimensiones acotadas, por ejemplo:

```text
repositoryPublication: success
bridgeRuntime: success
hostCatalogRefresh: degraded
```

La dimensión explica el límite pero no multiplica outcomes ni reemplaza el status principal. Una limitación externa del catálogo del host no convierte en fallo una publicación o implementación ya verificada; usa `success` con dimensión degradada o `partial` sólo cuando esa limitación impide parte del objetivo aceptado. Cada dimensión debe guardar sólo nombre, status, resumen y evidenceRef breves, nunca argumentos crudos o transcript.



## Reproduce one controlled trace

1. Start from one explicit caller, task, primary project, and active epoch.
2. Record timestamps for context load, route, each required load, verification, persistence, outcome, and user-visible completion when externally observable.
3. Preserve the trace ID through meaningful phase replans.
4. Query both the trace and recent Bridge metrics.
5. Compare the trace events with what the dashboard renders.

For ChatGPT Web, also measure:

- delay to first routed action;
- discovery detours before the intended tool;
- tool execution span;
- idle gap after the last tool;
- missing-required-load corrections;
- premature or duplicate outcome attempts;
- user stop, retry, or nudge when observable.

## Classify the defect

Route the correction to the smallest authoritative owner:

- host metadata absent or malformed -> Bridge host adapter;
- tool catalog or wrapper discovery detour -> Bridge tool descriptions, catalog, or context-load next action;
- route/load/close state wrong -> Bridge trace coordinator or MSSR core;
- activation semantics wrong -> MSSR routing metadata and fixtures;
- project/session attribution wrong -> session-scoped context propagation;
- dashboard wording or grouping wrong -> dashboard projection only;
- reusable operator procedure missing -> this skill or its owning cross-project skill.

Do not patch UI labels to hide a lifecycle or attribution defect.

## Audit delegated tool attribution

When one Bridge tool dispatches another runtime capability, keep transport evidence and logical capability evidence distinct without losing either one:

1. Inspect the bounded metric fields for the outer `tool` and the allow-listed delegated target such as `operation_subject`.
2. Preserve the wrapper call as evidence of fallback, proxy, aggregator, or transport usage.
3. Attribute logical usage to the delegated target when it resolves to a registered runtime tool.
4. Do not interpret one physical delegated call appearing in wrapper and target projections as two physical executions. Dashboards and reports must state which projection is being counted.
5. Treat these states as integrity defects:
   - a successful delegated wrapper row lacks the target field required by its contract;
   - a registered target has successful delegated rows but still appears as `no-evidence`;
   - the stored target resolves to no registered tool and is not an expected provider-local name;
   - wrapper totals and target projections cannot be reconciled from the same underlying rows;
   - `scope=active` and `scope=all` disagree without an epoch boundary explaining the difference.
6. Compare at least one dedicated invocation, one successful delegated invocation, one delegated target failure, and one rejected or invalid target. Expected safety guards must remain distinguishable from implementation failures.
7. Repair the smallest owner:
   - missing target at write time -> wrapper or metric capture;
   - target stored but ignored -> metric query or audit projection;
   - stale target resolution -> runtime registry/provider refresh;
   - correct aggregates but misleading display -> dashboard projection and labels.
8. Add a regression that proves wrapper evidence, delegated-target evidence, physical-call cardinality, error attribution, and the privacy invariant that raw arguments are not stored.

Do not create another general skill for delegated attribution while this skill remains the observability owner. Add a narrower script or audit view only when prose cannot enforce the invariant reliably.

## Enforce lifecycle invariants

A successful routed task must satisfy:

1. one compatible trace;
2. all required skills loaded on that trace;
3. verification and persistence checkpoints when the route or risk requires them;
4. one final outcome after the phase gates;
5. no later task activity on a closed trace without an explicit resume or replan.

Reject a successful outcome while required loads are missing. Keep the trace open and return a bounded recovery action.
## Test stateless trace recovery

When a trace is lost, orphaned, or replaced after dispatch, phase replan, connector refresh, or Bridge restart, reproduce the exact boundary rather than only testing same-session calls:

1. Route through the real wrapper or dispatch path and confirm the emitted nested `traceId` is attributed to the outer metric/session.
2. Replan into the affected phase, including `stage=close` when that is where the defect appears.
3. Deliberately clear or bypass the in-memory coordinator.
4. Invoke a dedicated `skill_load` and then a trace-aware checkpoint without copying the ID manually.
5. Require both calls to recover the same unique open persisted trace and emit no orphan/mismatch notice.
6. Add a nearby ambiguous-candidate case and require explicit `traceId` rather than guessing.
7. Verify preparation-only calls such as routing, context load, catalog/audit, observatory queries, and `skill_load` do not start the Web closure timer; substantive traced work or a non-final checkpoint still must.

A successful same-process route/load test is insufficient for a stateless continuity bug. Preserve anonymous session hashes and bounded project/caller/skill matching; never weaken ambiguity protection merely to reduce orphan warnings.



## Change telemetry safely

- Store bounded classifications, identifiers, durations, counters, allow-listed operation subjects, and privacy-safe project-maintenance hints such as path categories, material-write counts, runtime/package/routing flags and freshness counters.
- Project-maintenance metadata may feed `evaluateMssrProjectKnowledgeMaintenance` and notices, but it is diagnostic evidence only; never infer a durable project fact from a counter or auto-write `AGENTS.md`, `.mssr/PROJECT_*`, skills or references.
- Never store raw prompts, transcripts, secrets, cookies, access tokens, or private reasoning.
- Hash anonymous host session identifiers.
- Prefer explicit project roles such as primary and related over path guessing.

### Preserve history and start clean baselines safely

- Never delete, replace, truncate, or recreate the metrics SQLite/JSONL merely to improve rates, hide development errors, or make a corrected projection look clean.
- Treat persisted rows as recoverable historical evidence when the raw fields are intact, even when an older dashboard or query interpreted them incorrectly.
- For a deliberate contract, release, benchmark, or measurement boundary, start a new shared active observability epoch with a bounded reason. Use `scope=active` for the new baseline and `scope=all` for preserved history.
- Before starting an epoch, record the current epoch id, baseline timestamp, relevant version or commit, and bounded active/all counts. Afterward, verify the active epoch changed and `scope=all` still exposes pre-epoch evidence.
- Do not start an epoch only because current metrics are unfavorable. Tie it to an observable boundary such as a corrected trace contract, attribution model, schema, or production release.
- Consider a physical database reset only after proving unrecoverable storage corruption, creating a verified backup, documenting what cannot be reconstructed, and obtaining explicit destructive authorization. Projection defects and mislabeled aggregates are not database corruption.

## Verify and close

Add a regression that reproduces the original sequence and its recovery. Run routing, Bridge, dashboard, and restart verification in proportion to the change. Confirm the live process serves the new version.

When an incident or repeated friction occurred, load `skill-maintenance-loop` for close and record symptom, reproduction, cause, correction, regression, and follow-up in the canonical owner ledger.
