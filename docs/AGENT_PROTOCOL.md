# Agent protocol

The MSSR protocol is a compact, observable classification—not hidden reasoning.
It makes routing reusable across skills and tools without forcing every request
through a proxy.

## Intent envelope

Before substantial specialized work, the host must form a compact intent using
the canonical vocabulary, for example:

```json
{
  "domains": ["roblox", "skill-system"],
  "actions": ["analyze", "edit", "verify"],
  "artifacts": ["mcp", "document"],
  "needs": ["integrity-verification", "cross-agent"],
  "signals": ["degraded-capability", "replan-needed"],
  "risk": "write",
  "ambiguity": "low",
  "capabilityNeeds": ["inspect the live provider catalog"]
}
```

Use a bounded resolved context (normally 500–2000 characters) only for a
continuation or multi-turn plan. It contains the accepted goal, constraints,
current phase, completed work, and unresolved references—not the transcript or
chain-of-thought.

## Project context and context budget

MSSR keeps procedural guidance and project knowledge in separate layers:

- reusable cross-project procedure belongs in a skill;
- repository-wide permanent instructions belong in `AGENTS.md`;
- project-specific architecture, vocabulary, paths, durable decisions, current state, and blockers belong in the repository's durable project documents;
- project-specific conditional instructions may be indexed as `directive` modules, but only when their stage and structured-intent selectors match;
- the host loads the smallest project core first, then selects project modules and the smallest phase-scoped skill set from canonical intent.

With `.bridge/project-context.json`, project selection becomes modular instead of loading `PROJECT_CONTEXT.md`, `PROJECT_MEMORY.md`, and `PROJECT_STATE.md` wholesale. The manifest may point to stable Markdown sections and classify them as `context`, `memory`, `state`, or `directive`. The same deterministic selector primitive used by skill context scores project modules, but project knowledge is not converted into a skill and directives are not authorization.

A new project does not require a new skill by default. Create or generalize a skill only when the lesson has an independent reusable objective across projects. Keep broad permanent project instructions in AGENTS; keep conditional local instructions narrow and selector-driven; keep mutable state curated rather than append-only. This separation is the main context-pressure control.

Distinguish a healthy reusable capability from a maintenance signal. For example, `needs=["component-reuse"]` requests the normal procedure for finding and reusing an existing validated 3D component, while `signals=["reusable-pattern"]` means the current work itself exposed a reusable lesson that should be considered for transversal maintenance. Do not mark nominal component reuse as system friction merely to route a skill.


### Selective procedural context

When the host applies a route through `skill_bootstrap`, the default context mode is selective. A skill may declare a `context-modules.json` manifest containing one compact core and optional modules filtered by stage and structured intent. MSSR scores and filters modules deterministically; true alternatives may share an `exclusiveGroup`, where a unique winner loads and a top-score tie returns candidates without loading either. Context planning reserves every required skill core first, then required modules, globally ranks optional modules, and avoids reinjecting text already covered by loaded context. In `host-gated` mode, optional **root** candidates remain metadata until the host records an `accepted` decision; `skipped` roots remain observable selection evidence and are not materialized as procedural context. Dependencies do not become independent host decisions: workflow-required roots seed their transitive dependency closure immediately, while an optional root's dependencies enter the load closure only after that root is accepted. A dependency that exists solely because of a skipped optional root is not a pre-acceptance obligation. Compatibility `auto` mode may still admit the complete routed dependency closure directly.

`skill_load` remains the explicit full-file operation. `contentMode=full` is available for diagnosis and rollback, while a missing or invalid manifest falls back to the complete `SKILL.md` with observable telemetry. Optional skill context that cannot fit is skipped whole; required context may overflow only with explicit evidence. The host reports planner mode, allocation tier, savings, skip/overflow and duplicate avoidance without storing procedural text. Module selection does not create a second routing graph, change permissions, or prove that the host still retains text after compaction.
The host is responsible for the activation hook. Before substantial specialized work it should load AGENTS and the minimal project core, produce canonical structured intent, select any matching project modules, and call `skill_route_plan` or `skill_bootstrap`. When applying the route, the host should carry the same resolved project root so `skill_bootstrap` can re-select phase-scoped project modules together with procedural skill context.

At `verify`, `persist`, `close`, `resume`, a material failure, or a newly discovered capability need, re-plan the active trace and re-select both project modules and skill modules. Already loaded core context need not be duplicated when the host can prove it is still present. A `trace-contract-v1` adapter may keep local session continuity and recover a trace across stateless calls only when one compatible candidate exists. Ambiguity, restart, cross-process resume, and deliberate selection require an explicit ID. MSSR cannot activate itself in a host that never calls it.
When the host can prove them, it should also attach its observable model
identifier and reasoning effort to every route checkpoint (for example
`gpt-5.6-terra` with `high`). If either value is not exposed by the product,
record `unknown`; never infer model or effort from latency, output length,
quality, or behavior. These fields are measurement dimensions, not routing
inputs, and changing them does not grant capabilities or permissions.

## Routing evidence checkpoint and notices

The host's first observable action after deliberating about substantial specialized work is a compact Routing Evidence Checkpoint. It contains operational conclusions suitable for MSSR—not private reasoning. This boundary is sometimes described as the second tick: the model interprets the request, emits structured routing metadata, receives the route, and then reasons again with the selected capabilities.

Runtime or project evidence may arrive later through bounded notices attached to tool results or a drainable inbox. Errors, active agents, owned files, pending captures/reviews, stale project context, missing routing, required skills not loaded, and unusual metrics can trigger a context request or replan. Notices never authorize mutations.

See `ROUTING_EVIDENCE_OBSERVATORY.md` for the full contract.

## User-visible progress contract

MSSR telemetry and a visible ChatGPT/Codex progress update solve different problems. Telemetry correlates backend routing and tool activity; the host remains responsible for telling the user that a long task is active and what observable phase comes next.

For long or multi-phase work, the host should emit bounded progress checkpoints at:

1. scope and active-owner resolution;
2. before a long or opaque tool phase;
3. after a candidate or material result exists;
4. at a delegated handoff such as modeler → photographer;
5. after capture, verification or a classified failure;
6. after a material replan;
7. before persistence/publication;
8. closure.

A checkpoint contains only completed observable facts, the active phase, the current owner and the next gate. It must never expose private chain-of-thought. One blocking tool call may prevent intermediate messages; when control returns after roughly 8–10 minutes without a user-visible update, the host should checkpoint before launching another long phase.

### Ephemeral trace working memory

A host may preserve bounded working metadata only while a trace remains open when it materially improves continuation or recovery. The portable shape is deliberately small: a resolved `workingSummary`, bounded hypotheses with evidence references, bounded decisions with short reasons, and the `nextGate`. It may summarize reasoning outcomes, but it is not a transcript or chain-of-thought store.

This working memory has `retention=until-outcome`. On a final outcome the host should purge it, or explicitly compact a durable consequence into the normal evidence/project/skill documentation owned by that consequence. Raw prompts, transcripts, secrets, private chain-of-thought, and unbounded scratchpads remain excluded even from ephemeral trace state.

This is a minimal transversal host rule, not a reason to inject the entire `mssr-observability-maintenance` skill into every task. Route that larger skill only when the work is actually diagnosing telemetry, traces, dashboards, identities or observability failures. A Bridge heartbeat or recent MSSR call proves backend activity only; it does not prove that the user received a progress message or final response.


## Stages and phases

The host passes one execution `stage`: `start`, `implement`, `verify`, `persist`,
`close`, or `resume`. MSSR maps it into workflow phases such as `discovery`,
`safety`, `implementation`, `verification`, `persistence`, and `maintenance`.
Load only the active returned phase. Re-plan when the stage advances, after a
material result or failure, or when a new capability becomes necessary. A prior
plan never locks the agent out of another authorized tool.

### Fresh-close invariant

When the route declares `maintenance` as a required phase, a successful final
`outcome` is valid only for the latest lifecycle generation. The host must:

1. complete verification and the latest persistence checkpoint;
2. re-plan the same trace at `stage=close`;
3. complete the required close/maintenance phase on that current state;
4. only then record `status=success` outcome.

Any later `start`, `implement`, `verify`, `persist`, or `resume` replan on the
same trace, and any later persistence checkpoint, makes the previous close and
maintenance evidence stale. The trace must pass through `stage=close` and
maintenance again before another successful outcome. Read-only observability or
context inspection does not by itself invalidate a close.

A host adapter may enforce this invariant from observable route/checkpoint
history. This is lifecycle-integrity validation, not a permission boundary:
`partial`, `failed`, or `skipped` outcomes remain recordable so unfinished or
blocked work can close truthfully.

### Explicit close preflight

The portable lifecycle exposes a close preflight rather than relying on an agent remembering the entire ending sequence. Once the host has evidence that the task is entering `stage=close`, `getMssrTraceClosureState` reports `closureDue`, `canCloseSuccess`, missing required skills, missing verification/persistence gates, whether a fresh close replan is required, whether maintenance is still required for the current lifecycle revision, and one `nextRequiredAction`.

The host still owns the question "is the task ending?"; MSSR must not infer successful completion merely from silence or elapsed time. Idle/stale detection may produce a notice or closure candidate, never an automatic success outcome. A host notice should surface the preflight metadata and exact next gate so ChatGPT, Codex, or another caller can resume the same trace instead of leaving it open indefinitely.

## Skill-load lifetime

`skill_load` returns the selected `SKILL.md` as a normal host tool result. MSSR
records that the load happened, but it does not maintain a hidden server-side
instruction injection or resend the skill on every later tool call.

- Within the same uncompacted conversation phase, keep using the loaded guidance
  without loading it again between adjacent calls.
- A re-plan does not unload already seen text; it only changes which capabilities
  are active or deferred for the next phase.
- Reload when work moves to a new agent/thread, the host compacted away the
  instructions, a restart/resume cannot prove the skill remains in context, or
  the skill changed materially since it was loaded.
- Telemetry proving `skill_loaded` does not prove that a host still retains the
  full text after its own context compaction.

## Signals and capability chaining

Signals are observable process state. Common values are:

- `error-observed`, `warning-observed`, `uncertainty`, `conflicting-evidence`
- `degraded-capability`, `missing-capability`, `recovery-needed`
- `repeated-friction`, `manual-workaround`, `skill-gap`, `reusable-pattern`
- `capability-discovery-needed`, `additional-capability-needed`
- `tool-chain-needed`, `provider-refresh-needed`, `replan-needed`

When a selected skill/tool reveals another need, record the signal and a short
`capabilityNeeds` description, refresh or inspect the registry if necessary,
then re-plan. The host retains normal authority to use any available authorized
tool; MSSR is not an allowlist.

Non-nominal evidence signals combined with `debug`, `analyze`, `review`, `test`,
`verify`, or `recover` should compose `systematic-debugging` with the narrowest
relevant domain skill. Capability, provider, skill, routing, permission,
verification, or context gaps should additionally compose
`capability-gap-recovery`. Both routes are gated by matching signals so ordinary
nominal implementation and review remain outside the debugging/recovery branch.

## Friction and learning loop

Friction is observable control metadata, not permission to rewrite the system.
A host should checkpoint bounded facts when a tool fails, a workaround repeats,
a required skill was not loaded, a route changes materially, or verification and
persistence disagree. The checkpoint should identify the route/phase, signals,
selected and loaded skills, result, and a short redacted summary—never the raw
prompt or transcript.

Promotion follows an evidence ladder:

1. one isolated event remains telemetry or project-local documentation;
2. a reproduced project defect becomes a focused regression and project fix;
3. a repeated cross-project procedural gap updates the owning skill;
4. an activation, dependency, phase, or signal defect updates MSSR metadata and
   positive, negative, and continuation fixtures;
5. only an independently reusable objective justifies a new skill.

Frequency alone must not change routing. Historical evidence proposes maintenance;
a visible task with snapshot, diff, tests, and review applies the change.

## Outcome attribution

Close each substantial routed trace with one latest effective outcome. Exactly one `primarySkill` owns the result; `supportingSkills` record collaboration without duplicating success. Prefer manifests, tests, runtime readback, or explicit review over self-scoring. Reuse the trace for retries and final review so the latest outcome replaces preliminary evidence in metrics.

Track activation, required-load compliance, verification, persistence, outcome success, and artifact acceptance separately. No single percentage represents all of MSSR quality.

## When skills change

Creating or materially changing a skill should trigger a routing audit:

1. Declare its domains, actions, artifacts, needs, and phase role.
2. Add durable routing metadata/fixtures when its activation semantics are new.
3. Update registry-visible metadata if its name, source, or availability changes.
4. Run the router tests and document user-visible contract changes.

Do not edit this protocol merely because a new tool appears. Auto-registry
discovers volatile capability names and schemas. Update this document only when
the routing contract itself changes.
