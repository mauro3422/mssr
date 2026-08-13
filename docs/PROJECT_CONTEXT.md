# Modular project context

MSSR treats project knowledge as a separate retrieval layer from reusable skills. A repository may publish a modular project-context manifest so project context is selected with the same structured semantic dimensions used by routing instead of loading every project document in full for every task. The 0.2.11 loader implements `.bridge/project-context-modules.json` (schema v1); earlier docs described the equivalent `.bridge/project-context.json` shape.

## Authorities and roles

1. `AGENTS.md` or `AGENTS.override.md`: repository-level instructions intended to apply broadly.
2. `PROJECT_CONTEXT.md`: durable facts such as architecture, vocabulary, ownership, canonical paths, and invariants.
3. `PROJECT_MEMORY.md`: durable decisions and lessons that remain useful across sessions but are not automatically instructions.
4. `PROJECT_STATE.md`: mutable current state such as active work, blockers, handoffs, and current versions.
5. Manifest modules with `kind: "directive"`: small project-specific instructions that apply only when their structured selectors match the current MSSR intent and stage.

A directive is a scoped refinement, not a new authority tier. It cannot weaken the current user request, host safety policy, `AGENTS.md`, approvals, permissions, or verification requirements. If an instruction should apply to almost every task in the repository, it belongs in `AGENTS.md`.

## Bootstrap lifecycle

```text
known repository
  -> load AGENTS
  -> load project-context core
  -> classify canonical MSSR intent
  -> select project context/memory/state/directive modules
  -> route and load active skill modules
  -> execute authorized tools
  -> re-select project + skill modules at verify/persist/close or a material replan
```

The core provides only the durable information needed to understand and begin work safely. Before canonical intent exists, optional modules remain deferred. Once intent exists, MSSR evaluates `stage`, `domains`, `actions`, `artifacts`, `needs`, and `signals` deterministically under a bounded context budget.

If the modular project-context manifest is absent, a host adapter may preserve the legacy behavior of loading the three project Markdown documents in full. Projects can therefore migrate incrementally. When no manifest exists the 0.2.11 loader keeps an observable full-document fallback (`allowFullDocumentFallback`); without that flag, no modules are materialized rather than guessing.

## Context messages and continuation receipts

Project context participates in **MSSR Context Plane v1** as evidence selected
from a repository, not as data owned by a host adapter. A portable context
message must identify, at minimum, its source class, canonical owner, bounded
reference, provenance, observed time or revision when available, freshness
state, and purpose. The message contains the smallest useful excerpt or
reference; it never contains a raw transcript, secret, or private reasoning.

Typical source classes are project authorities, ADRs, versioned changelogs,
incidents, Git history, live runtime/provider readback, and the active task
trace. Their authority differs:

- project documents and ADRs own local facts and decisions;
- changelogs own published change history, not current runtime truth;
- Git and runtime reads provide time-bound observable evidence;
- trace data records workflow continuity, not project semantics;
- an adapter or provider owns only how the evidence is read and delivered.

When a task continues, the host should carry a **continuation receipt** rather
than reload an unbounded conversation. The receipt records selected source
references, observed revisions/times, freshness or staleness, unresolved
contradictions, the trace identifier when compatible, and the next gate. It is
evidence for selecting or re-reading context; it is never proof that a source
still describes the repository after a restart, handoff, or external edit.

Messages may arrive through an inbox or piggyback on the next normal tool
response. They may request revalidation, a route replan, or a human review, but
they never authorize a mutation, publication, rollback, or context write. A
durable change suggested by a message remains a proposal for the owning
repository: review the source evidence, apply the normal persistence workflow,
and record the resulting fact in its canonical authority only when accepted.

The v1 documentation contract is deliberately ahead of universal runtime
support. Hosts must expose only the message fields and delivery guarantees they
actually implement, and preserve an explicit `unknown`, `stale`, or
`unavailable` condition rather than fabricating freshness.

### Phase 2 portable context planes

Phase 2 delivers the portable core that produces, collects, revalidates, and
stores bounded messages without making any host drain them yet:

- Strict producers map bounded observations (`architecture-decision`,
  `incident`, `changelog`, `project-context`, `project-memory`,
  `project-state`, `git-receipt`, `provider-receipt`) onto Context Messages
  with deterministic dedupe keys derived from `sourceKind:canonicalOwner:ref`
  rather than a caller message id.
- The repository collector scans canonical facts — ADRs under `docs/decisions`,
  `docs/INCIDENTS.md`, the root `CHANGELOG.md`, the newest semver
  `changelogs/X.Y.Z.md`, and the canonical `.bridge`/`docs` PROJECT_*
  authorities — and merges caller-supplied Git/provider receipts. Reads are
  bounded to 128 KiB per file, receive sha256-revision provenance, and report
  `unreadable`/`truncated-at-128kib`/`invalid-receipt`/`source-kind-mismatch`
  diagnostics without leaking file bodies.
- Freshness revalidation (`revalidateMssrContextEvidence`) always resolves to
  `fresh`, `stale`, `conflicting`, `unavailable`, or `unknown`; it never infers
  currentness from a receipt alone.
- A durable explicit-ack JSON inbox stores schema-versioned `advisoryOnly`
  state with strict enqueue/select/acknowledge/prune actions, bounded delivery
  receipts, TTL pruning, and atomic temp+rename file persistence with
  fail-closed load. As of **0.2.12** each delivery receipt carries a stable
  content `fingerprint` and an acknowledged receipt acts as a temporary
  tombstone: enqueue suppresses only a message with the same `messageId` and
  fingerprint, so a content/revision change or a new id reappears, and
  `receiptRetentionMs` pruning lets identical evidence be delivered again.
  Inbox state schema is v2 with transparent v1 migration; legacy v1 receipts
  carry no fingerprint and never suppress.

Delivery is adapter-owned. As of **0.2.11**, native `mssr_route_plan`, Codex
`skill_route_plan`/`skill_bootstrap`, and OpenCode
`mssr_route_plan`/`mssr_skill_bootstrap` resolve one advisory context plane
through the shared `loadProjectContextHost` helper when `projectRoot` is
supplied, and all three host surfaces expose an explicit `mssr_context_ack`
persistence tool. Bridge adapter delivery remains pending: its local
dependency junction crosses the OpenCode workspace authority boundary, so the
Bridge adapter must consume a packaged 0.2.11 artifact. This release claims no
Bridge delivery and no live/restart adoption on any host.

### Keyed repository facts (0.2.11)

Repository facts are now keyed so the same deterministic selection used for
skills also selects project evidence:

- Every observation produced by the repository collector carries explicit
  `stages`, `domains`, `actions`, `artifacts`, `needs`, and `signals` selectors,
  each backed by a conservative source-kind default so it stays derivable.
- An optional `.bridge/context-messages.json` manifest (fallback
  `config/context-messages.json`) v1 overrides per-ref selectors plus
  `priority`, `required`, and `advisoryActions`. Duplicate refs, unsafe paths,
  unknown refs, and malformed JSON fail closed with bounded diagnostics and the
  default selectors survive.

### Modular project-context loader (0.2.11)

`loadProjectContextModules` reads `.bridge/project-context-modules.json` v1:
`core` refs always load, then selector-driven `modules` are deterministically
scored against the bounded stage/intent budget with `priority`, `required`,
`exclusiveGroup` (a tied top score stays ambiguous and loads neither
alternative), and `estimatedChars`. Paths are safe relative markdown, reads are
bounded, `requiredBudgetExceeded`/`requiredOverflow` are explicit, and a full
document fallback remains observable when present.

### Authority and migration preflight

The manifest is optional for repositories that deliberately do not use MSSR project memory, but absence must not be confused with a healthy modular authority once project-memory infrastructure already exists.

Hosts should classify repository state explicitly:

- `modular`: valid `.bridge/project-context.json` is present;
- `legacy`: one or more `PROJECT_CONTEXT.md`, `PROJECT_MEMORY.md`, or `PROJECT_STATE.md` authorities exist without a manifest;
- `invalid`: a manifest exists but fails the canonical schema;
- `empty-bridge`: `.bridge` exists but contains no durable PROJECT_* authority and no manifest;
- `not-initialized`: the managed repository has no `.bridge` project-memory authority yet;
- `unmanaged`: the repository does not opt into the managed project-memory contract.

Detection is read-only evidence. A host may recommend migration or block a release gate when a repository already claims project-memory authority but is structurally inconsistent; it must not synthesize durable facts or empty memory merely to make the audit green.

## Versioned change history and memory consistency

Repositories using the change-consistency contract keep new release notes in `changelogs/X.Y.Z.md` and an index in `changelogs/INDEX.md`. The root `CHANGELOG.md` may remain a compatibility pointer. Historical monolithic material can stay in `changelogs/LEGACY.md` and should not be loaded by default.

Each version file has a small deterministic contract:

```md
# 1.2.3 — 2026-08-13

## Contract

- Summary: Short bounded release summary.
- Areas: routing, project-context
- PROJECT_CONTEXT: reviewed-none
- PROJECT_MEMORY: updated
- PROJECT_STATE: updated
```

Allowed PROJECT_* impact values are:

- `updated`: the release changed that durable authority;
- `reviewed-none`: impact was explicitly reviewed and no durable update was needed;
- `pending`: impact is unresolved and persistence is incomplete.

A host may compare these declarations with the observed Git change set and project authorities. `pending`, a missing current-version file, a missing index reference, or an invalid changelog contract can block persistence. Declaring `updated` while the corresponding authority is absent or not part of the observed release change set is drift evidence that must be reviewed.

MSSR exports a pure parser/evaluator for this contract plus a deterministic predicate for when version history is useful. Host adapters may selectively load `changelogs/INDEX.md` and the current version note for debugging, recovery, history-recovery, repeated friction, conflicting evidence, or release lifecycle work. Loading the full legacy archive remains explicit and exceptional.

## Manifest

Canonical schema: `config/project-context/project-context-manifest.schema.json`.

```json
{
  "schemaVersion": 1,
  "core": [
    {
      "id": "architecture-core",
      "kind": "context",
      "description": "Architecture and ownership needed for substantial work.",
      "source": {
        "path": ".bridge/PROJECT_CONTEXT.md",
        "sections": ["## Architecture", "## Canonical ownership"]
      },
      "maxChars": 5000
    }
  ],
  "modules": [
    {
      "id": "asset-current-state",
      "kind": "state",
      "description": "Mutable asset pipeline state.",
      "source": {
        "path": ".bridge/PROJECT_STATE.md",
        "sections": ["## Asset pipeline"]
      },
      "domains": ["blender"],
      "artifacts": ["asset", "model-3d"],
      "stages": ["start", "implement", "resume"],
      "priority": 20
    },
    {
      "id": "write-snapshot-rule",
      "kind": "directive",
      "description": "Use a bounded snapshot before broad repository refactors.",
      "source": {
        "path": ".bridge/PROJECT_MEMORY.md",
        "sections": ["## Broad refactor safety"]
      },
      "domains": ["coding"],
      "actions": ["edit"],
      "needs": ["integrity-verification"],
      "stages": ["implement"],
      "priority": 40
    }
  ]
}
```

### Implemented 0.2.11 manifest (`.bridge/project-context-modules.json`)

The 0.2.11 loader implements schema v1 under `.bridge/project-context-modules.json` with a compact form: `core` is a list of `{ id }` refs and `modules` is a bounded list of `{ id, path, stages, domains, actions, artifacts, needs, signals, priority, required, estimatedChars, exclusiveGroup? }`. `id`/`exclusiveGroup` use bounded `[a-z0-9._-]` ids, `path` must be a safe relative markdown path, and a required module cannot belong to an exclusive group. `loadProjectContextModules` loads core first, scores modules deterministically under a bounded char/module budget, and returns explicit `decisions`, `requiredBudgetExceeded`, `requiredOverflow`, and `ambiguousExclusiveGroups`. The earlier `.bridge/project-context.json` shape above (with `kind`, `description`, `source.path`/`source.sections`, `maxChars`) remains the documented migration form; hosts may map it onto the compact v1 form.

`core` entries may be `context`, `memory`, or `state`; they may not be directives. Optional modules may additionally use `kind: "directive"`. Required modules should remain rare. Required project modules may exceed the nominal project-context budget only with explicit `requiredBudgetExceeded` evidence; optional modules never inherit extra budget from that overflow. `exclusiveGroup` represents real alternatives; a tied top score stays ambiguous instead of loading both alternatives.

## Memory update discipline

When persisting project knowledge:

- store stable facts in `PROJECT_CONTEXT.md`;
- store durable decisions, recurring local lessons, and rationale in `PROJECT_MEMORY.md`;
- replace or curate superseded mutable information in `PROJECT_STATE.md` instead of accumulating stale status;
- keep secrets, raw transcripts, large logs, and transient tool output out of project memory;
- give recurring sections stable headings so the manifest can retrieve them surgically;
- promote an instruction to a `directive` module only when it is project-specific, conditionally useful, and has clear selectors;
- promote broadly applicable repository rules to `AGENTS.md`;
- promote cross-project procedures to an owning skill instead of copying them into many project memories.

Maintenance may detect stale references, duplicate decisions, contradictory state, oversized core sections, or directives that match too broadly. Detection may propose maintenance; it must not silently rewrite project memory or routing semantics.

## Safe update contract

Hosts that expose a project-memory writer should prefer **stable-section upsert** over free-form append. A durable update identifies the physical knowledge kind (`context`, `memory`, or `state`) plus one exact Markdown heading, replaces only that section, and verifies the resulting bytes/hash. When the caller already read the target, an `expectedSha256` precondition should fail closed on concurrent change instead of silently replacing newer project knowledge.

If the same operation registers the section in `.bridge/project-context.json`, the Markdown update and manifest update should be treated as one bounded transaction: validate the module before writing, derive its source path/section rather than accepting an arbitrary source override, preserve a single module id on update, verify both outputs, and restore the previous pair when a write fails. Registering `kind: "directive"` makes the section *selectable*; it does not make the instruction globally active.

MSSR exports pure `upsertMarkdownSection` and `upsertProjectContextManifestModule` helpers so host adapters can implement this safely without making filesystem mutation part of the deterministic core.

## Separation from skill context

Project context answers **what is true here**. Skills answer **which reusable procedure is needed now**. Both can share the same semantic selection primitive while remaining separate authorities and separate data stores.
