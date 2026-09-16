# Learning review and guarded promotion

Read when reviewing a bounded digest or learning candidate. Owner:
`skill-maintenance-loop`. Routine review needs a decision, not a proposal file.

## Review decision

Preserve findings, friction, references and unknown inputs separately:

- `no-learning-change`: evidenced zero findings, no friction or unresolved gate.
- `insufficient-evidence`: missing cause, recurrence, owner, references or gates;
  name the missing input and stop promotion.
- `proposal-ready`: a bounded supported candidate with no review blockers;
  eligibility for review never authorizes automatic changes.

Decide even for zero findings; retain friction even if findings are empty.
Absent evidence stays unknown; explicit false stays unavailable. Do not infer
usefulness from loading, frequency or self-scoring, or count retries as
independent evidence. Optional decisions may remain undecided. Supported
choices require an explicit host `reasonCode` and references; missing reasons
remain blockers. Record no-change reviews in the existing checkpoint.

## Proposal gate

Only when producing/testing a proposal, use this skill's
`scripts/build_change_proposal.py`; inspect its CLI/input contract and read back
the decision, unresolved inputs and gates. It writes only the requested artifact.
Keep `mode=observe-only`, `routingInfluence=false`,
`automaticMutationPerformed=false`, `automaticPromotionPerformed=false`.

Historical influence requires independent durable evidence for every gate:

1. `datasetAudit`: representative data, provenance and quality.
2. `replayHoldout`: chronological replay separated from held-out evaluation.
3. `calibration`: validated confidence/threshold behavior.
4. `shadow`: measured behavior without production influence.
5. `featureFlagRollback`: bounded flag, owner and tested rollback.

Missing, unknown or failed gates keep influence zero. Unit tests do not prove
calibration or shadow results. All passed gates allow only
`promotionEligibleForHumanReview=true`; application requires explicit
human authorization, source review, regression and rollback in a visible task.
Ordinary authorized fixes do not need historical-learning promotion.

After changing this contract/generator, run from MSSR:
`python skills/skill-maintenance-loop/scripts/build_change_proposal.py --self-test`.
It covers zero findings, insufficient friction, missing reasons and fully
supported review eligibility while keeping influence/promotion disabled.
Never retain raw prompts, transcripts, secrets or private reasoning.
