# Learning review and guarded promotion proposal

- **Type:** verification
- **Owner:** skill-maintenance-loop
- **Status:** active
- **Read when:** an audit digest has zero findings, observed friction, optional decisions, or a candidate learning that could later influence reusable guidance or routing.
- **Signals:** `nominal`, `repeated-friction`, `manual-workaround`, `reusable-pattern`, `missing-capability`, `conflicting-evidence`
- **Evidence threshold:** every digest receives a decision; promotion evidence requires the full staged gate below.
- **Last reviewed:** 2026-08-13
- **Review trigger:** the digest schema, proposal generator, evaluation dataset, calibration process, shadow policy, feature-flag contract or rollback procedure changes.

## Purpose and boundary

This is an internal stage of `skill-maintenance-loop`, not an independently routed skill. It makes observed learning reviewable without letting telemetry, a zero-count report, or a single incident edit skills or alter routing.

```text
digest (facts, source references, declared absences)
  -> learning-review (explicit decision and insufficiencies)
  -> promotion proposal (human-review candidate only)
```

The generator is deterministic and non-mutating. It can write an explicitly requested proposal artifact, but it never writes skills, routing metadata, fixtures, source guidance, feature-flag state, or Git history. `automaticMutationPerformed=false` and `automaticPromotionPerformed=false` are required output facts.

## Digest contract

Freeze only observable facts:

- `findings`: bounded findings from the audit; an explicit empty list means `findings=0`.
- `observedFriction`: bounded observable workarounds, failures or anomalies. It may be empty.
- `evidenceRefs`: durable paths, incident IDs, audit records or test outputs supporting a claim.
- evidence availability: `true`, `false`, or omitted when unknown. Omission remains `unknown`; it must not be coerced to `false`.
- optional decisions: a decision identifier, selected outcome, declared evidence availability and references when available.

`findings=0` is not a no-op. The learning review must record `no-learning-change` with the available evidence, or `insufficient-evidence` when the zero finding count cannot be supported. Observable friction must receive a recommendation or an insufficiency decision; it must never disappear because the finding count is zero.

## Learning-review decision

The review records exactly one primary decision:

1. `no-learning-change` only when a supported digest explicitly has `findings=0`, no observed friction and no unresolved decision gate.
2. `proposal-ready` when a bounded reusable change has enough evidence and no review blocker. This is still observe-only.
3. `insufficient-evidence` when recurrence, cause, evidence references, ownership, an optional-decision reason, or promotion-gate evidence is missing.

Keep the supplied evidence separate from the conclusion. If a field is absent, report it under `unresolvedInputs` or a gate as `unknown`; do not synthesize a cause, a failed test, recurrence, or a reason code.

## Optional decisions

An optional decision may remain undecided. When the host has evidence for one, it must carry a non-empty explicit `reasonCode` chosen by the host (for example `evidence-supports`, `evidence-insufficient`, `owner-scope`, `risk-avoidance`, or `human-approval-required`) plus its references. A missing `reasonCode` with `evidenceAvailable=true` is a review blocker, not an inferred choice.

When `evidenceAvailable=false`, preserve `evidence-unavailable`; when the field is omitted, preserve `evidence-availability-unknown`. Neither state may be rewritten as a reason code or used to promote a candidate.

## Guarded promotion gates

Until all gates below are both marked `passed` and supported by at least one durable reference, the proposal must remain:

```json
{
  "mode": "observe-only",
  "routingInfluence": false,
  "automaticPromotionPerformed": false
}
```

Required gates are:

1. `datasetAudit`: representative dataset scope, provenance and quality were audited.
2. `replayHoldout`: replay and held-out evaluation are separated and recorded.
3. `calibration`: thresholds or confidence behavior were calibrated against the evaluation evidence.
4. `shadow`: the candidate ran without controlling production behavior and its measured result was reviewed.
5. `featureFlagRollback`: a bounded feature flag, owner, enable rule and tested rollback are available.

Passing all gates changes only `promotionEligibleForHumanReview=true`. It never changes routing, source files, runtime behavior, feature flags, or live configuration automatically. Human approval must open a visible follow-up task with owner inspection, snapshot/diff, regression coverage, the applicable routing checks, and a verified rollback.

## Procedure

1. Freeze the digest and preserve references or their exact insufficiency.
2. Run the deterministic proposal generator to produce the learning review and proposal.
3. Read the decision, optional-decision blockers and each promotion gate back from the generated artifact.
4. For a `proposal-ready` candidate, collect the five gate artifacts independently; do not treat a green unit test as shadow or calibration evidence.
5. If all gates pass, request human review. If any gate is absent, failed or unknown, keep `observe-only` and `routingInfluence=false`.
6. Apply any approved source or routing change only in a separate visible maintenance task with its normal verification and rollback evidence.

## Regression/readback

Run:

```powershell
python .\skills\skill-maintenance-loop\scripts\build_change_proposal.py --self-test
```

The regression must cover: a supported zero-finding digest, observed friction with insufficient evidence, an optional decision missing `reasonCode` despite available evidence, and a fully evidenced gate set that is eligible only for human review. It must also prove that routing influence and automatic promotion remain false in every generated proposal.

## Limits

- The stage does not learn from raw prompts, transcripts, secrets or private reasoning.
- It does not claim that a missing field is negative evidence.
- It does not add or change routing merely because the procedure is organized differently.
- It does not substitute statistical evaluation for human authorization or a rollback plan.
