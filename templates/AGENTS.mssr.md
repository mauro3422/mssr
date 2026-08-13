<!-- mssr:managed:start -->
## MSSR transversal routing

Before substantial specialized work in a known repository, load the smallest durable project context that establishes its rules, architecture, vocabulary, current state, and unresolved references. When `.bridge/project-context.json` exists, load its small core first and defer optional `context`, `memory`, `state`, and scoped `directive` modules until canonical structured intent is available. Keep project-specific facts in the repository; do not turn every project into a global skill.

`AGENTS.md` remains the repository-level instruction authority. A project `directive` module is active only when its stage and semantic selectors match; it may refine the current workflow but cannot weaken user instructions, safety, approvals, permissions, AGENTS, or verification. Broad permanent rules belong here in AGENTS, while reusable cross-project procedure belongs in an owning skill.

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

Do not route mechanically between every tool call. Re-plan at meaningful
boundaries: before a substantial specialized chain, when the stage changes to
verify/persist/close/resume, after a material failure or provider/schema change,
when a new capability is required, or when repeated friction/reusable patterns
appear. Adjacent successful calls inside the same unchanged phase share the
current route.

Treat recommendation, host selection, and context loading as distinct observable
steps. Required skills remain workflow obligations. In host-gated bootstrap mode,
record a bounded `accepted` or `skipped` decision for optional candidates before
materializing their procedural context; a skipped optional is not a load failure.
Load or invoke accepted capabilities through their authoritative host. MSSR is
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
