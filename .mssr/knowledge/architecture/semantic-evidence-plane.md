# Semantic Evidence Plane architecture

MSSR owns the portable semantic contract for turning bounded observable work evidence into queryable, selectively retrievable context/attention without becoming an execution proxy or a second source of project truth. Existing producers remain authoritative for their own facts: project files/ADRs/skills, Context Plane, trace/lifecycle telemetry, Situation/Notice projections, Semantic Experience and host/runtime metrics.

## Evidence atom and source boundary

The common unit is a bounded `EvidenceAtom`: identity (`kind`, `subject`, project/trace/workflow/task when known), source/provenance (`sourceRef`, canonical owner, observed time, freshness, revision/hash, optional heading path and exact span), bounded semantic labels/reason codes, relation/evidence refs, classifier identity when applicable, lifecycle state (`selected`, `skipped`, `delivered`, `consumed`, later verification/outcome) and explicit authority/privacy class. Atoms point to source bytes instead of copying whole documents. Raw prompts, transcripts, secrets and private reasoning are excluded.

Human-authored `.md` stays the readable/versioned authority. High-volume atoms and indexes are reconstructable structured runtime data under host storage such as `.mssr/runtime`/SQLite/JSONL; storage format is not semantic authority. A workspace-level `D:\Dev\.mssr\runtime` projection may aggregate projects for discovery/maintenance only while preserving each original owner.

## Progressive section retrieval

Eligible Markdown/skill sources may expose a revision-bound heading tree (`H1..H6`) with exact ranges. Retrieval is progressive: metadata -> top-level headings -> relevant branch -> exact section -> deeper/neighboring section only if necessary. Declared selectors, `project-context.json`, `context-modules.json`, `requiredWhen`, reviewed segments and canonical ownership outrank any derived heading index. Derived indexing is candidate/retrieval evidence only and never promotes an arbitrary document to authority.

`SKILL.md` remains the routed capability entry point. Detailed procedure should use parent-owned references/modules; heading indexes may help discover monoliths or retrieve bounded internal sections but do not invent permanent activation/routing semantics.

## Document Surface and Librarian contract

`Document Surface` is the portable technical primitive for revision-bound Markdown inspection. It derives metadata rather than copying source bodies: normalized revision, line/character/byte counts, H1-H6 hierarchy, parent/path identity, exact ranges, bounded hints/terms and section/block fingerprints. A later exact read must prove the same revision before materializing a range.

`Librarian` is the transversal advisory catalog/ingress role over evidence producers. Each adapted producer crosses one common contract with namespace/kind, stable identity, source ref, optional revision/payload fingerprint, bounded normalized metadata and provenance. This layer does not replace the original canonical owner.

Structural duplication is deterministic and runs before Jev: `exact-record`, `same-source-revision`, `same-payload`, `same-metadata` and `identity-collision`. These classes require no semantic classifier. Different normalized fingerprints may still become semantic relation candidates, but only then may Jev or another semantic classifier review equivalence/overlap/support/contradiction/supersession. An uninstrumented producer is a coverage gap, not evidence that no duplicate exists.

The long-term system goal is to adapt traces, skills, documents, notices, tools, manifests, outcomes and other bounded producers through this ingress contract so duplicate metadata/representation can be audited across MSSR/Bridge without introducing a second authority.

Coverage is part of the contract rather than an implicit assumption. `Librarian Coverage v1` classifies expected producer families as required/conditional/optional and instrumented/partial/missing/not-applicable, preserving owner, stable identity, authority/privacy/retention and can/cannot-prove boundaries. Missing/partial producers emit typed advisory gaps. A negative catalog result is valid only for a scope whose relevant coverage is complete: `missing instrumentation != evidence of absence`. This check is deterministic and does not use Jev.

Current producer adoption is incremental rather than a mass refactor. `document-surface` and `trace-lifecycle-outcome` are the first fully instrumented families. The lifecycle adapter accepts only the strict privacy-bounded telemetry checkpoint envelope, preserves structured lifecycle/evidence-reference fields, and strips free-form checkpoint/dimension summaries; raw prompts/transcripts, tool arguments, Git output, trace working-memory hypotheses and private reasoning remain outside Librarian ingress. Route/replan and the other declared producer families stay explicit coverage gaps until their own adapters pass focused regression.

## Reduction, batching and semantic triage

The intended pipeline is `observe -> normalize/Librarian ingress -> deterministic reduction -> dedupe/freshness -> group by subject/state -> optional semantic triage -> destination -> later feedback`. Cheap deterministic filtering runs first. Every drop/defer preserves a reason so later analysis can distinguish unseen, filtered, skipped, delivered and actually-used evidence.

Independent subjects are independent semantic jobs with bounded concurrency, cache, budgets, timeout/failure policy and circuit breaking. Multiple questions about the exact same subject/state may share one call; unrelated targets are not packed into one state just to reduce requests.

Jev becomes an optional portable MSSR classifier contract, not a QuietDesk dependency. MSSR owns bounded candidate/decision semantics; hosts own provider credentials/transport/runtime. QuietDesk remains a visual evidence producer/executor that may consume the same classifier. Jev may label relevance, novelty, relation, priority, audit-worthiness, selection or abstention among explicit candidates, but never establishes authority, truth, permission, verification or canonical write rights.

## Progressive evidence acquisition

Semantic triage may request more evidence instead of forcing a decision. The classifier receives only explicit candidate handles and can return a typed bounded request such as `inspect-heading-index`, `read-section`, `read-neighbor-section`, `read-exact-range`, `compare-revision`, `fetch-related-atom`, `request-verifier`, or `abstain`.

The host executes only requests permitted by the current evidence contract and normal tool authorization. The classifier never receives arbitrary filesystem traversal or generic tool execution authority. Every acquisition consumes explicit budgets: maximum rounds, maximum sections/ranges, maximum characters/tokens, maximum related atoms, timeout and provider-call budget. Repeated requests dedupe by source revision + section/range identity.

A typical loop is:

```text
metadata atom
  -> inspect H1/H2 inventory
  -> semantic triage: needs section X + sibling Y
  -> host returns exact bounded ranges
  -> triage again
  -> select / skip / review / abstain
```

Several compatible section requests may be batched into one host read and one semantic job. The acquisition trace records what was requested, what was actually returned, cost/depth, why the loop stopped, and whether later evidence showed the extra read was useful. This makes evidence acquisition itself learnable without making Jev authoritative.

## Destinations, unused evidence and learning

Classification and destination are separate. Policy may route an atom to `ignore`, shadow retention, context, Notice, audit, Semantic Experience, verification request, project-knowledge persistence proposal or skill/routing maintenance review. Existing owner/write gates remain unchanged.

The plane records the full funnel: ingested -> eligible -> deduped -> classified -> selected/skipped -> delivered -> consumed/application evidence -> later verifier/outcome/correction. Unused evidence can therefore be sampled in counterfactual sweeps to detect missed relevance or correct skips. A model cannot self-confirm its own historical proposal.

Semantic Experience remains the learning boundary. Reducer/selector/Jev decisions begin shadow-only with exact provenance/version identity. Any deterministic fast-path promotion requires independently verified cross-project holdout evidence, support/coverage, calibration/abstention and an explicit versioned promotion/rollback gate. Hard deterministic authority/permission rules remain outside learned influence.

## Query and coverage target

A read-only evidence query surface should support views by `trace`, `project`, `subject`, `source`, `classifier`, `batch`, `destination`, `unconsumed`, `dropped` and `gaps`. `gaps` reports producer families with missing or partial instrumentation so absence of evidence is never treated as evidence of absence. Full source bytes remain behind their owning provider and are loaded only through explicit bounded retrieval.

The first producer inventory covers MSSR routes/replans, project context and Context Messages, skills/selection/load feedback, context assembly/paging, lifecycle/checkpoints/outcomes, Semantic Experience, Notices/Situation/consistency findings, Bridge/host tool metrics and errors, filesystem/Git/document revisions, visual QA evidence, and explicit corrections/verifier evidence.

See ADR 0009 for the durable decision boundary and staged roadmap.
