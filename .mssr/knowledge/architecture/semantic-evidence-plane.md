# Semantic Evidence Plane architecture

MSSR owns the portable semantic contract for turning bounded observable work evidence into queryable, selectively retrievable context/attention without becoming an execution proxy or a second source of project truth. Existing producers remain authoritative for their own facts: project files/ADRs/skills, Context Plane, trace/lifecycle telemetry, Situation/Notice projections, Semantic Experience and host/runtime metrics.

## Evidence atom and source boundary

The common unit is a bounded `EvidenceAtom`: identity (`kind`, `subject`, project/trace/workflow/task when known), source/provenance (`sourceRef`, source class, canonical owner, observed time, freshness, revision/hash, optional heading path and exact span), bounded semantic labels/reason codes, relation/evidence refs, classifier identity when applicable, lifecycle state (`selected`, `skipped`, `delivered`, `consumed`, later verification/outcome) and explicit authority/privacy class. EvidenceAtom v2 requires source class and canonical owner; a `freshnessEvidence` assertion must match the same owner, normalized ref and revision and include a timestamp. This is structural consistency validation of caller-supplied evidence, not authentication or independent proof that a host performed the observation. Unknown is the safe default. Atoms point to source bytes instead of copying whole documents. Raw prompts, transcripts, secrets and private reasoning are excluded by producer-owned projections; the generic metadata blacklist is defense in depth, not a universal sanitizer.

Human-authored `.md` stays the readable/versioned authority. High-volume atoms and indexes are reconstructable structured runtime data under host storage such as `.mssr/runtime`/SQLite/JSONL; storage format is not semantic authority. A workspace-level `D:\Dev\.mssr\runtime` projection may aggregate projects for discovery/maintenance only while preserving each original owner.

## Core Document and Librarian guarantees

Document Surface exposes revision-bound metadata and exact source ranges. A later fetch is usable only against the same source revision. Hosts read files and supply bounded Markdown; MSSR search does not scan the filesystem or turn derived indexes into project authority.

Librarian adapts typed, privacy-safe producer metadata while retaining caller-asserted provenance; it does not authenticate that provenance. Deterministic structural duplicate checks run before optional Jev relation judgments. Jev selections, confidence and sufficiency scores remain advisory and uncalibrated. Exact fetch, independent verification and separate permission/write gates remain required; synthesis preview never writes canonical sources.

Immediately before Librarian selection and semantic relation-review calls, MSSR replaces filesystem-path owner/source/project identifiers with request-local opaque labels, then scans the exact bounded provider request for private/non-public IPv4 addresses, remaining Windows/UNC local paths, and common credential patterns. Any content match blocks the request before provider invocation; diagnostics carry only matched categories and counts, never the matching text. This is narrow deterministic defense in depth, not comprehensive DLP, a privacy classification system, or authorization. Hosts still own source classification and provider policy.

## Progressive section retrieval

Eligible Markdown/skill sources may expose a revision-bound heading tree (`H1..H6`) with exact ranges. Retrieval is progressive: metadata -> top-level headings -> relevant branch -> exact section -> deeper/neighboring section only if necessary. Declared selectors, `project-context.json`, `context-modules.json`, `requiredWhen`, reviewed segments and canonical ownership outrank any derived heading index. Derived indexing is candidate/retrieval evidence only and never promotes an arbitrary document to authority.

`SKILL.md` remains the routed capability entry point. Detailed procedure should use parent-owned references/modules; heading indexes may help discover monoliths or retrieve bounded internal sections but do not invent permanent activation/routing semantics.

The detailed revision-bound Document Surface and Librarian contract is indexed in `mssr-document-surface-librarian-contract` for exact-range retrieval and catalog integration.
## Reduction, batching and semantic triage

The implemented slice is `host selects/reads sources -> Librarian search/fetch -> isolated Jev relation batches per connected evidence component -> exact atom-bound semantic judgments -> contradiction-aware reversible preview -> host re-read/revision check and approval/write outside MSSR -> independent verification`. Disjoint evidence components never share one Jev state; connected pairs may share a request within limits. The broader plane still intends to capture deterministic reduction, freshness, destination, later feedback and all producer classes. Cheap deterministic filtering runs first. Every drop/defer preserves a reason so later analysis can distinguish unseen, filtered, skipped, delivered and actually-used evidence. Jev provider transport/credentials remain host-owned. The relation-review tool builds typed judgments from selected-option confidence; when the provider does not return a full class distribution, MSSR records that distribution as unavailable rather than inferring one. Contradictory, unresolved, non-comparable, non-fresh or unverified evidence cannot become a consolidation preview. Verifier identity and freshness metadata are structurally checked caller assertions, not authenticated receipts; preview output requires the host to re-read current revisions before consuming a candidate.

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

A broader read-only evidence query surface should support views by `trace`, `project`, `subject`, `source`, `classifier`, `batch`, `destination`, `unconsumed`, `dropped` and `gaps`. `gaps` reports producer families with missing or partial instrumentation so absence of evidence is never treated as evidence of absence. Full source bytes remain behind their owning provider and are loaded only through explicit bounded retrieval. The initial local Markdown search is a pure host-supplied input API; it does not yet provide cross-project storage, corpus-wide coverage, or those query views.

The first producer inventory covers MSSR routes/replans, project context and Context Messages, skills/selection/load feedback, context assembly/paging, lifecycle/checkpoints/outcomes, Semantic Experience, Notices/Situation/consistency findings, Bridge/host tool metrics and errors, filesystem/Git/document revisions, visual QA evidence, and explicit corrections/verifier evidence.

See ADR 0009 for the durable decision boundary and staged roadmap.
