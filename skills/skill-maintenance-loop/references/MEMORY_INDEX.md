# Skill maintenance memory index

Use this index to load only the module needed for the current maintenance symptom. `SKILL.md` remains the routed control plane and every module below belongs to `skill-maintenance-loop`.

| Module | Type | Read when | Signals / evidence | Status | Owner | Last reviewed |
|---|---|---|---|---|---|---|
| [system-map.md](system-map.md) | decision-record | deciding which repository, skill, project, tool, guide or context owns a change | unclear source of truth or duplicated ownership | active | skill-maintenance-loop | 2026-07-27 |
| [friction-patterns.md](friction-patterns.md) | incident-pattern | a failure, workaround, stale output, lifecycle problem or unsafe verification resembles prior maintenance | `error-observed`, `warning-observed`, `repeated-friction`, `manual-workaround` | active | skill-maintenance-loop | 2026-08-07 |
| [skill-memory-modules.md](skill-memory-modules.md) | invariant | a skill is accumulating optional notes, bugs, recipes, compatibility facts or recovery procedures and needs selective loading | `reusable-pattern`, `skill-gap`, growing references | active | skill-maintenance-loop | 2026-07-27 |
| [capability-evolution-proposals.md](capability-evolution-proposals.md) | decision-record | evidence suggests a reusable capability change and the system must choose update, module, script/tool/guide, new skill or context handoff without automatic mutation | `repeated-friction`, `skill-gap`, `reusable-pattern`, `missing-capability` | active | skill-maintenance-loop | 2026-07-27 |
| [operational-pattern-automation.md](operational-pattern-automation.md) | maintenance recipe | the same deterministic multi-step operational sequence or bookkeeping ceremony repeats across traces/releases | `repeated-friction`, `manual-workaround`, `reusable-pattern`, stable inputs/outputs/gates | active | skill-maintenance-loop | 2026-08-18 |
| [learning-review-promotion.md](learning-review-promotion.md) | verification | a digest has zero findings, observed friction, optional decisions or a candidate learning that could be proposed for promotion | `nominal`, `repeated-friction`, `manual-workaround`, `reusable-pattern`, `missing-capability`, `conflicting-evidence` | active | skill-maintenance-loop | 2026-08-13 |
| [architecture-documentation-consistency.md](architecture-documentation-consistency.md) | invariant | architecture, ADR, context/state, changelog or incident evidence conflicts, is stale, or needs a reviewed persistence proposal | `conflicting-evidence`, `repeated-friction`, `reusable-pattern`, stale/unknown provenance | active | skill-maintenance-loop | 2026-08-13 |

## Current high-value memory

| Pattern | Canonical module | Incident source | Load trigger |
|---|---|---|---|
| Source skill exists but Codex cannot load it because the runtime junction was not installed | [friction-patterns.md](friction-patterns.md#source-skill-exists-but-runtime-junction-was-not-installed) | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | new, renamed or moved skill; `skill_load` reports not found |
| Visual manifest metadata is absent or contradicts the saved reference bytes | [friction-patterns.md](friction-patterns.md#declared-visual-metadata-reused-without-byte-readback) | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | reference handoff, dashboard promotion or modeling bundle has null/unproved dimensions or hashes |
| Cross-project dashboard/library risks becoming a second source authority | [friction-patterns.md](friction-patterns.md#derived-catalog-becomes-an-accidental-source-authority) | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | catalog/provider workflow, copied canonical source, ambiguous write owner |
| Current source hash differs from a previously validated snapshot | [friction-patterns.md](friction-patterns.md#validated-snapshot-silently-rewritten-to-match-the-current-working-source) | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | source drift, expected/measured hash conflict, stale validation |
| Technical checks pass while human approval or downstream authorization is still pending | [friction-patterns.md](friction-patterns.md#technical-validation-mistaken-for-human-approval-or-downstream-authorization) | `D:\Dev\mauroprime-skills\docs\INCIDENTS.md` | PASS metric plus pending approval/export/runtime gate |
| A zero-finding digest or observed friction could bypass an explicit learning decision or reversible promotion gate | [friction-patterns.md](friction-patterns.md#empty-digest-or-observed-friction-bypasses-a-learning-decision) | Procedure guard; no fabricated operational incident | audit digest, observed workaround, optional decision or candidate promotion |

## Maintenance rule

Update the incident ledger first with the observable chronology, then update the generalized module and this index. Mark replaced knowledge as `superseded`; do not silently leave two active contradictory rules.
