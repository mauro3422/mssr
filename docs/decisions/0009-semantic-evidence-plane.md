# ADR 0009 — Semantic Evidence Plane and portable semantic triage

- Status: accepted as architecture and staged-roadmap direction
- Date: 2026-09-29
- Owner: portable MSSR
- Runtime implementation: staged; this ADR does not claim host parity or Jev extraction is complete

## Context

MSSR already has the Context Plane, Context Economy, trace/lifecycle telemetry, the Situation Model, Operational Notices, Semantic Experience, project-document discovery and exact-section segmentation. Bridge and other hosts additionally observe tool calls, runtime health, filesystem/Git revisions and provider state. Visual systems such as QuietDesk can produce bounded screenshot/region evidence and can use Jev as a decision model.

The remaining problem is not lack of data. The problem is that useful observable evidence is split across several schemas and surfaces, large Markdown documents are often too coarse to load as one unit, and semantic classifiers are currently attached to particular experiments rather than exposed as a portable MSSR capability.

MSSR therefore needs one portable evidence/attention layer that can answer:

- what evidence existed for a task or subject;
- what was considered, selected, skipped, deduplicated, classified or never consumed;
- what exact source/revision/section proves an observation;
- what later verification or outcome supported or contradicted it;
- which evidence should become context, a Notice, an audit candidate, a learning shadow, a persistence proposal, or nothing.

This is work/project memory and operational evidence, not a replacement for ChatGPT conversation memory. Raw conversations, prompts and private reasoning remain outside the plane.

## Decision

Define the **Semantic Evidence Plane** as an additive portable MSSR contract above existing evidence producers. It does not replace their canonical stores. It normalizes bounded references into a common evidence identity, provides deterministic reduction and section-level retrieval, allows optional semantic triage such as Jev, and records selection/use/outcome lineage.

### 1. Common evidence atom

The portable unit is an `EvidenceAtom`. `EvidenceAtom v2` is implemented as a strict bounded schema and preserves at least the following classes of fields when observable:

```text
identity
  id / kind / subject
  project / traceId / workflowKey / taskKey

source
  sourceClass / sourceRef / canonicalOwner
  provenance / observedAt / freshness
  revision or content hash
  optional heading path + exact line/byte span

semantics
  bounded tags/signals/reason codes
  severity/priority when produced by the owning source
  confidence/margin only when the producer actually supplies them

lineage
  dedupeKey
  related atom/evidence refs
  classifier/provider/contract version when applicable
  selected / skipped / dropped / consumed / later-outcome state

boundaries
  authority class
  privacy class
  candidate destinations
```

An atom is normally a pointer plus bounded metadata, not a copy of the source body. A trace is not project truth; a heading index is not canonical authority; a model label is not verification.

`EvidenceAtom v2` derives a stable content-addressed id from subject + normalized source/revision + provenance + fingerprints + dedupe identity. Semantic reason codes, usage state and small attributes are deliberately non-identity metadata so later selection/outcome observations do not rewrite the atom's stable identity. Exact heading/range refs require a source revision. A `fresh` label additionally requires a caller-supplied observation assertion matching canonical owner, normalized ref and revision with an observation timestamp; validation checks consistency only and does not authenticate the host or independently prove the observation occurred. Sensitive-excluded atoms and free-form attribute strings are rejected. Projection from a Librarian catalog record carries only compact refs/fingerprints plus explicitly selected primitive attributes; it never copies the full Librarian metadata payload.

### 2. Human-readable authority remains Markdown; high-volume evidence is structured

`AGENTS.md`, PROJECT_*, ADRs, skills, references and project documentation remain human-readable repository-owned sources. The Semantic Evidence Plane must not convert high-volume runtime observations into thousands of Markdown files.

Portable MSSR owns schemas and pure selection/evaluation semantics. Hosts may persist reconstructable atoms/indexes in ignored runtime storage such as SQLite/JSONL/content-addressed files under `.mssr/runtime/` or an equivalent host store. The storage engine is not portable semantic authority.

A global workspace projection such as `D:\Dev\.mssr\runtime\...` may aggregate cross-project evidence for discovery and maintenance, but remains reconstructable and non-authoritative. Each atom keeps the original project/source owner.

### 3. Hierarchical Markdown and skill indexing

Large Markdown must be retrievable progressively rather than loaded whole by default.

For eligible `.md` sources, a host may derive a revision-bound section index from the heading tree (`H1..H6`) plus exact source ranges. A section identity is bound to source revision/hash and heading path. The derived index is candidate retrieval evidence; it does not promote an unowned document into project authority.

The default progressive path is:

```text
source metadata
  -> H1 / top-level heading inventory
  -> relevant H2/H3 branches
  -> exact section body
  -> neighboring/deeper section only when required
```

Cheap deterministic signals should run before semantic inference: declared authority/selectors, exact refs, changed revision, heading/title match, canonical tags, task signature, freshness, duplicates and known required applicability. A high-priority document may justify inspecting its top-level heading inventory before deciding whether any body section is needed.

Explicit repository declarations remain stronger than derived indexing. Existing `project-context.json`, exact section selectors, `context-modules.json`, `requiredWhen`, manually reviewed segments and source ownership continue to define authoritative applicability where declared. The section index generalizes progressive retrieval; it does not silently rewrite those declarations.

Skills follow the same principle. `SKILL.md` remains the routed entry point, but detailed procedure should be selectable as bounded internal modules/sections instead of forcing the entire manual into context. Existing `context-modules.json` is the preferred explicit contract; derived heading indexes may assist discovery/review and identify monolithic skills that should be modularized, but do not invent permanent routing semantics.

### 3.1 Document Surface and the Librarian contract

The first implementation slice names two separate layers so retrieval mechanics are not confused with semantic judgement:

- **Document Surface** is the portable technical primitive for a revision-bound Markdown source. It exposes bounded metadata only: normalized revision, line/character/byte counts, an H1-H6 hierarchy, exact section/block ranges, short hints/terms and fingerprints. Exact bodies remain in the owning source and are materialized only through a revision check.

`document-context` is the first existing Markdown consumer migrated onto this primitive. It builds one Document Surface per assembly and reuses it for core/module extraction; exact selector lookup remains first-match for duplicate headings while fenced heading-like text is excluded by the shared Markdown parser. This is a compatibility slice, not permission to mass-migrate Project Context or skill loaders without their own baseline/tests.
- **Project Context librarian metadata** (0.2.101) is an opt-in, separate `.mssr/project-context-librarian.json` sidecar. A declaration binds one core/module `entryId`, the source path derived from that canonical entry, one full heading path and an expected current-range fingerprint. It declares its own closed-vocabulary tags; module routing selectors are never inherited. MSSR rejects or omits unknown owners, path drift, non-Markdown sources, directives, indirect segment/reference sources, out-of-scope `source.sections`, missing/ambiguous headings and stale fingerprints. Encoded EvidenceAtom attributes stay within the existing 120-character bound. Current bytes are reparsed into Document Surface on each projection; generated EvidenceAtom/catalog records must agree on owner, source ref, revision, range and fingerprint. The sidecar does not change context selection, the strict project-context v1 schema, or authority; tags remain advisory and host ownership is caller-asserted. Older hosts may ignore it. Full schema and projection rules are in `docs/PROJECT_CONTEXT.md`.
- **Librarian** is the transversal advisory catalog/ingress role above evidence producers. A producer crossing this boundary declares at least a namespace/kind, stable identity, source ref, optional revision/payload fingerprint, bounded normalized metadata and provenance. The Librarian does not become the canonical owner of that data.

The deterministic Librarian reducer handles equality/collision classes before any semantic model call. Initial structural classes are `exact-record`, `same-source-revision`, `same-payload`, `same-metadata` and `identity-collision`. These are fingerprint/contract facts and therefore explicitly report `jevRequired=false`. An identity collision is surfaced for owner review; it is never silently resolved.

The explicit Jev selector may either offer supplied heading sections or consume up to 100 exact handles from a preceding Librarian search. Each supplied handle is checked against the same explicitly supplied owner/source Markdown snapshot, privacy classification, revision, range and fingerprint before its bounded query-focused excerpt is sent to Jev. Only ranges that the exact fetch API can return in full (currently at most 20,000 UTF-16 code units) are offered; search still reports larger ranges as candidates with their fetchability, while Jev selection omits them and reports the counts. If none are fetchable, selection returns `not-run` without a provider call; it does not truncate the range or mislabel this condition as Jev abstention. The selector returns the existing exact handle; the host still performs the normal exact fetch. This lets semantic selection use a search hit deeper in a section without turning lexical retrieval into truth or giving the model source access. Omitting handles preserves heading enumeration for existing callers, subject to the same exact-fetch bound.

MSSR 0.2.102 adds `mssr_librarian_evidence_pack` as a read-only composition boundary after selection. The host supplies current Markdown snapshots and up to 16 exact handles; MSSR re-fetches each range and returns its unchanged text with owner, source, revision, line range, fingerprint and handle citation. The pack is capped at 4,000,000 input Markdown characters and 80,000 fetched characters; duplicate handles, ambiguous source identities, stale ranges and privacy-excluded inputs fail closed. It does not call Jev, generate prose, reconstruct paragraph structure, establish truth or write sources. The host may compose repeated Jev selection, evidence-pack acquisition, a separate lossless structure-recovery pass or prose generator, citation checks and review; these remain independently owned stages.

Jev or another semantic classifier is relevant only after deterministic normalization when different fingerprints may still express a meaningful relation such as semantic duplication, overlap, support, contradiction or supersession. Semantic similarity never upgrades itself into canonical equality or authority.

This creates a useful system-wide invariant: when traces, skills, documents, notices, tools, manifests, outcomes or other producers are progressively adapted through the same ingress contract, MSSR can audit duplicate metadata and representation aliases across subsystems without asking Jev. Until a producer is actually instrumented, the Librarian must report that coverage gap rather than imply that no duplicate exists.

### 3.2 Producer coverage and negative-claim safety

Librarian coverage is itself a portable deterministic contract. Every expected producer family declares its canonical owner, stable identity rule, authority/privacy/retention class, what its evidence can and cannot prove, whether it is `required`, `conditional` or `optional`, and an ingress status of `instrumented`, `partial`, `missing` or `not-applicable`.

Coverage gaps are typed advisory evidence. A required missing/partial producer is stronger attention than an optional one, but no gap authorizes an adapter rewrite or source mutation. An `instrumented` declaration must identify its adapter; a required producer cannot hide behind `not-applicable`.

Most importantly, negative claims are scope-bound:

```text
no matching atom / no duplicate found
  + complete coverage for evaluated scope
    -> valid negative result for that scope

no matching atom / no duplicate found
  + missing or partial producer coverage
    -> incomplete observation; preserve coverage warning
```

Therefore `missing instrumentation != evidence of absence`. Global claims such as “there are no duplicate metadata records in MSSR/Bridge” remain invalid until global producer coverage is complete. The same rule applies to narrower required scopes. This coverage evaluation is deterministic and does not require Jev.

Producer adoption is deliberately incremental. `trace-lifecycle-outcome`, `route-replan`, `skill-selection-load`, context assembly/selection, notices, Semantic Experience and Situation/consistency each consume only their existing bounded structured contracts rather than raw working memory. `project-manifests` validates ten current portable repository manifest families with their owning strict schemas, fingerprints the full normalized declaration and individual entries, and retains only structural metadata while stripping free-form declaration prose; runtime adoption and current filesystem state remain separate host evidence. `explicit-corrections-verifiers` closes the required coverage set with a strict typed verification contract: evidence carries proposal/verifier provenance, a stable verification id and bounded evidence reference; same-provider/same-trace observations remain visible but cannot count as independent truth, exact retries dedupe, and identity reuse with conflicting evidence fails closed. `host-tool-runtime-metrics` now has a portable strict adapter for host-supplied `tool-call`, `runtime-generation`, `runtime-health` and `metric` observations. It retains bounded correlation, timing/result-code/health metadata and fingerprints only; raw arguments/results, free-form error messages, prompts/transcripts and host storage paths are schema-invalid. Portable contract availability is only `partial` global coverage: a real host becomes `instrumented` solely through an explicit tested host-scoped declaration. Required producer coverage is complete; global coverage remains incomplete because host-runtime and Git/filesystem coverage are partial and visual-QA remains a conditional missing capability. A producer changes to globally/host-scoped `instrumented` only when the corresponding explicit adapter/adoption and regression coverage exist.

### 4. Reduction, batching and semantic triage

The plane is intentionally layered:

```text
raw observable events/sources
  -> normalize to candidate atoms
  -> deterministic cheap reduction
  -> dedupe/freshness/revision collapse
  -> subject/state grouping
  -> optional semantic triage
  -> policy/destination
  -> later consumption + verification/outcome feedback
```

Deterministic reduction should remove exact duplicates, superseded runtime revisions, known noise and already-satisfied receipts before spending model calls. It must preserve reason codes for dropped/deferred atoms so later audits can distinguish `never observed`, `filtered`, `not selected`, `selected`, and `actually consumed`.

Semantic jobs are grouped by **one subject and one compatible state**. Independent subjects stay independent jobs and may execute concurrently under bounded `maxConcurrency`, call/token budgets, timeout/failure budgets, cache/dedupe and circuit breaking. Several heads over the exact same subject/state may share one model call. Distinct targets must not be packed into one semantic state merely to save requests unless a benchmark proves calibration is preserved.

### 5. Jev becomes a portable optional classifier, not a QuietDesk dependency

Jev semantic decision contracts belong in portable MSSR, while provider credentials, HTTP transport, retry policy and host process/runtime remain host-owned. QuietDesk is a future visual evidence producer/executor and may call the same portable classifier; MSSR must not depend on QuietDesk.

The portable Jev role is bounded semantic triage over caller-built candidates, for example:

- relevance / novelty / likely destination;
- relation or overlap review;
- priority / audit-worthiness;
- `select`, `skip`, `review`, `abstain` among explicit candidates;
- whether evidence is sufficient or should escalate to a larger model/verifier.

Jev never establishes source authority, permission, canonical truth, destructive action, or verification. Output is typed observation with provider/model/contract identity and confidence/margin when available.
### 5.1 Progressive evidence acquisition: classifiers may request bounded observations

A semantic classifier may return `needs-more-evidence` instead of forcing a low-confidence label. The response may include only typed acquisition requests over evidence handles already exposed by the host, for example:

- `inspect-heading-index` for the H1/H2/H3 inventory of one revision-bound Markdown source;
- `read-section` for one exact heading path;
- `read-neighbor-section` or `read-exact-range` for a bounded adjacent source range;
- `compare-revision` for current-vs-prior metadata/evidence;
- `fetch-related-atom` for an already-linked evidence identity;
- `request-verifier` when semantic judgement needs independent evidence;
- `abstain` when the budget or evidence contract is insufficient.

This is a data-observation action loop, not generic tool agency. The classifier does not receive arbitrary filesystem paths, shell execution, write tools or permission to widen its own candidate universe. The host validates every request against the current source owner, revision, privacy policy and normal authorization boundary.

Every evidence-acquisition episode has hard budgets: maximum rounds/depth, sections/ranges, characters/tokens, related atoms, provider calls, elapsed time and failure count. Repeated requests dedupe by stable source revision plus section/range identity. Several compatible section requests may be coalesced into one host read and one semantic batch when their subject/state is still identical.

```text
metadata / atom shortlist
  -> classifier requests H1/H2 inventory
  -> host returns bounded heading tree
  -> classifier requests section X + sibling Y
  -> host returns exact revision-bound ranges
  -> classifier selects / skips / reviews / abstains
```

The acquisition trace records requested-versus-returned evidence, cost/depth, stop reason and later usefulness when objective feedback exists. These episodes may become Semantic Experience shadows so MSSR can eventually distill deterministic rules such as “for this verified state, heading metadata is enough” or “inspect section X before deciding”. The same provider cannot self-confirm that its own request was useful.


### 6. Destinations are explicit and separate from classification

A policy layer, not the classifier itself, chooses among bounded destinations such as:

```text
ignore / retain-shadow
context-candidate
notice-candidate
audit-candidate
semantic-experience
project-knowledge persistence proposal
skill/routing maintenance candidate
verification request
```

A Notice remains attention, not truth or permission. A persistence proposal remains review-only. Project/skill/routing owners retain their existing write and verification gates.

### 7. Used and unused evidence are both measurable

The evidence lifecycle must preserve the funnel:

```text
ingested -> eligible -> deduped -> grouped -> classified
         -> selected/skipped -> delivered -> consumed/application evidence
         -> verifier/outcome/correction when later observable
```

This enables a counterfactual/missed-evidence audit over atoms that were available but not selected. A bounded Jev or other classifier may periodically review such atoms against later objective outcomes to propose `missed-relevance`, `correct-skip`, `ambiguous` or similar shadows. This is diagnostic evidence only; the same classifier may not self-confirm its own decision.

### 8. Learning starts in shadow and can distill deterministic rules only after independent evidence

Semantic Experience remains the learning boundary. Reducer/selector decisions, classifier labels, section selections, skips and counterfactual sweeps may become shadow experiences with exact provenance and decision-version identity.

Promotion to a deterministic fast path requires a versioned decision-family benchmark with independent verification, project-held-out evaluation, minimum support/coverage, calibration/abstention and zero or explicitly bounded wrong-decision tolerance according to the decision's risk. Existing Semantic Experience promotion invariants are the baseline safety posture; a new family may be stricter but not silently weaker.

Until promotion, deterministic rules remain authoritative for hard gates and semantic inference remains advisory. After promotion, the learned artifact is still a bounded fallback/ranker rule, never a permission or canonical-write rule.

### 9. Coverage and queryability are first-class

The system must expose a read-only query/coverage surface capable of answering by trace, project, subject, source, classifier, batch and destination. The planned host-facing surface is conceptually `mssr_evidence_query` with views such as:

```text
status / recent / trace / project / subject / source
classifier / batch / destination
unconsumed / dropped / gaps
```

`gaps` reports producer classes with missing/partial instrumentation so absence of evidence is not confused with evidence of absence. Queries return bounded metadata and references; full source bodies are fetched separately from their owner only when needed.

## Initial producer map

The first inventory should cover, without requiring one storage format:

- MSSR route intent, normalization/correction, route plans and replans;
- project-context/module selection and Context Messages/receipts;
- skill recommendation, host decision, load, redundancy/domain feedback;
- context assembly/paging/retention decisions;
- lifecycle checkpoints, verification, persistence, outcome and learning digest;
- Semantic Experience proposals and independent feedback;
- Operational Notices, Situation/consistency/architecture-impact findings;
- Bridge/host tool metrics, failures, latency, routing status and runtime/provider health;
- filesystem/Git/document revisions and declared project authorities;
- visual/QA evidence producers such as QuietDesk, without importing their executor ownership;
- explicit user/host corrections and later verification evidence.

Every producer class must declare what it can prove, what it cannot prove, retention/privacy rules and whether the source is canonical, observed, inferred or learned.

## Implementation status update — 2026-09-30

EvidenceAtom v2 and the injectable Jev decision-provider contract exist in portable source. The Jev seam applies to semantic curation, batching, Project Context ref split and baseline verification; TypeSafe remains a deprecated compatibility fallback. MSSR now also exposes MCP tools for bounded search/fetch over documents supplied by the owning host, batched relation questions through Jev, typed content-addressed judgments bound to exact atom/source revisions, and reversible exact-text synthesis previews. Disjoint evidence-graph components use separate Jev requests; connected pairs may share a bounded request. The relation tool records selected-option confidence and leaves returned class distributions null when Jev does not provide them. The preview admits comparable, caller-supplied independent-confirmation support/duplicate candidates; its verification and freshness assertions are not authenticated by MSSR, and the host must re-read current source revisions before consuming a candidate. Contradiction, non-fresh/missing scope or time, opaque/mismatched payload fingerprints and unverified decisions stay review-only or separate. Unknown freshness explicitly blocks candidacy. The default raw-confidence gate is exploratory and explicitly uncalibrated; no canonical apply/write path is exposed.

These tools create an explicit bounded host-supplied Librarian-to-Jev loop, but not a global filesystem/index provider or autonomous source scan, and no live provider benchmark is claimed in this release. Owner, privacy and catalog provenance remain host assertions; they do not authenticate an owner or producer. The host still owns retrieval authorization, Jev credentials/transport, policy, execution, independent verification and any write. The Librarian ingress rejects common free-form/private-content keys and oversized strings, while every adapter remains responsible for its own typed privacy projection. Controlled historical benchmark results remain immutable; future-run rules are in `experiments/CONTROLLED_RUN_PROTOCOL.md`.

## Implementation status update — 2026-10-02

MSSR `0.2.98` adds optional EvidenceAtom-backed metadata matching to caller-supplied Librarian search. The search projection accepts only closed-vocabulary fields and requires the exact owner/privacy/source/revision/range/offset/payload binding plus its matching catalog record; it returns bounded match provenance and never copies full atoms or arbitrary catalog metadata. Legacy document-level `searchableMetadata` remains separate. Range and subject indexes keep matching work bounded. These atoms and catalog records are not automatically delivered by current Bridge/adapters, so this is a portable contract, not host adoption or a global index.

Declared freshness values such as `stale`, `historical`, and `superseded` remain searchable and filterable to support review. They do not affect rank or make a result current; result provenance explicitly shows atom-backed fields that satisfied metadata filters. Search remains advisory, and a later exact fetch must still validate the handle against the caller-provided source revision.

Current TypeSafe documentation demonstrates the larger composed capability: Jev may decide line joins and block structure while deterministic code preserves the source words and renders paragraphs/Markdown; their reranking recipe puts Jev after a BM25 shortlist. The provider's cookbook measurements are not MSSR replications. A 2026-10-02 live smoke over current MSSR architecture docs selected the same exact section in Spanish and English and in a narrower Spanish rerun; raw confidence ranged 0.49–0.79. No independent labels or identical candidate set across all calls were used. One separate fetch returned stale; a same-snapshot re-selection/fetch passed. This is consistency and fetch-path evidence only, not accuracy or calibration, and did not exercise EvidenceAtom search projection. The run is preserved under `experiments/jev-mssr-live/runs/mssr-librarian-real-doc-bilingual-confidence-smoke-20261002T155515Z-v1/`.

## Implementation status update — 2026-10-06

Deterministic Librarian search interleaves source documents only inside equal-score, equal-fetchability groups. MSSR 0.2.113 keeps query-index precedence, then ranks exact-fetchable ranges before oversized ranges, and uses lexical score within each fetchability group. This reduces top-k slots spent on handles that Jev and exact fetch cannot consume; it does not make fetchability a relevance or truth label. Exact handles, source authority, metadata behavior, and Jev invocation are unchanged.

On a local counterfactual replay of the frozen 42-document multirepo corpus, applying that order to the same two-shard top-10 searches changed strict source+heading target recall from 14/20 to 15/20 while source-level recall stayed 16/20; oversized handles in the 400 returned slots fell from 42 to 2. The frozen labels are independently audited but not owner-adjudicated, and this replay is neither a new holdout nor confidence calibration. Details and input hashes are recorded in the Librarian integration handoff and external calibration artifact.

The earlier 36-query exploratory bilingual development run over ten frozen MSSR documents remains historical: annotated-range recall@5 was 20/28 (baseline 17/28), source-document recall@5 23/28 (unchanged), and range recall@50 24/28 (baseline 23/28). Spanish range recall@5 was 8/15; English was 12/13. All eight no-answer controls returned nearby evidence in top five, which does not test abstention. Labels were AI-reviewed, not human gold. Frozen inputs, baseline, post-change run, labels and status are under `D:\MSSR-benchmark-artifacts\mssr-librarian-unseen-doc-labels-20261006-v1\`.

## Consequences

- MSSR becomes the portable semantic owner of evidence normalization/selection contracts without becoming a universal filesystem or execution proxy.
- QuietDesk can evolve independently as the visual-observation/execution substrate while sharing the same Jev decision contract.
- Large documents and skills can participate in progressive disclosure without requiring whole-file injection.
- The system can learn which evidence tends to be useful while retaining counterexamples and skipped evidence for calibration.
- Global cross-project indexes remain acceleration/attention surfaces, not new project truth.
- Markdown stays readable and versionable; high-volume observations stay structured and reconstructable.

## Non-goals

- no raw conversation archive or replacement for ChatGPT memory;
- no private chain-of-thought capture;
- no automatic authority inference from headings, filenames, similarity or Jev labels;
- no loading every repository file or every skill;
- no model call per event;
- no automatic rewrite of project knowledge, skills, routing, ADRs or source documents;
- no requirement that every host use the same persistence engine;
- no claim that the portable Jev module or evidence query tool is implemented merely because this ADR is accepted.
