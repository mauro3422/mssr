# ADR 0006 — Deterministic semantic consistency over the Situation Model

Status: accepted direction; implementation is active. MSSR `0.2.71` ships Gate A plus the first bounded Gate B-D vertical slice; later relationship/extractor/producer/host-adoption gates remain open.

## Context

MSSR already owns several pieces of the consistency problem, but they currently cover different evidence classes:

- Document Freshness can prove that an explicitly current-state document is review-due because a declared dependency has a newer observed revision. It does not interpret prose.
- The revision-based Situation Model can compare canonical project-knowledge revisions with selected/delivered historical receipts and detect stale current-operation evidence.
- C2c compares bounded semantic claim keys using explicit authority roles and current values/revisions.
- C2d ranks evidence-first recovery recommendations without authorizing execution.
- C2e-D defines strict structured semantic claims for release version, state value, ownership and decision revision.
- Architecture Impact owns declared architecture relationships and optional structural evidence.
- Project-knowledge maintenance currently still contains broad path/name heuristics that can over-classify semantics.

The remaining class is broader but should not be solved by adding a second contradiction engine or by asking a generative model to reread every document after every change. The recurring failures are usually narrower:

1. two current authorities disagree on a bounded fact;
2. a summary/status/roadmap describes an older state than the authority it summarizes;
3. a contract exists but its producer, consumer or host-adoption edge is missing;
4. two documents refer to the same subject with mutually exclusive state/version/owner claims;
5. a lexical/path heuristic mistakes topical similarity for semantic ownership.

Similarity is useful for discovering candidate relationships. It is not proof of agreement or contradiction. Two statements that differ only in `0.2.65` versus `0.2.66` can be near-identical under lexical/vector similarity while disagreeing on the one scalar that matters.

## Decision

Extend the existing Situation Model/C2c/C2d pipeline with a deterministic semantic-consistency layer. Do not create a parallel semantic owner.

```text
repository/runtime evidence
        |
        v
[declared authority + relationship graph]
        |
        +--> deterministic claim extractors
        |         |
        |         v
        |    typed Claim IR
        |         |
        +--> candidate retrieval --------------------+
        |      exact refs / subject keys             |
        |      lexical / structural retrieval        |
        |      optional vector neighbors             |
        |                                            v
        +--------------------------------> deterministic pair evaluator
                                                   |
                               +-------------------+------------------+
                               |                   |                  |
                            PROVEN              REVIEW             ABSTAIN
                               |                   |                  |
                               v                   v                  v
                         Situation/C2c       bounded candidate     no claim
                               |
                               v
                              C2d
                               |
                               v
                    Operational Notice / Context Plane
```

The new layer produces evidence for existing owners. It never writes project truth, routing, skills, ADRs, roadmaps or changelogs automatically.

## 1. Declared authority and relationship graph

The repository should increasingly express relationships that are currently reconstructed from directory names or prose. Relationships are typed and directional, for example:

- `summarizes`
- `depends-on`
- `implements`
- `adopts`
- `supersedes`
- `mirrors`
- `documents`
- `tests`
- `produces`
- `consumes`

A relation identifies stable subjects/refs and an owner. It may be declared in an existing owning manifest when that manifest already has the right semantics; avoid creating one universal metadata file merely for convenience.

Derived lexical/import/vector relationships remain candidates. They cannot silently become declared ownership edges.

This graph is also the preferred fix for broad path heuristics: `docs/skill-routing/INCIDENTS.md` may be topically related to routing while still being typed as documentation rather than a routing-contract authority.

## 2. Typed Claim IR

C2e-D is the starting point, not a discarded prototype. Generalize only when evidence proves another bounded claim kind is needed.

A normalized claim needs enough identity to compare without carrying arbitrary prose:

```text
subject        stable comparable identity
kind/predicate bounded semantic kind
value/revision optional comparable scalar
state/polarity optional bounded state
scope          repository/host/component/architecture identity
validity       current, historical, superseded, or unknown
sourceRef      exact evidence ref
owner          canonical semantic owner
role           canonical, replica, historical
observedAt     host evidence time when applicable
extractor      declared/structured/rule/derived
confidence     evidence tier, not truth probability
```

Existing `release-version`, `state-value`, `ownership`, and `decision-revision` remain first-class. Candidate additions must have explicit comparison semantics rather than a generic free-text `claim` bucket.

## 3. Deterministic extractors first

Extraction should prefer sources where the semantic structure is already present:

1. JSON/frontmatter/package fields, schemas, receipts and manifests;
2. version/date/hash/PID/build/runtime identifiers;
3. checked roadmap gates and stable IDs/anchors;
4. changelog contract fields and PROJECT_* status metadata;
5. exact headings/bullets with a declared extractor contract;
6. bounded state vocabulary such as `pending`, `closed`, `active`, `deprecated`, `resolved`, `future`, when attached to a proven subject;
7. token/lemma/dependency rules only for narrowly specified sentence forms.

An extractor must emit provenance and an `extractionClass`. Failure to prove the subject/value relationship is `unknown`, not an invitation to guess.

Over time, frequently compared prose should move toward explicit machine-readable sidecars/frontmatter/anchors so less NLP is necessary.

## 4. Candidate retrieval is separate from contradiction evaluation

Candidate retrieval reduces the pairwise search space. It may combine, in descending authority:

1. declared relation edges;
2. same normalized subject + claim kind;
3. exact refs/anchors/symbols/identifiers;
4. lexical retrieval such as BM25/TF-IDF over bounded sections;
5. structural/topic tags;
6. optional local embeddings/vector neighbors;
7. duplicate/near-duplicate fingerprints such as MinHash only where useful.

Retrieval scores are never truth scores. A high lexical/vector score may only say “compare these two things”.

## 5. Deterministic contradiction rules

The evaluator operates on compatible typed claims, not raw document similarity. Initial rules should include:

- same subject + same scalar kind + overlapping current scope + unequal scalar value;
- same subject + mutually exclusive bounded states (`pending` vs `closed`, `enabled` vs `disabled`, etc.);
- release/version ordering conflicts when a current summary claims an older active version than an observed canonical/runtime version;
- ownership mismatch for the same semantic component;
- decision revision mismatch where one current replica claims an obsolete revision;
- current-vs-historical handling so truthful historical release notes do not become false contradictions;
- supersession handling so an explicitly replaced claim does not remain current attention;
- producer/consumer/adoption coverage constraints for contracts that declare lifecycle completeness.

Rules must include scope and temporal compatibility. `A was pending in August` and `A is closed in September` are not contradictory merely because the state differs.

## 6. Evidence tiers and abstention

The layer reports evidence classes, not a single opaque confidence number:

- **PROVEN** — structured comparable facts violate a deterministic rule. May enter Situation/C2c as current contradiction evidence.
- **STRONG-REVIEW** — deterministic extraction identifies the same subject and mutually exclusive semantics but one relation/authority edge still requires review.
- **CANDIDATE** — lexical/vector/graph-derived retrieval says two pieces are related but the contradiction itself is not proven. Quiet review queue only.
- **UNKNOWN/ABSTAIN** — insufficient comparable evidence; no contradiction claim.

Automatic user-facing attention should be driven mainly by PROVEN evidence and selected STRONG-REVIEW cases. Candidate generation must not become notice spam.

## 7. Optional model boundary

A model is optional and late in the pipeline.

A small NLI/cross-encoder or other classifier may later run in shadow mode only on unresolved candidate pairs. Its output is `derived` evidence and cannot override canonical structured evidence or directly authorize a notice/write. A generative LLM is not required for normal operation.

Any learned/model path requires a frozen benchmark, false-positive/false-negative measurement, calibration/abstention, versioned model identity and instant disable/rollback. Until then deterministic extraction and constraints remain the active path.

## 8. Context Message integration

The existing Context Message vocabulary should gain explicit producer coverage rather than another transport. Examples:

- proven current roadmap/status conflict -> `roadmap-contradiction`;
- referenced owner/subject cannot be resolved -> `unresolved-reference`;
- delivered evidence is revision-stale -> existing `stale-context` path;
- lifecycle continuation evidence -> `continuation` when an owning producer exists.

Message production is downstream of evidence classification. A reserved kind with no producer remains explicitly `reserved`/`host-supplied`, not implicitly “implemented”.

## 9. Coverage/adoption truth

Every portable subsystem should expose a machine-auditable capability matrix with separate states for:

```text
contract/schema
pure evaluator
producer(s)
consumer(s)
fixtures/tests
public export
native host
Codex host
OpenCode host
Bridge source
Bridge packaged version
live runtime adoption
```

A changelog may call the portable contract complete while the matrix still shows host adoption pending. Roadmaps and current-state docs must not collapse those two meanings into one checkbox.

This matrix directly addresses the class represented by C2e-D semantic claims and Document Freshness 0.2.66: implemented/tested/exported is not the same fact as produced/consumed/live.

## 10. Initial implementation gates

### Gate A — integration coverage inventory

**Status: complete in portable source.** The read-only inventory classifies selected portable capabilities and Context Message edges as `implemented`, `host-supplied`, `reserved`, `pending-adoption`, or `unresolved`. It distinguishes source-complete/test-only/export-only contracts without labeling every missing edge a bug, and specifically records `roadmap-contradiction` / `unresolved-reference` as reserved producer gaps until real wiring exists.

### Gate B — typed relationship/claim registry

**Status: partial.** The first slice extends existing C2e-D claims with explicit scope, temporal validity, observation time, and extractor provenance while preserving the existing semantic key for the default project scope. A reusable typed relation/edge registry is still open; do not introduce a duplicate global manifest merely to complete this gate.

### Gate C — deterministic extractors

**Status: partial.** Narrow deterministic extractors exist for the repository's explicit `R<n>` ROADMAP checklist state and machine-readable `mssr-state` markers. They abstain from surrounding prose and fail closed on ambiguous duplicate declarations. Broader version/owner/gate/decision extractors remain open.

### Gate D — pair evaluator

**Status: partial.** The first evaluator resolves explicit temporal validity before the current-truth comparison: `historical` and `superseded` claims retain provenance but do not create repeated current mismatch noise; distinct scopes remain isolated; current comparable claims feed the existing Situation Model/C2c path. Exact current value/revision and canonical conflicts can be `PROVEN`; unavailable/incomplete current evidence remains review evidence. Broader relation-aware pair rules remain open.

### Gate E — candidate retrieval

Add lexical/structural candidate retrieval only after exact relationships/subjects. Benchmark BM25/TF-IDF first. Optional embeddings are secondary retrieval evidence, never contradiction authority.

### Gate F — Context Message producers

Connect proven evidence to existing message kinds, starting with `roadmap-contradiction` and `unresolved-reference`, with transition/dedupe/noise tests.

### Gate G — host adoption and longitudinal QA

Wire native/Codex/OpenCode/Bridge deliberately and separately. Track precision, recall over seeded/real incidents, abstention rate, noise per material change, context cost and host parity.

### Gate H — optional semantic-model shadow experiment

Only after deterministic baseline data exists, compare a bounded local NLI/cross-encoder path on the candidate set. Keep `routingInfluence=false`, `canonicalRewriteAllowed=false`, and no direct notice authority until independently justified.

## Consequences

- Existing MSSR consistency architecture becomes more useful instead of being duplicated.
- Most high-value contradictions can move from prose reasoning into typed facts and deterministic constraints.
- Semantic/vector methods are still useful, but primarily for candidate discovery and ambiguity reduction.
- False positives become attributable to extractor/relation/rule/retrieval stages rather than one opaque “AI judgment”.
- The system can improve skills, project context, ADRs, current-state docs, changelogs and future automation using the same evidence model.
- Some genuinely free-form contradictions will still require human/model review; the correct deterministic behavior there is abstention.

## Non-goals

- semantic rewrite of arbitrary prose;
- automatic canonical edits from a contradiction detector;
- treating similarity as contradiction;
- making embeddings/NLI/LLMs mandatory MSSR runtime dependencies;
- replacing explicit ownership, Architecture Impact, C2c/C2d, Context Plane or Operational Notice Plane;
- hiding host-adoption gaps behind source-level tests.
