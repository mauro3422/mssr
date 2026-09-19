# ADR 0007 — Automatic Lifecycle Coverage

Status: accepted for portable MSSR implementation; host adoption pending.

Date: 2026-09-18

## Context

Bridge-mediated tool calls already pass through infrastructure that can observe MSSR trace attribution, but that does not guarantee that every meaningful operation has an active routed lifecycle. Treating this mainly as a post-hoc "did the agent remember bootstrap?" compliance problem creates unnecessary ceremony and still permits substantial work to begin before lifecycle obligations exist.

The desired behavior is simpler: ordinary operations should stay cheap, while substantial or side-effectful work should automatically enter the MSSR control plane. The host already owns tool metadata, execution and I/O, so portable MSSR must not hard-code Bridge tool names or inspect arbitrary raw commands to guess intent.

## Decision

MSSR defines one host-neutral pre-operation activation policy. Hosts provide bounded semantic observations about the operation and current trace/route state; MSSR returns whether the operation is `lightweight`, `managed`, or requires `review`, plus the lifecycle control action the host should apply.

### Host observation boundary

The host supplies:

- operation `effect`: `control-plane`, `read`, `inspect`, `verify`, `execute`, `mutate`, `persist`, `publish`, `external-side-effect`, or `unknown`;
- operation `scale`: `trivial`, `substantial`, or `unknown`;
- current trace state after the R1 immutable-owner check: `none`, `compatible`, `ambiguous`, `mismatch`, or `unknown`;
- whether that compatible trace already has a route;
- whether work is project-scoped;
- whether the call is an explicit lifecycle phase boundary.

Hosts may derive these fields from their own registry/tool contract and bounded orchestration state. Raw prompts, arbitrary command text and a host-specific tool-name catalog do not belong in portable MSSR policy.

### Portable activation rules

1. `control-plane` calls are exempt from automatic lifecycle activation so `skill_bootstrap`, trace inspection and related MSSR control operations cannot recursively bootstrap themselves.
2. Known trivial operations remain lightweight. If a compatible trace already exists, the host may inherit attribution without loading another route.
3. `mutate`, `persist`, `publish`, and `external-side-effect` are managed even when scale is unknown.
4. Any operation explicitly classified `substantial`, including read-only analysis or verification, is managed.
5. An explicit phase boundary is managed and replans an existing compatible route.
6. Managed work with no trace requests `ensure-trace-and-route`; with a compatible trace but no route it requests `ensure-route`; with a compatible route it continues or replans that route.
7. Ambiguous, mismatched or unknown trace ownership never migrates a trace. The decision abstains into `review`/`inspect-traces`; R1 remains the authoritative owner-integrity contract.
8. Unknown operation semantics do not silently become substantial. The policy abstains to `review` unless another deterministic signal already requires management.
9. Project Context is requested only for managed work explicitly observed as project-scoped.

The evaluator is advisory and I/O-free. It can recommend lifecycle control, but it never authorizes project/file/tool mutation.

## Relationship to existing contracts

- **R1 Trace Identity Integrity** remains prior: owner compatibility is evaluated before lifecycle adoption.
- **C2b routing compliance** remains the after-the-fact recovery/observability layer. A `substantial-tool-without-route` finding is now evidence that the host failed to apply R2, not the primary activation mechanism.
- **Skill routing** remains the owner of semantic skill selection and required lifecycle phases after a route exists. R2 decides whether to enter/replan that control plane; it does not duplicate `inferredRequiredPhases(...)`.
- **R3 Context Economy v2** will later reduce the context cost of managed lifecycle by activating only unmet obligations. R2 must not raise context budgets to hide ceremony.
- **Bridge and other hosts** retain execution, registry metadata, trace persistence, transport and I/O ownership.

## Consequences

Positive:

- correct MSSR lifecycle use becomes a host property rather than an agent-memory convention;
- trivial reads/inspection can stay cheap;
- substantial read-only work is still eligible for managed lifecycle when the host can classify it as substantial;
- side-effectful operations fail toward management without requiring semantic parsing of raw arguments;
- C2b becomes a measurable fallback signal for missed automatic activation;
- portable MSSR stays host-neutral and deterministic.

Trade-offs:

- hosts must maintain trustworthy operation-effect/scale metadata or bounded classifiers;
- `unknown` intentionally abstains rather than guessing, so host coverage quality remains observable;
- the first portable contract does not itself create a trace or call routing. Host adoption is a separate, testable gate.

## Verification expectations

Portable tests must cover trivial reads, inherited attribution, substantial read-only work, side-effectful work with unknown scale, route creation/reuse/replan, control-plane recursion avoidance, ambiguous/mismatched ownership, inconsistent host evidence, unknown semantics and non-project managed work.

Host adoption must additionally prove that registered trivial tools do not bootstrap lifecycle, registered substantial/side-effectful tools do, active compatible traces are reused, owner mismatch cannot migrate a trace, and C2b no longer reports `substantial-tool-without-route` for correctly classified host paths.
