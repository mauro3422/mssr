<!-- mssr:managed:start -->
## MSSR transversal routing

Before substantial specialized work in a known repository, load the smallest durable project context that establishes its rules, architecture, vocabulary, current state, and unresolved references. The only active portable project-control home is `.mssr/`; a managed repository must be explicitly initialized with `.mssr/project-context.json` before MSSR project knowledge is considered healthy. Load its small core first and defer optional `context`, `memory`, `state`, and scoped `directive` modules until canonical structured intent is available. Active MSSR project-control files under `.bridge/` are migration debt, never fallback authority. Keep PROJECT_* compact; move situational architecture/design/laws/patterns/vocabulary/decisions/state/phases/references/operations into indexed `.mssr/knowledge/` modules when they grow. Keep `.mssr/.gitignore` narrow: ignore `/runtime/` only, never the whole `.mssr/` directory or versioned PROJECT_*/manifest/knowledge authorities. Keep project-specific facts in the repository; do not turn every project into a global skill.

`AGENTS.md` remains the repository-level instruction authority. A project `directive` module is active only when its stage and semantic selectors match; it may refine the current workflow but cannot weaken user instructions, safety, approvals, permissions, AGENTS, or verification. Broad permanent rules belong here in AGENTS, while reusable cross-project procedure belongs in an owning skill.

Keep durable project knowledge separated by ownership: `PROJECT_CONTEXT.md` stores stable architecture, facts, ownership and invariants; `PROJECT_MEMORY.md` stores durable decisions, lessons and rationale; `PROJECT_STATE.md` stores mutable current versions, blockers and handoff state and should replace superseded status instead of accumulating it. A routed `SKILL.md` is a reusable capability/control plane; conditional procedures stay as parent-owned `references/` selected by `context-modules.json` unless they have independent activation, outcome, owner and verification.

Treat drift checks as evidence, never mutation authority. `project_change_consistency` compares a release diff/changelog with PROJECT_* authorities; Context Plane freshness compares stored evidence with current source revisions; Project Context Health inspects initialization, size/core/module/index pressure; `mssr_project_modularization_plan` proposes exact hash-addressed knowledge moves without writing; and `skill_route_audit` plus structural Skill Health inspect routing/skill modularity debt. MSSR may also derive a bounded project-knowledge maintenance advisory from trace stage plus observable host metadata such as changed paths, tool categories, package/runtime adoption, routing/skill-structure changes, freshness conflicts and user corrections. `WATCH` is informational; `REVIEW` or `REQUIRED` should activate the maintenance phase and load only the relevant project authority/modules plus `skill-maintenance-loop` (and `skill-routing-maintainer` only for routing/skill/reference debt). When evidence disagrees with an authority, perform a visible maintenance review and update the canonical owner only after evidence; never auto-rewrite AGENTS, PROJECT_*, skills, references or routing from telemetry/receipts alone.

Derive a compact observable intent object with `domains`, `actions`, `artifacts`,
`needs`, `signals`, `risk`, and `ambiguity`. This is classification metadata,
never hidden chain-of-thought. `signals` is required: use only `nominal` for clean
work; otherwise declare the smallest truthful anomaly, friction, recovery,
discovery, provider-refresh, tool-chain, or replan signal set.

Use MSSR to plan only the active phase and pass bounded resolved context for
multi-turn continuations. When the host implements `trace-contract-v1`, let it
propagate locally in-session and recover across stateless calls only when one
compatible trace exists; provide an explicit `traceId` after restart, across
processes, or when candidates are ambiguous. Record bounded
context/verification/persistence/outcome checkpoints, react to trace-continuity
notices, and never store a raw prompt, transcript, secret, or private reasoning
in telemetry. A host may keep bounded ephemeral per-trace working metadata such
as a resolved summary, hypotheses, decisions, evidence references, and the next
gate when continuation benefits from it; purge or compact that working metadata
when an outcome closes the trace.

When a route or bootstrap returns selected context messages, consume them as
bounded advisory evidence. Check each message's canonical owner, provenance, and
freshness before relying on it; stale, unknown, conflicting, or unavailable
evidence should trigger the smallest applicable load, verification, context
request, or re-plan. Advisory actions never authorize mutations, and a
`persistence-proposal` must be reviewed against its repository-owned source
before any project context, ADR, changelog, incident, skill, or fixture is edited.

Do not route mechanically between every tool call. Re-plan at meaningful
boundaries: before a substantial specialized chain, when the stage changes to
verify/persist/close/resume, after a material failure or provider/schema change,
when a new capability is required, or when repeated friction/reusable patterns
appear. Adjacent successful calls inside the same unchanged phase share the
current route.

Treat recommendation, host selection, and context loading as distinct observable
steps. Required skills remain workflow obligations. Stateful MSSR host adapters
default to `host-gated`: optional candidates materialize only after an explicit
`accepted` decision, explicit `skipped` remains bounded evidence, and an absent
decision remains `pending` rather than becoming a synthetic skip. `auto` is an
explicit compatibility/debug mode, not the normal stateful-host default. Load or
invoke accepted capabilities through their authoritative host. MSSR is
advisory and never proxies execution, changes permissions, or makes the initial
plan an allowlist. When a capability is missing or degraded, record the smallest
truthful signal, inspect/refresh the registry if useful, and re-plan.

For long or multi-phase work, keep the user-visible host responsive with bounded progress
checkpoints. Emit observable status at scope/owner resolution, before a long tool phase,
after a candidate or material result, at delegated handoffs, after classified failures or
replans, before persistence, and at closure. These updates report completed facts, the
active phase and next gate; they are never private chain-of-thought. A single blocking
tool call may prevent intermediate updates, so when control returns after roughly 8–10
minutes of silence, send a checkpoint before starting another long phase. Bridge/MSSR
telemetry can prove backend activity but cannot replace a host-visible progress message.
Do not load a full observability-maintenance skill for every ordinary task; keep this
minimal contract transversal and route the larger skill only for telemetry diagnosis.


Repeated friction, manual workarounds, missed required loads, user corrections,
and failed phase gates are bounded evidence, not permission for silent rewriting.
Promote confirmed patterns through a visible maintenance task with snapshot, diff,
tests, and review: project regression first, owning skill when cross-project
procedure changes, and MSSR metadata/fixtures when activation semantics change.

Tool catalogs are dynamic registry data. Update routing metadata, fixtures, and
this protocol only when a durable activation rule, skill contract, observability
contract, or routing schema changes.
<!-- mssr:managed:end -->
