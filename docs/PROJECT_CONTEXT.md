# Modular project context

MSSR treats project knowledge as a separate retrieval layer from reusable skills. Starting with 0.2.18, `.mssr/` is the **only active project-control home**. A managed repository is healthy only after explicit MSSR initialization creates a valid `.mssr/project-context.json`; `.bridge/` is not a read fallback and active MSSR artifacts there are cleanup debt. Hosts must not synthesize project truth merely because a repository is missing context.

## Authorities and roles

1. `AGENTS.md` or `AGENTS.override.md`: repository-level instructions intended to apply broadly.
2. `.mssr/PROJECT_CONTEXT.md`: compact stable facts such as project identity, architecture, vocabulary, ownership, canonical paths, and invariants.
3. `.mssr/PROJECT_MEMORY.md`: compact durable decisions and lessons that remain useful across sessions but are not automatically instructions.
4. `.mssr/PROJECT_STATE.md`: compact mutable current state such as active phase, blockers, handoffs, and current versions.
5. `.mssr/knowledge/<topic>/*.md`: situational project-local knowledge selected through the manifest when the control-plane authorities would otherwise grow or become task-specific.
6. Manifest modules with `kind: "directive"`: small project-specific instructions that apply only when their structured selectors match the current MSSR intent and stage.
7. `.mssr/runtime/`: ephemeral inbox/receipt/cache state; it is never project authority and is Git-ignored as a directory.

Knowledge topics are `architecture`, `design`, `law`, `pattern`, `vocabulary`, `decision`, `state`, `phase`, `reference`, `operations`, and `other`. `kind` answers how authoritative content behaves (`context`/`memory`/`state`/`directive`); `topic` answers what the content is about. A decision normally maps to memory, state/phase to state, and architecture/design/law/pattern/vocabulary/reference/operations to context unless an explicit reviewed override is justified.

A directive is a scoped refinement, not a new authority tier. It cannot weaken the current user request, host safety policy, `AGENTS.md`, approvals, permissions, or verification requirements. If an instruction should apply to almost every task in the repository, it belongs in `AGENTS.md`.

## Bootstrap lifecycle

```text
known repository
  -> verify/initialize .mssr contract
  -> load AGENTS
  -> load small project-context core
  -> classify canonical MSSR intent
  -> select project context/memory/state/directive modules
  -> route and load active skill modules
  -> execute authorized tools
  -> re-select project + skill modules at verify/persist/close or a material replan
  -> run Project Context Health / knowledge maintenance when evidence warrants it
```

The core provides only the durable information needed to understand and begin work safely. Before canonical intent exists, optional modules remain deferred. Once intent exists, MSSR evaluates `stage`, `domains`, `actions`, `artifacts`, `needs`, and `signals` deterministically under a bounded context budget. A missing or invalid manifest is an initialization/health condition, not permission to load PROJECT_* or arbitrary docs wholesale.

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

### Portable Context Plane and repository facts

MSSR Context Plane collects bounded evidence, revalidates freshness, selects messages by the same structured semantic dimensions, and stores explicit-ack delivery state under `.mssr/runtime/context-inbox.json`. Runtime receipts are reconstructable evidence and are never versioned project authority.

The repository collector publishes only intentional canonical sources:

- ADRs under `docs/decisions/`;
- `INCIDENTS.md` ledgers discovered under `docs/`;
- root `CHANGELOG.md` and the newest semver `changelogs/X.Y.Z.md`;
- canonical `.mssr/PROJECT_CONTEXT.md`, `.mssr/PROJECT_MEMORY.md`, and `.mssr/PROJECT_STATE.md`;
- caller-supplied Git/provider receipts with bounded provenance.

It does **not** discover project authorities from `.bridge/`, does not auto-publish `docs/PROJECT_CONTEXT.md`, and does not search fallback selector manifests outside `.mssr/context-messages.json`. Historical sources can still be inspected explicitly as ordinary repository evidence, but they do not enter the active project context by path convention.

Freshness revalidation resolves to `fresh`, `stale`, `conflicting`, `unavailable`, or `unknown`; a receipt alone never proves currentness. Pending inbox messages deduplicate only when both advisory subject and content fingerprint match. A new source revision replaces stale pending evidence.

### Single project-context manifest (0.2.18)

`.mssr/project-context.json` is the single active selective project-knowledge manifest. It contains:

- `core`: small entries loaded before optional context is useful;
- `modules`: selector-driven project knowledge with `kind`, optional semantic `topic`/`area`, source path/sections, priority, required status, and the standard stage/domain/action/artifact/need/signal selectors.

Optional module files are read only after semantic eligibility is established, which avoids spending I/O/context on irrelevant project knowledge. Required modules can overflow the nominal budget only with explicit `requiredBudgetExceeded`; optional modules do not silently inherit extra budget. Tied `exclusiveGroup` candidates remain ambiguous instead of loading both.

### Project Knowledge layout

When PROJECT_* starts mixing unrelated areas or large situational detail, keep the invariant/summary in the authority and move the detail into an indexed module:

```text
.mssr/
  PROJECT_CONTEXT.md
  PROJECT_MEMORY.md
  PROJECT_STATE.md
  project-context.json
  context-messages.json        # optional
  knowledge/
    architecture/
    design/
    law/
    pattern/
    vocabulary/
    decision/
    state/
    phase/
    reference/
    operations/
    other/
  runtime/
    context-inbox.json         # ephemeral
```

`Project Context Health` is advisory and reports structural debt such as missing/invalid initialization, oversized PROJECT_* authorities, oversized or whole-file modules, too many modules, missing module sources, unindexed knowledge files, or active MSSR artifacts under `.bridge/`. Typical levels are `ok`, `watch`, and `review`. `watch` should not interrupt normal work; `review` is a maintenance/replan signal.

### Initialization and canonical-only cutover

A managed repository must pass the MSSR initialization contract. `initializeMssrProject` is idempotent for one repository; `initializeMssrWorkspace` discovers Git repositories recursively (with bounded depth/noisy-directory exclusions) and applies the same contract without duplicating host logic.

Initialization can:

- create missing PROJECT_* skeletons and a minimal valid manifest without inventing project-specific architecture facts;
- create `.mssr/knowledge/` and `.mssr/runtime/`;
- normalize `.mssr/.gitignore` to ignore `/runtime/` only;
- remove the obsolete pre-0.2.18 `.mssr/mssr-context-inbox.json` rather than carry stale receipts forward;
- remove known MSSR-owned `.bridge` artifacts only when durable canonical counterparts exist; ephemeral legacy inbox state may be discarded because it is reconstructable;
- block rather than erase a durable legacy authority when no canonical counterpart exists.

`.bridge/` may continue to contain files genuinely owned by Bridge or historical workspace snapshots. MSSR initialization only knows its bounded list of old MSSR-owned filenames and must not delete unrelated `.bridge` content.

A repository without `.mssr/project-context.json` is `not-initialized` for MSSR project knowledge. A repository with an invalid manifest or legacy MSSR artifacts is structurally unhealthy. The watcher/maintenance evaluator may surface those conditions, but detection itself never writes durable project knowledge.
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
        "path": ".mssr/PROJECT_CONTEXT.md",
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
        "path": ".mssr/PROJECT_STATE.md",
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
        "path": ".mssr/PROJECT_MEMORY.md",
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

### Active manifest contract (0.2.18)

The active schema v1 is `.mssr/project-context.json`. `core` and `modules` both carry explicit `kind`, `description`, `source.path` plus optional stable `source.sections`; they may additionally declare semantic `topic` and `area`. Modules keep stage/intent selectors, `priority`, `required`, `maxChars`, and optional `exclusiveGroup`. The older compact `project-context-modules.json` format is historical and is not read by current MSSR.

`maxChars` bounds the **materialized selection** after `source.sections` extraction, not the size of the backing Markdown authority. The source file still has the global hard cap, so a large durable authority may safely expose one small bounded section without failing merely because unrelated sections exist in the same file.

`core` entries may be `context`, `memory`, or `state`; they may not be directives. Optional modules may additionally use `kind: "directive"`. Required modules should remain rare. Required project modules may exceed the nominal project-context budget only with explicit `requiredBudgetExceeded` evidence. `exclusiveGroup` represents real alternatives; a tied top score stays ambiguous instead of loading both.

Hosts may set `contextIncludeCore: false` on a route/bootstrap phase replan **only when that same host has already delivered the project core**. This explicit host contract preserves budget for newly relevant stage/intent modules without hidden session inference; first delivery still includes core by default.

## Memory update discipline

When persisting project knowledge:

- keep PROJECT_* compact: stable cross-area facts in `.mssr/PROJECT_CONTEXT.md`, durable cross-area decisions/lessons in `.mssr/PROJECT_MEMORY.md`, and mutable cross-area status in `.mssr/PROJECT_STATE.md`;
- move cohesive situational detail into `.mssr/knowledge/<topic>/` and register it in `.mssr/project-context.json` instead of extending PROJECT_* indefinitely;
- use semantic `topic` and optional `area` so design, laws, patterns, vocabulary, decisions, state/phases, references, and operations can be retrieved independently;
- replace or curate superseded mutable state instead of accumulating stale chronology in an active state module;
- keep secrets, raw transcripts, private reasoning, large logs, and transient tool output out of project knowledge;
- capture only a reviewed durable statement from a conversation, not the conversation itself;
- give recurring sections stable headings when a module intentionally shares a larger Markdown file;
- promote an instruction to a `directive` module only when it is project-specific, conditionally useful, and has clear selectors;
- promote broadly applicable repository rules to `AGENTS.md`;
- promote cross-project procedures to an owning skill instead of copying them into many project memories.

Maintenance may detect stale references, duplicate decisions, contradictory state, oversized PROJECT_* or modules, unindexed knowledge files, too many modules, or directives that match too broadly. Detection may propose maintenance; it must not silently rewrite project memory or routing semantics.

## Safe update contract

Hosts that expose a project-memory writer should prefer **stable-section upsert** over free-form append. A durable update identifies the physical knowledge kind (`context`, `memory`, or `state`) plus one exact Markdown heading, replaces only that section, and verifies the resulting bytes/hash. When the caller already read the target, an `expectedSha256` precondition should fail closed on concurrent change instead of silently replacing newer project knowledge.

If the same operation registers the section in `.mssr/project-context.json`, the Markdown update and manifest update should be treated as one bounded transaction: validate the module before writing, derive its source path/section rather than accepting an arbitrary source override, preserve a single module id on update, verify both outputs, and restore the previous pair when a write fails. Registering `kind: "directive"` makes the section *selectable*; it does not make the instruction globally active.

MSSR exports pure `upsertMarkdownSection` and `upsertProjectContextManifestModule` helpers plus `planMssrProjectKnowledgeCapture`. The capture planner normalizes a reviewed durable statement into a deterministic `.mssr/knowledge/<topic>/<id>.md` target and validated manifest module; the host still owns the explicit filesystem transaction, conflict checks, and verification. No helper persists raw conversation text automatically.

## Separation from skill context

Project context answers **what is true here**. Skills answer **which reusable procedure is needed now**. Both can share the same semantic selection primitive while remaining separate authorities and separate data stores.
