# Jev confidence, contradiction and merge evaluation

Status: research-backed architecture with an incremental portable implementation, reviewed 2026-09-30. This note does
not authorize automatic project edits, provider calls, or host I/O.

## What the MSSR runs establish

The live rubric-matched section run used 17 real sections from four MSSR
modules, three repeated requests per section, and Jev 1.13.0. EvidenceAtom
scored 48/51 action decisions (94.1%) versus 45/51 (88.2%) for parent metadata.
Move precision was 100% in both; move recall was 83.3% versus 66.7%. Lifecycle
classification moved the other way: 88.2% for EvidenceAtom versus 100% for
parent metadata. The prior English-rubric run is preserved but excluded from
direct comparison. Run artifacts are outside the repository at
D:\Dev\mssr-snapshots\benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17.

This is promising task accuracy, not a 94.1% per-decision confidence guarantee.
The 51 calls are repeated observations over 17 labeled sections, not 51
independent cases; the labels were author-created and not independently
adjudicated. Under experiments/CONTROLLED_RUN_PROTOCOL.md, fewer than 30
independent labeled units is exploratory. Do not turn this point estimate into
a system-wide score, promotion claim, or production threshold.

The archived ontology run covers 22 real Project Context units and eight
provided relation pairs. Its labels were not independently adjudicated, and
the same corpus was reused across versions. The references run covers real
references but synthetic tasks. Neither suite tests EvidenceAtom merge.
Semantic Experience currently has 1,895 real shadow observations but no
verified truth labels; they cannot score Jev semantic accuracy.

The October 2 lexical bilingual rewrite was an offline deterministic-search
experiment, not a Jev run. Spanish recall@100 rose from 4/26 to 9/26 overall
(4/20 to 9/20 on development), but it found 0/6 in the previously opened
Spanish holdout. English recall@100 fell from 18/26 to 14/26 overall
(13/20 to 11/20 on development; 5/6 to 3/6 on the opened holdout); merging
baseline and rewrite did not rescue the Spanish holdout. Do not ship the frozen lexicon. A separate live
repeatability smoke offered 66 Spanish and 99 English exact search handles to
TypeSafe Jev jev-1.13.0; both paired queries repeated the same block-26
selection and both exact fetches matched the source fingerprint. This is one
already-exposed query concept, not bilingual accuracy or calibration evidence.
The immutable run is
experiments/jev-mssr-live/runs/mssr-librarian-jev-shortlist-repeatability-20261002T143234Z-v1/.

## Keep source evidence separate from Jev judgment

EvidenceAtom remains the immutable, revision-bound source record. Its
freshness means whether the host supplied an exact source observation; it is
not whether the claim is currently true, historical, or superseded. The
observed lifecycle regression may reflect that distinction being unclear in
the model-facing projection. This is a hypothesis, not a proven cause.

Keep Jev's result in a separate judgment/proposal linked to exact atoms and
source revisions. The judgment should carry decision family, candidate value,
per-head raw confidence, calibrated confidence only when an MSSR holdout
supports it, model/prompt/schema identity, evidence coverage, claim validity,
scope and valid time, relation candidates, abstention/review reasons, and
verification status. A changed source revision invalidates the judgment for
automatic reuse.

Use contradiction evidence as typed, cited links between claims—supports,
contradicts, supersedes, duplicate, or unrelated—with exact source references
and subject/scope/time checks. Deterministic contradictions or unresolved
opposite claims force review. Jev may rank or explain candidates; it cannot
establish source authority or settle truth. Never infer a contradiction from
similarity alone.

## Librarian retrieval and evidence acquisition

The portable `searchMssrLibrarianEvidence` primitive performs bounded lexical
search over Markdown supplied by the owning host, indexed by exact Document
Surface sections/blocks. It can also accept EvidenceAtoms, but projects only
closed-vocabulary fields when the atom and catalog record match the exact owner,
privacy class, source/revision, range identity, offsets and payload fingerprint
re-derived from that Markdown. Search terms and `query.metadata` filters use the
same range-bound projection. Results expose only the matching field/value,
projection fingerprint and caller-asserted provenance flag; atom-backed filter
matches are identified separately so a caller can see which typed field
satisfied a filter. Declared freshness values such as stale, historical, or
superseded remain discoverable for review and do not affect ranking or establish
currentness. Full atoms and generic catalog metadata are never copied. Legacy
`searchableMetadata` remains document-scoped. Input caps and range/subject
indexes keep the new path bounded without scanning every atom and record for
each range. These inputs are not automatically supplied by Bridge or existing
adapters yet, and none of the owner/privacy/provenance labels authenticate the
caller or grant authority.

Search returns advisory handles bound to source ref, revision, exact range,
privacy label and fingerprint; fetch materializes text only when the host
supplies the current source again. Search reports each exact range's UTF-16
code-unit length and whether it fits fetch's 20,000-unit cap. Jev selection
validates supplied handles, then offers only whole ranges that exact fetch can
return; it never truncates a handle or invents a smaller subrange. It reports
offered, eligible and oversized counts, and returns `not-run` without calling
Jev when every candidate exceeds the cap. This is a fetchability boundary, not
model abstention; an explicit later fetch of an oversized search result still
fails closed. MCP exposes search/fetch plus Jev relation
review, which batches compatible pairs within one explicit project/corpus scope
and emits atom-bound judgments. Those judgments remain unverified until an
independent verifier is supplied; a separate MCP tool builds exact-source
previews and never writes canonical files. Pairs with no shared atoms are
isolated into separate Jev requests; pairs in one connected atom component may
share a request within the state/question limits.

Jev can then classify related atoms from exact text returned through those
handles. The host supplies/authorizes source reads; the tool rechecks the
caller-supplied owner, revision, privacy and explicit budgets. Only connected
pairs for one project/corpus can share one provider request; the tool never
mixes scopes or disconnected evidence components. Record requested versus
returned evidence and later utility when known. Grep, similarity and metadata
matching find candidates; none proves truth, resolves authority, or grants a
merge. Measure retrieval candidate recall separately from Jev relation
precision/recall.

## Confidence and merge policy

Treat confidence as a decision-family-specific routing signal, not a universal
quality percentage. Choose thresholds against the cost of a false action and
report risk-versus-coverage at several cutoffs. Until the score is calibrated
on independently reviewed, project-grouped holdout cases, label it
uncalibrated; do not call a raw threshold “90% trusted.” Evaluate calibration
with reliability bins and Brier/log loss or ECE alongside accuracy, precision,
recall, abstention and high-confidence errors.

Proposed stages:

1. Deterministic identity, owner, revision, privacy and exact-evidence guards.
2. Librarian returns bounded evidence handles; Jev proposes typed judgments
   over those explicit candidates.
3. Missing temporal/scope data, low confidence, or a contradiction sends the
   proposal to review/abstain.
4. A raw confidence threshold may admit a derived synthesis preview, never a
   destructive source merge or canonical write.
5. Independent verification and normal owner approval remain required before
   any persisted project change.

A merge/synthesis proposal should retain input atom IDs, refs, revisions and
fingerprints; candidate relations and conflicts; decision alternatives and a
short evidence-cited reason for each inclusion, omission or separation; the
output hash; confidence/calibration version; and reviewer/verification state.
Keep original atoms and source bytes intact. A contradiction blocks automatic
consolidation; represent supersession as a temporal relation rather than
silently overwriting older evidence. The current preview builder accepts only
exact fingerprint-bound source snapshots and comparable `supports` or
`duplicate` relations. It retains exact source snapshots and output hashes;
contradiction, unresolved, low-confidence, non-comparable or unverified cases
remain separate/review-only. The default 0.75 raw relation threshold is an
exploratory gate, not a calibrated probability or production confidence
guarantee. Unknown/non-fresh source status blocks candidate status. Freshness
and verifier records are caller assertions, not authenticated receipts; the
host must re-read and compare current source revisions before consuming a
candidate. `applyAllowed` and canonical rewrite remain false.

### Current exploratory live MSSR smoke — 2026-09-30

The live run at
`experiments/jev-mssr-live/runs/mssr-real-evidence-librarian-jev-20260930T215053Z-6f26e1/`
used four current MSSR documents, four retrieval queries, eight exact fetched
blocks and four Jev relation requests. Librarian recall@5 was 4/4 but top-1
was 0/4 (expected ranks 3, 2, 5 and 2). Jev matched 3/4 author-created
relation labels. For the case with unknown scope/time, Jev chose
`supports` at 0.45 confidence; deterministic evaluation and synthesis preview
kept both atoms in review because scope and temporal comparability were
unknown. Both previews had `applyAllowed=false`. The run has no independently
adjudicated labels or true contradiction positives, so it does not establish
general accuracy, contradiction recall or confidence calibration. It confirms
the explicit MSSR MCP path can call live Jev over exact current source blocks;
it does not make Jev an automatic Librarian reranker or authorize writes.

## Composed capability boundary

Jev supplies finite typed decisions; an application can use those decisions to
drive substantial text work without asking Jev to generate prose. TypeSafe's
Structure recovery cookbook demonstrates two passes: Jev judges whether
adjacent lines continue a sentence, deterministic code joins the original
lines, Jev classifies the resulting blocks, and a renderer assembles Markdown
paragraphs/lists/headings from the source words. Its Re-ranking cookbook puts
Jev after BM25 and reports top-1 moving 5% to 18% and top-10 38% to 62% over 40
CLERC queries; these are provider-published examples, not independent MSSR
results. This supports the user's observed intelligent grep, selection,
lossless compaction and paragraph-assembly workflow as a composed capability.
Semantic rewriting still needs a generator or a human.

For MSSR, the host can compose owner-authorized search and exact fetch, typed
atom metadata, Jev selection/relation judgments, contradiction policy,
iterative evidence acquisition, deterministic assembly or a separate prose
generator, citation verification and reversible preview. Current portable APIs
provide those pieces but do not run the whole loop, generate open prose, or
automatically receive Bridge atoms; that host wiring and an end-to-end benchmark
remain future gates. Each stage must retain source ranges and decisions. The
preview is relation-aware and reversible; no automatic project write occurs.
See TypeSafe's [Structure recovery](https://docs.typesafe.ai/cookbooks/autoformat),
[Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe),
[question primitives](https://docs.typesafe.ai/primitives), and
[confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing).

## Next MSSR evaluation

Keep the axes separate: retrieval recall, source freshness,
claim validity/lifecycle, placement, move safety, contradiction detection,
relation classification, synthesis faithfulness, provenance retention,
reference/skill selection, and downstream task outcome. For the lifecycle
regression, freeze one Spanish rubric and compare: parent metadata; atom
provenance without exposing source freshness to Jev; explicit sourceFreshness
versus claimValidity; and those orthogonal fields plus
contradiction/supersession context. Use the same cases and independent
adjudication across variants.

For retrieval and merge, score search candidate recall separately from
pair-classifier precision/recall; then score citation support,
retained/rejected evidence, conflict handling, authority preservation,
reversibility, and harmful false-merge rate. Group holdouts by project/source
module. Repetitions measure stability, not sample size. Keep labels out of
requests and preserve the manifest, exact inputs, runner/build hashes, raw
responses and separate adjudication.

## Public evidence reviewed

Public Jev results are useful prior evidence, not substitutes for MSSR
validation:

- [TypeSafe's Jev introduction and workflow evaluations](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
  compares four code workflows against a reference averaged from GPT-6 Astra
  and Claude Fable 5.1. TypeSafe notes the workflows were created by its own
  capability team; treat the headline as vendor evidence, not independent
  ground truth.
- The [Jev in Medicine preprint](https://arxiv.org/abs/2609.34024) evaluates
  8,469 requests across four medical benchmarks and reports accuracy and
  calibration varying by dataset. For example, a high-confidence subset did
  well on MetaMedQA, while confidence discriminated less well on
  DiagnosisArena-MCQ. This argues for task-specific calibration; it does not
  validate knowledge curation.
- [JevAdvBench](https://arxiv.org/abs/2609.31142) is an adversarial robustness
  preprint with 812 typed questions and 9,744 single-edit variants. It finds
  that unverified opinions added to state can flip decisions. Its clean-run
  comparison is a robustness measure, not truth labels or a merge evaluation.
- Independent community posts report mixed task-specific results. One
  [Reddit benchmark](https://www.reddit.com/r/AI_India/comments/1wmvyqz/i_benchmarked_typesafes_jev_against_llms_bert_and/)
  reports 500 held-out examples each across SST-2, AG News and Banking77, with
  accuracy and calibration changing across datasets. Another
  [agent-routing report](https://www.reddit.com/r/LLMDevs/comments/1wo000s/we_benchmarked_typesafes_new_jev_a_decisiononly/)
  reports high accuracy above a confidence cutoff on its hand-labeled routing
  set. These are author-reported, task-specific results, not peer-reviewed
  validation of MSSR.
- [FEVER](https://aclanthology.org/N18-1074/) and
  [SciFact](https://aclanthology.org/2020.emnlp-main.609/) are adjacent
  verification datasets, not Jev benchmarks. Their supported/refuted/
  insufficient-evidence labels and cited evidence rationales are useful
  precedents for MSSR contradiction cases.
- The reported Pokémon Red success is an anecdotal systems example: public
  coverage says a separate LLM, the developer and viewers adjusted the
  decision options and harness during play. It demonstrates a composed agent
  loop, not Jev acting alone or a controlled benchmark
  ([coverage](https://www.tomshardware.com/tech-industry/artificial-intelligence/developer-says-jev-decision-model-beat-pokemon-red-in-under-a-week-non-llm-engine-succeeds-where-traditional-chatbots-stalled-for-months-but-claude-opus-5-coached-the-model-through-its-dead-ends)).

No public benchmark found in this review measures Jev on MSSR's real
documents, skill references, contradiction layer, EvidenceAtom provenance,
Librarian evidence retrieval, or reversible semantic merges.

See [Jev decision-model use cases](../research/jev-decision-model-use-cases.md)
for 100 explicitly unvalidated application hypotheses, public source limits,
the OpenAI Decisions API announcement status and the QuietDesk evidence
boundary. QuietDesk demonstrates a separate live visual/action/verification
chain; it is not an MSSR retrieval or synthesis benchmark.
