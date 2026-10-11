# MSSR operational learning loop

MSSR learning is an external operational decision layer. It does **not** train, fine-tune, or modify the weights of the host language model. Its purpose is to measure which routing and context decisions tend to be useful for recurring observable task shapes, then make those measurements reviewable before any future decision influence is enabled.

## Current mode

The current contract is deliberately conservative:

```text
mode = observe-only
routingInfluence = false
```

`learning-digest-v1` is distilled at the final outcome from privacy-bounded structured evidence. The host purges ephemeral trace working memory afterward. Durable learning never receives raw prompts, transcripts, secrets, private chain-of-thought, `workingSummary`, active hypotheses, or arbitrary scratch decisions.

The current `minEvidence` value is an **analysis eligibility gate**, not an activation threshold. Reaching the minimum sample count only means that an aggregate may be inspected as more than a single anecdote. It does not authorize MSSR to change a route or context selection.

## What a learning digest can contain

A digest may retain only observable reusable consequences such as:

- canonical semantic task signature;
- skills recommended by deterministic routing;
- required/root/dependency role where observable;
- host `accepted` / `skipped` decisions and bounded reason codes;
- skills actually loaded;
- stage-to-skill transitions;
- skill/project context modules selected or skipped;
- final outcome status, acceptance/score metadata, and evidence reference;
- hypotheses that ended explicitly `supported` or `rejected` with evidence.

The canonical exact semantic signature currently derives from execution stage plus sorted canonical intent dimensions: domains, actions, artifacts, needs, and signals. It represents an observable task class, not the user's full request text.

## What the current numbers mean

The first analysis surface exposes empirical rates. They are **not yet calibrated probabilities**.

For a `(semantic signature, skill)` pair, useful measurements include:

- `evidenceCount`: number of strict digests supporting that aggregate;
- `recommendedCount`: how often deterministic routing proposed the skill;
- `loadedCount`: how often its procedural context was actually materialized;
- `acceptedCount` / `skippedCount`: explicit host decisions for optional roots;
- `activationRate`: loaded / observed opportunities under the current definition;
- `acceptanceRate`: accepted / measured optional decisions;
- `successRateWhenLoaded`: successful outcomes among traces where the skill was loaded.

Transition aggregates measure recurring `fromStage -> toStage -> skill` patterns. Context priors measure how often a bounded skill/project module was selected for the same semantic signature.

A raw rate of `1.0` with `n=1` means only “one observed event succeeded.” It must never be interpreted as a 100% reliable prediction.

## Biases that must be controlled before activation

Historical telemetry is observational, not a randomized experiment. Before using it as a decision input, analysis must account for at least:

- **small samples** and extreme rates from `n=1` or similarly weak support;
- **selection bias** because the deterministic router decides which candidates are exposed;
- **host-decision bias** because `not-evaluated` is not equivalent to a genuine semantic rejection;
- **outcome attribution bias** because a successful task may have several supporting skills but one primary owner;
- **missing-outcome bias** from traces that never reached a trustworthy final outcome;
- **correlated traces/retries** that should not masquerade as independent evidence;
- **host/model/runtime drift** across ChatGPT Web, Codex, OpenCode, model versions, providers, and skill revisions;
- **signature fragmentation**, where exact signatures are too sparse to estimate stable behavior.

For these reasons, old selection feedback and strict learning digests must remain distinguishable. Legacy accepted/skipped counts can help diagnose behavior, but only the strict digest dataset should drive a future calibrated learning model unless an explicit migration validates older evidence.

## Rollout gates

Learning should advance through separate gates rather than jumping from collection to automatic routing.

### 1. Observe-only collection

Accumulate strict digests across representative domains, stages, skills, projects, callers, and outcomes while keeping `routingInfluence=false`.

Measure dataset coverage, missing outcomes, explicit-vs-default skill decisions, context-module evidence, and the distribution of semantic signatures.

### 2. Dataset-quality audit

Before fitting or trusting priors:

- distinguish deliberate `accepted`/`skipped` decisions from `not-evaluated` defaults;
- measure independent trace support rather than only event count;
- identify stale skill/routing revisions and caller/model drift;
- exclude or separately label incomplete/ambiguous outcomes;
- verify that privacy and digest projection invariants still hold.

### 3. Historical replay / holdout evaluation

Use only evidence available **before** each historical decision to predict later observed decisions/outcomes. Compare the learned signal with the deterministic baseline rather than evaluating on the same rows used to build it.

Useful evaluation dimensions include:

- activation precision/recall where a trustworthy target exists;
- false-positive/over-activation and false-skip rates;
- required-skill miss rate (which must not regress);
- outcome/acceptance lift when a suggested optional skill was used;
- context characters saved versus outcome quality;
- calibration error for probability-like estimates;
- performance by domain, stage, caller, model profile, and skill revision.

### 4. Calibration

Raw frequencies should be converted into bounded confidence-aware estimates before they can become decision inputs. Candidate methods include smoothing, confidence/credible intervals, minimum distinct-trace support, recency decay, staleness invalidation, and hierarchical/back-off estimates for sparse signatures.

Exact deterministic signatures remain the baseline. Similarity/vector retrieval may later retrieve nearby evidence, but it must be a secondary signal and must be evaluated independently before it affects routing.

### 5. Shadow decision model

Compute what the historical layer **would** have suggested while continuing to execute the unchanged deterministic/host-gated route. Persist only the bounded comparison result.

This phase should answer: does the learned layer improve decisions on future traces, or merely explain the same historical choices after the fact?

### 6. Bounded activation — future only

Only after replay and shadow evaluation show a repeatable net benefit should a reviewed configuration be allowed to set a non-zero historical influence. Activation must include:

- an explicit versioned feature flag;
- a bounded secondary contribution rather than replacement of deterministic routing;
- an exploration floor so rare/new skills can still surface;
- decay/staleness handling;
- unchanged workflow-required skills, dependency invariants, permissions, and safety gates;
- observable explanation of deterministic evidence versus historical evidence;
- immediate rollback to `observe-only`;
- regression/replay gates before promotion.

## Possible future decision model

A simple conceptual form is:

```text
deterministic route evidence
        +
λ * calibrated historical delta
        =
optional candidate ranking / host decision support
```

Today:

```text
λ = 0
```

The deterministic contract still decides required workflow obligations and hard activation constraints. A future historical term may only help rank or advise **optional** choices unless a separately reviewed contract explicitly changes a deterministic rule.

This layer can support several decisions independently:

### Skill routing

Estimate whether an optional skill is likely to be useful for a semantic task class. A repeatedly useful skill can be raised among optional candidates; a repeatedly irrelevant one can be deprioritized. This should be contextual, not a global “good/bad skill” score.

### Host optional-skill decision

When ChatGPT Web receives an optional candidate, historical evidence can eventually be shown as one input for `accepted`/`skipped`, with support/confidence and reason. It should not silently make the host decision at first.

### Stage-transition assistance

Repeated sequences can reveal that a certain failure/signal/stage frequently requires another capability next. This can surface an earlier suggestion such as `visual anomaly -> systematic debugging`, while still requiring current observable evidence.

### Context selection and budgeting

Historical module use can help rank which skill/project context modules deserve scarce context budget for a task signature. This is separate from skill activation: a skill may be correct while only two of its modules are usually relevant.

Context learning should eventually evaluate usefulness, not merely “was loaded.” Selection frequency alone is insufficient if there is no downstream evidence that the module contributed to a good outcome.

### Maintenance proposals

Repeated false positives, false negatives, friction, missing capabilities, or stale context can generate **review-only** proposals for fixtures, routing metadata, skills, tools, guides, or project context. Metrics never edit those durable sources silently.

## Promotion versus prediction

Prediction answers “what might help on the next similar task?” Promotion answers “should the durable system itself change?” They are deliberately separate.

Promotion follows the evidence ladder in `AGENT_PROTOCOL.md`: isolated evidence stays telemetry/local context; reproduced project defects become regressions; repeated cross-project procedural gaps may update an owning skill; routing-semantic defects require reviewed MSSR metadata and fixtures; a new skill requires an independently reusable objective.

## Activation checklist

Do not enable routing influence merely because an aggregate crosses `minEvidence`.

Before activation, require all of the following:

- sufficient independent strict digests for the evaluated slice;
- trustworthy explicit decisions/outcomes rather than mostly `not-evaluated` data;
- replay/holdout improvement over the deterministic baseline;
- shadow-mode improvement on later traces;
- bounded calibration/confidence and staleness behavior;
- no regression in required-skill compliance, safety, or permissions;
- exploration for novel/rare capabilities;
- observable explanations and rollback;
- explicit reviewed change to the versioned configuration.

Until those gates pass, the correct behavior is to collect, inspect, and learn **about** the router without learning **into** the router.
