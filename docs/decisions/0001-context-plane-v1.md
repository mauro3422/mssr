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

## Staged adoption gates

1. Publish portable message and continuation-receipt fixtures with no-authority
   and privacy assertions.
2. Add adapter inbox/piggyback delivery and prove receipt freshness/provenance.
3. Prove resume and persistence-proposal behavior on native, Codex, OpenCode,
   and Bridge/ChatGPT Web.
4. Only then use aggregate observability to review context quality; learning
   remains observe-only until its separate replay, calibration, shadow, feature
   flag, and rollback gates pass.

## Non-goals

- a global database of repository facts;
- automatic editing from notices, telemetry, or learning;
- treating a context receipt as authorization or a successful outcome;
- claiming current all-host runtime parity before its tests exist.
