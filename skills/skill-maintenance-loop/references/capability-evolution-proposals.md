# Controlled capability evolution proposals

- **Type:** decision-record
- **Owner:** skill-maintenance-loop
- **Status:** active
- **Read when:** repeated friction, a demonstrated high-impact incident, or a reusable gap raises the question of updating an existing skill, adding executable support, creating a module/guide/tool, or proposing a new skill.
- **Signals:** `repeated-friction`, `manual-workaround`, `skill-gap`, `reusable-pattern`, `missing-capability`
- **Evidence threshold:** two occurrences, one repeated correction, or one high-impact incident with demonstrated cause.
- **Last reviewed:** 2026-07-27
- **Review trigger:** governance rules, routing lifecycle or skill repository architecture changes.

## Purpose

Generate a bounded **proposal**, never an automatic instruction mutation. The proposal makes ownership and evidence explicit so a human-visible task can decide what to change.

```text
incident facts
  -> classify owner and evidence threshold
  -> choose smallest durable capability change
  -> emit tests/routing/persistence checklist
  -> no source edits
```

Use `scripts/build_change_proposal.py` with a JSON incident record. The script is deterministic and read-only except for its output report.
For a digest with `findings=0`, observed friction, optional decisions or any later promotion candidate, also load `learning-review-promotion.md`. The proposal is only a human-review candidate: it remains observe-only with `routingInfluence=false` until its separate evaluation gates are evidenced.

## Decision ladder

1. `local-documentation` when the fact is project-specific and does not generalize.
2. `update-existing-skill` when an existing owner already has the same objective and the missing rule belongs in its main workflow.
3. `add-skill-memory-module` when the owner is correct but the rule is conditional, incident-specific or too detailed for the control plane.
4. `add-script-tool-or-guide` when prose cannot reliably enforce a repeated operation or verification gate.
5. `new-skill-candidate` only when all are true:
   - independent reusable objective;
   - at least three stable steps;
   - independent activation boundary;
   - independent success metric;
   - multiple likely use cases;
   - no existing owner cleanly covers it.
6. `context-handoff` when another product/provider owns the required state or authority.
7. `insufficient-evidence` when the threshold or cause is not established.

A proposal may recommend more than one coordinated action, such as updating the owner plus adding a validator and routing fixtures. It must still name one primary owner.

## Input shape

```json
{
  "title": "Saved preview used as modeling master",
  "summary": "...",
  "occurrences": 2,
  "highImpact": true,
  "demonstratedCause": true,
  "reusable": true,
  "projectSpecific": false,
  "existingOwner": "visual-reference-authoring",
  "ownerCoversObjective": false,
  "independentObjective": true,
  "stableSteps": 5,
  "independentActivation": true,
  "independentSuccessMetric": true,
  "multipleUseCases": true,
  "executionSupportNeeded": true,
  "contextOwnedElsewhere": false,
  "signals": ["repeated-friction", "conflicting-evidence"],
  "evidenceRefs": ["path or incident id"]
}
```

## Output requirements

The output must include:

- evidence threshold result;
- primary recommendation and owner;
- rationale from supplied facts only;
- required artifacts, tests and routing work;
- explicit `automaticMutationPerformed=false`;
- explicit learning-review decision, including evidence or insufficiency for zero findings and observed friction;
- explicit optional-decision status; a host that has evidence must provide `reasonCode`, while absent evidence remains absent or unknown rather than invented;
- `automaticPromotionPerformed=false`, `routingInfluence=false` and the evidence status of dataset audit, replay/holdout, calibration, shadow and feature flag/rollback;
- unresolved inputs that need human review.

## Safety boundary

- Do not scan telemetry and rewrite skills in the background.
- Do not create a new skill only because a keyword matched.
- Do not infer demonstrated cause, recurrence or independent scope from missing input.
- Do not modify routing, source files or Git.
- Do not promote a proposal, enable a feature flag or change routing from this output, including when every evaluation gate is supplied.
- A visible follow-up task must load `shared-skill-governance` and `skill-routing-maintainer`, inspect the catalog, apply the approved change, test and publish it.
