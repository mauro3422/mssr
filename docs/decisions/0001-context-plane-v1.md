# ADR 0001 — MSSR Context Plane v1

- Status: accepted as a documentation and contract direction
- Date: 2026-08-13
- Scope: portable context-message semantics; no runtime implementation is
  implied by this ADR alone

## Context

MSSR already separates reusable routing from project-local knowledge and has
trace, observability, notice, and modular context mechanisms. Without an
explicit boundary, an adapter can appear to own repository meaning, a notice can
be mistaken for a permission grant, or a continuation can present stale evidence
as current.

## Decision

Define **MSSR Context Plane v1** as the portable contract for selecting,
carrying, receiving, and accounting for bounded context messages.

### Ownership
<!-- mssr-arch-anchor: context-plane-ownership -->

| Concern | Canonical owner |
|---|---|
| Message categories, selection dimensions, continuity/receipt semantics, privacy and freshness requirements | MSSR portable contract |
| Architecture, vocabulary, local decisions, state, ADRs, incidents, changelogs, and accepted persistence | Owning repository/project |
| Filesystem/runtime reads, provider health, transport, authentication, inbox/piggyback delivery, local retention | Host adapters and providers |
| A Bridge-delivered message | Bridge owns delivery only; never the message's project semantics |

MSSR remains advisory. A message does not grant permission, mutate a target,
replace user instructions, or become an allowlist.

### Message contract

A v1 message or its receipt must be bounded and identify:

- message purpose and source class;
- canonical owner and a stable evidence reference;
- provenance/revision and observed time when available;
- freshness: `fresh`, `stale`, `unknown`, `conflicting`, or `unavailable`;
- compatible trace association when one is known;
- the next gate or review request, without private reasoning.

Permitted source classes include project documents, ADRs, changelogs, incidents,
Git history, live runtime/provider evidence, and task-trace evidence. A source
class expresses provenance, not equal authority: a changelog is not live runtime
proof and a trace is not project truth.

Messages are delivered either in a pull inbox or piggybacked on the next normal
tool result. No design may assume that an MCP server push automatically creates
a new host/model turn.

### Continuation and persistence

A continuation carries a compact receipt of selected sources, their
provenance/freshness, unresolved contradictions, compatible trace, and next
gate. It must be revalidated after restart, ownership handoff, source change,
or when freshness cannot be proven.

Any suggestion to update project context, an ADR, an incident, a skill, routing
metadata, or a changelog is a **persistence proposal**. It is addressed to the
canonical owner, requires review and normal persistence/verification gates, and
must never be auto-applied merely because it appears in a message or telemetry.

### Privacy

Messages, receipts, telemetry, and continuation state exclude raw prompts,
transcripts, secrets, arbitrary tool output, and private chain-of-thought.
They retain only bounded references and observable evidence necessary for the
next action. A missing, stale, or contradictory source is evidence and must not
be replaced by inference.

## Consequences

- Repositories retain authority over their facts while hosts remain replaceable.
- Bridge can provide useful inbox and piggyback behavior without becoming a
  semantic proxy.
- Hosts can expose only proven fields while preserving explicit uncertainty.
- Cross-host parity requires fixtures and runtime evidence, not matching prose.

As of MSSR 0.2.10, phase 2 adds the portable strict producers, the bounded
repository collector (ADR/incident/changelog/PROJECT_* facts plus supplied
Git/provider receipts), evidence freshness revalidation, and a durable
explicit-ack advisory-only JSON inbox. These are pure core modules with no host
adapter wired to drain them.

As of MSSR 0.2.11, repository facts become keyed (explicit selectors,
source-kind defaults, and an optional `.bridge/context-messages.json` manifest),
a modular `.bridge/project-context-modules.json` loader is added, and the
durable plane is wired into native, Codex, and OpenCode route/bootstrap through
the shared `loadProjectContextHost` helper plus an explicit `mssr_context_ack`.
The Bridge adapter delivery remains pending because its local dependency
junction crosses the OpenCode workspace authority boundary and must consume a
packaged 0.2.11 artifact.

## 0.2.18 canonical project-knowledge amendment

The earlier 0.2.11 `.bridge/...` and compact `project-context-modules.json` paths above are historical implementation records, not current authority. MSSR 0.2.18 adopts a canonical-only project contract:

- `.mssr/project-context.json` is the single active selective manifest;
- PROJECT_* remains a compact control plane while situational project knowledge may live under indexed `.mssr/knowledge/<topic>/` modules;
- `.mssr/runtime/` owns ephemeral inbox/receipt state and is not versioned project truth;
- `.bridge/` is never a Context Plane retrieval fallback. Known old MSSR artifacts there are reported as initialization/cleanup debt and handled only by explicit initialization tooling;
- repository initialization is a portable MSSR operation, not host-specific setup. Missing or invalid initialization is observable maintenance evidence;
- Project Context Health may detect growth, missing indexing, stale structure, or legacy artifacts, but remains advisory and never rewrites durable project knowledge;
- reviewed project statements can be normalized into a bounded knowledge-capture proposal (`topic`, `area`, `kind`, selectors, target path/module), while raw conversations, private reasoning, secrets, and transient tool output remain excluded.

This amendment preserves the original ADR ownership boundary: repositories own meaning, MSSR owns portable selection/health contracts, and hosts own authorized filesystem/runtime delivery.

## 0.2.49 cross-cutting applicability amendment

Semantic similarity is not sufficient for every project rule. A repository may have a narrow subsystem task while still mutating a payload governed by encoding/localization, packaging, trust-boundary, persistence, or runtime invariants. Requiring those modules unconditionally would bloat every read-only turn; leaving them purely semantic can omit a critical contract.

Portable Project Context therefore supports explicit conditional applicability on selective modules: `requiredWhen: { mutation: true, artifacts?: [...] }`. `required:true` keeps its existing unconditional-within-stage meaning. A `requiredWhen` match makes the module effectively required before semantic ranking and required-context budgeting; a read-only task does not activate it. Mutation is determined only from canonical structured intent (`risk` and the bounded mutating-action set), with optional artifact overlap as an additional gate. The repository must declare this relationship explicitly: MSSR does not infer criticality from prose, memory content, filenames, or semantic similarity, and the resulting context never grants write permission.

Conditional-required modules cannot belong to an `exclusiveGroup`. If required context exceeds the task budget, the loader reports required budget debt/overflow rather than silently dropping the contract or increasing limits. This preserves the original ownership boundary and selective-loading goal while adding a fail-visible path for cross-cutting invariants.

## Staged adoption gates

1. [x] Publish portable message and continuation-receipt fixtures with
   no-authority and privacy assertions (0.2.9 cross-host fixtures).
2. [x] Portable core: strict producers, repository collector, freshness
   revalidation, and a durable explicit-ack advisory-only JSON inbox (0.2.10).
   This proves the selectable/accounted message plane, not adapter delivery.
3. [x] Adapter delivery (native, Codex, OpenCode) — native/Codex/OpenCode
   route and bootstrap drain the durable inbox through one shared host helper,
   return the advisory context plane, and expose explicit `mssr_context_ack`
   (0.2.11), proven by the six-probe activation tests including an
   unrelated-domain negative.
   [ ] Adapter delivery (Bridge/ChatGPT Web) — pending; the Bridge adapter must
   consume a packaged 0.2.11 artifact because its dependency junction crosses
   the OpenCode workspace authority boundary.
4. [ ] Prove resume and persistence-proposal behavior on native, Codex,
   OpenCode, and Bridge/ChatGPT Web.
5. [ ] Only then use aggregate observability to review context quality; learning
   remains observe-only until its separate replay, calibration, shadow, feature
   flag, and rollback gates pass.

## Non-goals

- a global database of repository facts;
- automatic editing from notices, telemetry, or learning;
- treating a context receipt as authorization or a successful outcome;
- claiming current all-host runtime parity before its tests exist.
