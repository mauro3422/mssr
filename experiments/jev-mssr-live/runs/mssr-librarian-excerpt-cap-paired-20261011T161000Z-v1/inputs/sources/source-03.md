# HANDOFF — MSSR longitudinal attention map for Codex

Date: 2026-09-03 (America/Argentina/Tucuman)
Project: `D:\Dev\mssr`
Reader: Codex / next MSSR implementation pass
Origin workflow: `mssr-handoff-2026-09-03`
MSSR trace: `mssr-20260903142812-f9b13c6d-a12`
Scope of this handoff: documentation + coordination only. No code or routing semantics were changed while producing it.

## Purpose

This handoff consolidates the issues that emerged from the longitudinal MSSR/MauroPrime research loop and reconciles them against the current MSSR project authority before Codex starts changing implementation.

It is intentionally **not** another changelog and **not** a replacement for specialized handoffs already active in the repo. Its job is to answer:

1. what looks mature enough to stop optimizing blindly;
2. what measurements are currently confounded or incomplete;
3. what hypotheses now deserve controlled evidence;
4. which active implementation handoffs already own part of the problem;
5. what Codex should prove before increasing autonomy or adding more capabilities.

## Authority and current-work warning

Canonical project bootstrap is `D:\Dev\mssr\.mssr\project-context.json` plus the current `.mssr/PROJECT_*` state/memory/context documents.

The repository was already **dirty before this handoff**. Do not bulk-reset, restore, stage, squash, or reinterpret unrelated work as belonging to this document.

Two specialized handoffs already exist and own active slices:

- `docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md`
  - current F3/event-trigger work;
  - principal classification and delegated authority;
  - high-impact authorization containment;
  - event identity / replay / webhook semantics.
- `docs/skill-routing/HANDOFF_CONTEXT_ECONOMY_PRIORITY.md`
  - current context-selection/context-economy work;
  - bounded selective context and priority behavior.

Use this file as the **cross-cutting validation/evaluation layer above those handoffs**. Do not duplicate their implementation plans unless new evidence proves a contract is missing.

## Current invariants that should not be weakened

The current project memory/state establishes several durable constraints that remain sound and should survive any work proposed below:

- MSSR stays portable and platform-agnostic; host adapters remain thin.
- routing and state transitions remain deterministic/explainable;
- learning defaults to observe-only and must remain user-controlled;
- `routingInfluence=false` remains the safe default until evidence gates are satisfied;
- evidence, authority, verification, persistence and outcomes remain explicit concepts;
- storage of evidence is not equivalent to activation of learned behavior;
- recommendation is not authorization;
- a blocked/deferred/partial result can be a valid result and must not be silently converted into pressure to bypass constraints.

---

# Priority map

## P0-A — Build cohort-valid longitudinal evaluation before trusting trend claims

### Evidence / why this moved to P0

The daily analysis repeatedly hit a methodological problem: MSSR has enough telemetry to produce attractive percentages, but a temporal aggregate can mix different experimental regimes.

Important distinctions already observed:

- `scope=active` is tied to the current runtime/boot epoch even when a longer `days` horizon is requested.
- `scope=all` can expose cross-epoch history, so historical retention/access and causal comparability are **different problems**.
- model/surface/task/runtime regimes can change inside one nominal 7/14/30-day window.
- the 2026-08-31 Codex model transition is a natural regime boundary for agent traces that used that surface.

Therefore:

> historical coverage != cohort validity

### Required cohort dimensions

At minimum, evaluate whether the observatory can segment/attribute by:

- model family + observable revision when available;
- caller/surface (`chatgpt-web`, `codex-local`, etc.);
- task/workflow class or stable intent family;
- MSSR route / selected skills;
- runtime epoch / boot id;
- product/harness regime or other known discontinuity;
- outcome, verification, persistence and user-correction status.

### Read-only experiment

Construct a cohort report without changing routing:

1. choose one stable task/intent family with enough samples;
2. compare aggregate pre/post a known regime boundary;
3. compare a fixed-model/fixed-surface cohort across the same boundary;
4. report which apparent aggregate changes disappear after cohort control.

Natural candidate: post-2026-08-31 model-mix change versus traces already using the replacement model before the boundary, **only if the historical data actually supports that segmentation**.

### Falsification / failure condition

This priority is not solved if the UI/report can show `7d/14d/30d` but cannot prove that compared populations share the same relevant regime.

### Done criteria

- historical coverage is reported separately from cohort validity;
- every longitudinal benchmark states actual support window/sample and cohort filters;
- known regime boundaries can be annotated or segmented;
- no trend is presented as causal solely because an aggregate moved.

---

## P0-B — Keep learning observe-only until activation gates are evidence-based and anti-gaming

### Current state / why this matters

MSSR learning has accumulated useful evidence and learning digests, but evidence quantity must not be confused with authority to influence routing.

The safe current stance is still:

- `observeOnly=true`
- `routingInfluence=false`

The longitudinal loop found several confounders that make a premature activation dangerous:

- scorer/metric gaming is possible in agent systems;
- broken or impossible tasks can generate negative outcomes that are not route/model failures;
- a model/surface/task-mix regime change can look like routing improvement/regression;
- easy-to-verify tasks are also likely easier to close, creating selection bias;
- correlated historical evidence is not the same as causal/generalizable evidence.

### Activation gate proposal

Before any `routingInfluence=true`, require evidence for all of these:

1. **anti-gaming:** learner cannot trivially improve the same proxy used to judge it;
2. **held-out/independent signal:** at least one evaluation signal is not directly optimized by the learner;
3. **cohort validity:** comparisons control model/surface/task/regime sufficiently to make attribution meaningful;
4. **task validity:** distinguish impossible/broken/out-of-scope tasks from poor routes;
5. **capability/integrity floor:** route optimization cannot trade away authorization, verification, or other hard invariants for a higher score;
6. **sample diversity:** evidence spans more than one narrow success mode;
7. **human grounding:** user corrections/acceptance remain first-class signals where available.

### Important open causal question

There is observational signal that traces with verification + persistence often finish accepted with `userCorrections=0`, but that is **not yet proof** that verification/persistence causes fewer corrections.

### Read-only experiment

Build matched cohorts of similar task class/difficulty and compare:

- verified + persisted;
- verified but not persisted;
- neither/partial;

Then compare user corrections, accepted outcomes, replan rate and unknown/partial outcomes.

Do not train or alter weights from this experiment.

### Done criteria before activation discussion

- a written activation gate exists in code/docs/tests;
- at least one held-out or independent evaluation path exists;
- task-invalid/impossible cases are not scored as ordinary route failures;
- cohort-aware evidence demonstrates a repeatable benefit without degrading hard invariants;
- activation remains explicit/user-controlled and reversible.

---

## P0-C — Prove authorization persistence and provenance across replan, recovery and remote execution

### Existing owner

Coordinate with `docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md` and current F3 work. Do **not** create a parallel authorization model.

Current state already includes explicit remote principal identity/classification and high-impact authorization work. This handoff adds the longitudinal verification question:

> once an action is denied/deferred/out-of-scope, does that semantic decision remain effective after replan, event replay, transport recovery, runtime recovery and `remote-node` handoff?

### Required invariant

`capability != recommendation != authorization != permission to continue`

A `ready` C2d recommendation must never manufacture authority. A different route to a semantically equivalent operation must not bypass an earlier deny.

### Provenance chain to be reconstructible

Where applicable:

`event/envelope id -> origin -> principal -> delegated authority/scope -> MSSR trace -> host/node -> action -> verification -> outcome`

### Read-only / fixture-first experiment

Use existing events/traces/fixtures where possible before adding runtime behavior:

- locate denied/deferred/high-impact cases;
- follow replans and delegated/remote operations;
- verify there is no semantically equivalent allowed action that escaped the original authority decision;
- for replay/recovery scenarios, verify one logical event maps to one authorized logical outcome.

### Done criteria

- deny/deferred semantics survive replan and handoff;
- recovery/replay cannot silently widen authority;
- remote-node evidence names the acting host/principal and original authority source;
- exactly-once/idempotency behavior is either demonstrated or explicitly bounded/documented;
- violations are observable as evidence, not hidden as generic tool failures.

---

# P1 — Measurement gaps that should be fixed before optimizing their metrics

## P1-A — Recovery reliability: causal taxonomy + impact accounting

Self-healing has worked in real incidents, but `restart_count` or `recovery_count` alone is a misleading reliability metric.

Recent operational history has contained materially different classes, including:

- tunnel-only/connector recovery with no full runtime restart;
- full runtime auto-restart after readiness threshold failure;
- at least one boot where the exposed reason was too weak/ambiguous for confident classification.

### Required event shape

Aim to make every recovery/restart reconstructible with:

- typed cause;
- failure domain (`transport`, `connector`, `runtime`, `remote-node`, external dependency, planned deployment/manual, etc.);
- scope / blast radius;
- requested-by / trigger;
- previous and new boot/runtime identity where applicable;
- MTTR;
- active/affected traces;
- lost, duplicated or retried logical work;
- provenance/outcome impact.

### Important distinction

A planned restart should not count as the same failure class as a readiness watchdog restart. A tunnel-only recovery should not inflate server-failure rate.

### Read-only experiment

Compare bounded windows around known recoveries/restarts and search for:

- orphaned/incomplete traces;
- duplicate actions/outcomes;
- unknown outcomes spike;
- lost host/principal provenance;
- repeated notices caused by replay rather than new work.

### Done criteria

Reliability reports can answer not merely `did it recover?` but `what failed, what was affected, and was logical continuity preserved?`.

---

## P1-B — Closure observability boundary: separate missing closure from unobservable UI closure

The longitudinal loop observed `closure_reminder` cases where Bridge/MSSR can see tools, phases, verification and persistence but **cannot observe the final ChatGPT Web UI render**.

Therefore:

`closure not observed` != `agent definitely failed to close`

### Risk

Optimizing raw closure rate without this distinction can punish successful behavior that is simply beyond the observability boundary.

### Work needed

Introduce/report distinct states if not already available, for example conceptually:

- closure confirmed;
- closure missing despite observable responsibility;
- closure unobservable at host/UI boundary;
- outcome explicitly recorded by host;
- closure unknown.

Do not create synthetic UI evidence from absence.

### Done criteria

Closure metrics no longer mix agent failure with instrumentation blindness, and `closure_reminder` evidence records the relevant observability boundary.

---

## P1-C — Context budget attribution: prove what `budget-exceeded` costs in outcomes

### Existing owner

Coordinate with `docs/skill-routing/HANDOFF_CONTEXT_ECONOMY_PRIORITY.md`. Do not duplicate its selector/priority implementation.

Selective context and budget accounting are already valuable. The missing longitudinal question is different:

> when a relevant context module is excluded with `reason=budget-exceeded`, does that exclusion predict replan, error, evidence loss, user correction or worse outcome?

Keep three concepts separate:

1. discovery — what context/capabilities exist;
2. selection — what is relevant to the task;
3. budget allocation — what relevant material is sacrificed when not everything fits.

### Needed attribution

For each excluded relevant module, preserve enough identity to correlate later with:

- replans;
- errors/retries;
- verification/persistence failure;
- user corrections;
- partial/unknown outcomes;
- later loading of the same module after failure.

### Read-only experiment

Take traces with `budget-exceeded` exclusions and compare against matched traces where the same module/family was available, controlling task class as far as data permits.

### Done criteria

Context savings can be discussed together with outcome cost, not merely chars/tokens saved.

---

## P1-D — Skill/plugin provenance must identify the artifact, not only its name

Mutable/synchronized skill/plugin ecosystems make a stable logical name insufficient for longitudinal attribution.

For evidence and learning statistics, prefer preserving:

- skill/plugin logical name;
- source/repository/authority;
- revision/version when known;
- content hash or equivalent immutable identity;
- load timestamp;
- trace id.

### Why

If `systematic-debugging` changes five times, an aggregate historical success rate for the name alone is ambiguous. Learning needs to know **which artifact actually influenced the decision**.

### Done criteria

Historical traces can distinguish materially different revisions of one skill and can reproduce/prove which revision was loaded where feasible.

---

# P2 — Useful research directions, not immediate blockers

## P2-A — Productive agent cost versus host/context overhead

Do not route by raw price yet.

Observed/known agent cost can include:

- useful reasoning/output;
- tool calls;
- context assembly/retrieval;
- cache misses;
- compaction;
- image/history overhead;
- retries/replans;
- host/UI metadata or coordination overhead.

Before economic routing, try to distinguish productive cost from harness overhead and prefer a future metric closer to:

`cost / accepted outcome`

rather than only `cost / token`.

### Done criteria before price-aware routing

- cost source attribution is good enough to avoid blaming a route/model for host overhead;
- quality/outcome remains a hard input;
- no automatic downgrade solely because a model is cheaper.

---

## P2-B — C2d / Notice Plane calibration

C2d and the Operational Notice Plane have the right durable separation:

`evidence -> diagnosis -> recommendation (ready/deferred)`

and recommendation does not itself authorize action.

The next useful work is evaluation, not another semantic layer:

- do `ready` recommendations correlate with useful/accepted outcomes?
- do `deferred` recommendations correctly identify missing dependencies/evidence?
- how often do recommendations later become invalid after new evidence?
- does a notice preserve identity/provenance across adapters/hosts?

Keep this lower priority than cohort validity and authorization containment because recommendation quality cannot be interpreted cleanly while evaluation cohorts are confounded.

---

# Natural experiments already available

Prefer using these before manufacturing new failure conditions.

## 1. Model-regime boundary around 2026-08-31

Purpose: distinguish MSSR improvement from model/task-mix change.

Compare aggregate pre/post metrics against fixed-model/fixed-surface cohorts where history permits.

## 2. Recovery classes

Purpose: compare logical continuity under:

- tunnel-only recovery;
- full readiness-triggered runtime restart;
- planned/manual/deployment restart if present.

Look for duplicate/lost actions, orphan traces, unknown outcomes and provenance discontinuity.

## 3. Context `budget-exceeded` traces

Purpose: estimate outcome cost of omitted relevant context rather than only context savings.

## 4. Verified/persisted versus correction outcomes

Purpose: test whether verification/persistence predicts fewer user corrections after controlling task class/difficulty.

---

# Do NOT do yet

- Do not set `routingInfluence=true` merely because learning evidence is plentiful or marked ready.
- Do not optimize reliability using raw restart/recovery counts.
- Do not optimize closure until UI/unobservable closure is separated from actual missing closure.
- Do not implement price-only or cheapest-model routing.
- Do not treat aggregate 7/14/30-day movement as causal without cohort support.
- Do not copy MCP roadmap features preemptively when current MSSR contracts already cover the underlying need.
- Do not duplicate the active event-trigger/F3 authorization handoff.
- Do not duplicate the active context-economy implementation handoff.
- Do not weaken `recommendation != authorization` or turn `blocked/deferred/partial` into implicit failure pressure.
- Do not mutate `D:\Dev\project-observer` as part of this MSSR pass merely because it can be stale/degraded; it remains secondary read-only evidence unless separately tasked.

---

# Suggested Codex work order

## Slice 1 — Evaluation substrate (recommended first)

1. inspect current observatory schemas/queries for cohort fields;
2. document exact support of `scope=active` vs `scope=all` and epoch boundaries;
3. add/derive cohort filters needed for model/surface/task/epoch/regime comparison;
4. add tests/fixtures proving that a 7d label cannot silently imply 7d comparable support;
5. produce one cohort-aware read-only report as acceptance evidence.

Why first: almost every later claim (learning improvement, context economy, recommendation quality, cost optimization) depends on trustworthy comparison.

## Slice 2 — Learning activation contract

1. formalize the no-activation gate;
2. define held-out/independent signals and task-validity handling;
3. keep observe-only while generating calibration reports;
4. explicitly include user corrections and capability/integrity floors.

## Slice 3 — Authority/provenance continuation

Work inside/with the existing F3 handoff:

1. deny/deferred persistence under replan;
2. replay/idempotency evidence;
3. remote-node principal/host provenance;
4. recovery continuity;
5. one logical event -> one authorized logical outcome where the contract claims this.

## Slice 4 — Reliability/closure measurement cleanup

1. recovery causal taxonomy and impact accounting;
2. closure observable/unobservable distinction;
3. only then revise reliability/closure dashboards or learning signals.

## Slice 5 — Context-budget outcome attribution

Extend the existing context-economy work with longitudinal attribution, not another selector rewrite.

## Slice 6 — Skill provenance and cost attribution

Treat these as enabling data-quality work after the main evaluation substrate is stable.

---

# Evidence hierarchy for this work

When sources disagree, prefer:

1. live MSSR/Bridge runtime + observatory evidence;
2. direct current repo state/tests/fixtures;
3. current `.mssr/PROJECT_*` authority;
4. specialized handoffs/decision records;
5. recent Project Observer report;
6. historical memory or external analogy.

External research (OpenAI/Anthropic/MCP and similar) is **design evidence/radar, not authority over MSSR**. Useful recurring lessons from that research that fit current MSSR concerns:

- runtime governance must survive a capable agent trying alternate plans;
- impossible/broken tasks need safe exit rather than success pressure;
- independent/held-out evaluation is necessary before self-optimization;
- mutable plugin/skill supply chains make artifact provenance important;
- progressive discovery does not solve budget allocation by itself;
- cost should be attributed at the harness/outcome level, not assumed to be raw model price.

---

# Definition of success for the next MSSR phase

The next maturity step is **not more tools or more autonomous learning**.

A strong result would be that MSSR can answer, with evidence:

- which population a metric actually describes;
- whether compared traces are causally comparable enough for the claim;
- which model/skill/context/runtime regime produced a decision;
- whether an authorization decision survived replan/recovery/remote execution;
- whether a recovery changed logical work, not only runtime health;
- whether excluded context had measurable downstream cost;
- whether a learning recommendation generalizes outside the metric it optimized;
- and whether apparent improvements survive user-correction/held-out checks.

Only after those answers are reliable should active learning/routing influence or cost-aware optimization move up in priority.

---

# Handoff boundary

This document intentionally made **no implementation changes**.

Codex should begin by loading canonical project context, reading the two specialized handoffs referenced above, checking current dirty worktree ownership, and then taking **Slice 1 — Evaluation substrate** unless current repo evidence shows another slice is already actively owned or blocking it.

---

# 2026-09-03 decision update — vNext Lite and clean activation evidence

This update supersedes any interpretation that the next MSSR step should add a second model, embeddings, vector retrieval, or active learned routing. Those remain future research options only.

## What already exists and should be reused

Current MSSR already has several pieces of the proposed direction:

- host-gated optional selection, where an absent optional decision remains `pending` rather than being fabricated as `skipped`;
- deterministic structured intent and routing;
- selective/paged procedural context rather than unconditional full-skill injection;
- privacy-bounded `learning-digest-v1`;
- dataset-quality audit, replay/holdout, calibration and counterfactual shadow evaluation;
- an explicit hard boundary of `observeOnly=true` / `routingInfluence=false`.

Therefore the next pass must not build parallel mechanisms merely because the vocabulary changed. The open problem is **causal usefulness attribution**: determining whether a candidate knowledge unit was actually needed, materialized, applied, and associated with a better or worse task outcome.

## vNext Lite target

Keep the first implementation deterministic and cheap:

`structured state -> candidate retrieval -> activation decision -> context broker -> execution -> evidence ledger`

Optional candidates should be representable with three semantic states:

- `ACCEPT`: enough observable evidence exists to materialize the unit now;
- `WAIT`: plausible candidate, but no current trigger justifies paying its context cost;
- `REJECT`: current evidence says it is not relevant to this task/phase.

Existing `accepted` / `pending` / explicit `skipped` host-gated semantics should be mapped/reused where possible instead of introducing a second incompatible state machine.

A `WAIT` candidate should be reconsidered only after a meaningful observable delta such as `error-observed`, a new artifact, publication intent, tool/provider failure, user correction, phase transition, or another explicit signal. Do not mechanically re-run routing after every successful call.

## Context Broker interpretation

The Context Broker is broader than skill pagination but should initially reuse the same bounded-selection principles. Its job is to decide **what knowledge is allowed into the active working set now**, not to invent new knowledge.

Candidate knowledge may eventually include:

- procedural skills;
- project context/state/memory modules;
- explicit historical trace findings;
- architecture/decision records;
- bounded operational guidance.

This is a future generalization of `state -> relevant knowledge unit`, not authorization to add embeddings or merge all memory authorities today. Canonical ownership, provenance, freshness and evidence class remain explicit.

## Dataset to capture from now on

Treat legacy telemetry as useful diagnostic/observational history but **not as clean causal training evidence** unless a cohort-specific audit proves otherwise.

For new traces, aim to make the following chain reconstructible without storing prompts, transcripts or hidden reasoning:

1. **Situation** — trace/workflow id, caller, model/revision when observable, runtime epoch, project/task class, compact structured intent and signals.
2. **Candidate** — knowledge/skill id, immutable revision/hash when possible, and bounded reason codes for why it became a candidate.
3. **Decision** — `ACCEPT` / `WAIT` / `REJECT` (or the existing compatible host-gated equivalent) plus deterministic reason codes.
4. **Transition** — the observable delta that changed a prior decision, especially `WAIT -> ACCEPT`.
5. **Materialization** — exact core/modules/knowledge units actually loaded plus measured chars/tokens where available.
6. **Application evidence** — bounded observable evidence that the materialized unit affected the execution path; do not infer application merely from selection or load.
7. **Outcome** — verification, persistence when relevant, accepted/partial/failed/skipped outcome, user corrections, replans/retries and task-validity classification.
8. **Cost** — context added, tool/replan churn, compaction or other host overhead when it is genuinely observable.
9. **Provenance** — authority/source plus version/content hash so longitudinal statistics do not collapse different revisions under one logical name.

Desired derived labels include:

- accepted but never applied -> probable false activation;
- loaded large context but never applied -> wasted-context candidate;
- initially waiting then later explicitly needed -> useful delayed activation;
- rejected/skipped then later explicitly requested/needed -> probable missed activation;
- successful comparable task with no optional activation -> baseline evidence, not proof that optional knowledge is useless.

## Shadow-mode experiment before any active learning

The preferred next learning experiment is **not another model judging MSSR**. Run deterministic MSSR prediction in shadow/observe-only mode and compare it against what the host actually ends up requesting or applying during real work.

For optional units:

- record candidates and activation predictions;
- do not let historical learning change routing;
- allow ordinary host-gated/manual materialization during the task;
- compare predicted activation timing against actual later demand and downstream outcome.

This produces a cleaner dataset for precision, false activation, missed activation, delayed activation and context waste without changing user-visible behavior.

## Concrete work order added to this handoff

### Slice 0 — preserve current dirty work ownership

- Finish/review the existing `0.2.58` visual-lifecycle correction separately.
- Do not bundle this vNext/data work into `0.2.58` unless the owner explicitly decides to re-scope that release.
- Do not stage or publish unrelated dirty Bridge or `mauroprime-skills` work from this MSSR pass.

### Slice 1 — define the clean activation-evidence contract

- Inventory which fields are already present in trace events, `learning-digest-v1`, host-gated selection and observatory storage.
- Write a gap table for candidate -> decision -> transition -> materialization -> application -> outcome -> cost -> provenance.
- Prefer extending existing trace/digest contracts over creating a parallel telemetry store.
- Introduce a fresh schema/version/epoch when the evidence shape changes enough that old and new samples are not causally comparable.

### Slice 2 — instrument only; do not change routing quality yet

- Capture the missing evidence fields and deterministic reason codes.
- Add fixtures proving optional `pending/WAIT`, accepted materialization, explicit skip/reject and later signal-driven transition are distinguishable.
- Keep `routingInfluence=false` and automatic promotion disabled.

### Slice 3 — evaluate real usefulness

Measure at minimum:

- optional activation precision;
- probable missed activation rate;
- delayed-activation rate;
- loaded-but-not-applied context;
- context chars per accepted outcome;
- replans/retries/user corrections by comparable cohort;
- outcome/task-validity coverage.

Use the cohort-valid evaluation substrate already prioritized above; do not treat aggregate historical percentages as causal.

### Slice 4 — only after sufficient clean data

Consider whether deterministic rules are enough. Embeddings/vector retrieval, learned ranking, a secondary model judge, or generalized task-selection learning remain **explicitly deferred** until clean-data evidence shows a concrete retrieval/decision problem that simpler rules cannot solve.

## Generalization direction

If the evidence contract works for skills, design identifiers generically enough that the same activation ledger can later describe project-memory/context/decision units and, eventually, task-selection candidates. The immediate objective is not to build a world model; it is to preserve enough structured evidence that future systems can learn **which knowledge or action became useful in which observable situation**.

## Success question

Before calling MSSR routing/learning valuable, the system should be able to answer for a representative task:

> Did MSSR materially help this task, or was it merely present?

That answer must be based on observable candidate/decision/use/outcome evidence, not on the fact that a skill was recommended or loaded.


## External research radar

A dedicated research note now maps this direction against current external work without promoting any dependency or architecture by default:

- `docs/RESEARCH_AGENT_MEMORY_SELECTION_RADAR_2026-09-03.md`

Key comparison families: Letta/MemGPT and Self-RAG (main-model-controlled memory/retrieval), Adaptive-RAG and Memory-R1 (learned retrieval/memory controllers), Graphiti/HippoRAG/A-MEM/Mem0 (relational/temporal/hybrid memory), Titans (model-integrated neural memory), and LongMemEval-V2 (environment/workflow memory evaluation). Treat these as design evidence and benchmark inspiration; vNext Lite remains deterministic/host-gated until the clean activation dataset demonstrates a concrete need for more complexity.
