# Jev confidence, contradiction and merge evaluation

Status: research-backed architecture with an incremental portable implementation, reviewed 2026-10-06. This note does
not authorize automatic project edits, provider calls, or host I/O.

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

The official [Autoformat cookbook](https://docs.typesafe.ai/cookbooks/autoformat)
also makes the important preprocessing boundary explicit: blank-line gaps and
visible markers such as bullets and heading prefixes are read by code, not
asked back as model judgments. Only ambiguous structure is sent to Jev. V6's
false joins reproduce the failure mode caused by violating that boundary.

For MSSR, the host can compose owner-authorized search and exact fetch, typed
atom metadata, Jev selection/relation judgments, contradiction policy,
iterative evidence acquisition, deterministic assembly or a separate prose
generator, citation verification and reversible preview. Current portable APIs
include the 0.2.102 read-only `mssr_librarian_evidence_pack`: it re-fetches up to
16 supplied exact handles against current caller Markdown and returns verbatim
ranges with per-range citations. It does not run iterative Jev selection,
decision-guided structure recovery, or prose generation, and it does not
automatically receive Bridge atoms; host orchestration and an end-to-end
benchmark remain future gates. Each stage must retain source ranges and
decisions. The preview is relation-aware and reversible; no automatic project
write occurs.

## Jev-guided lossless structure recovery: two exploratory MSSR samples (2026-10-08)

An isolated host-side runner used the current generic Jev `Choice`/`Noul`
provider contract against two short, real MSSR source excerpts. The runner
removed Markdown markers and deterministically hard-wrapped source text, asked
one mid-sentence `Noul` per adjacent line pair, kept explicit blank-line gaps
as deterministic splits, asked one `Choice` per recovered block, then rendered
paragraphs, level-two headings and list items without rewriting source words.
The 0.2/0.5 punctuation-aware stitch thresholds reproduce the TypeSafe cookbook
example; they are not calibrated for MSSR.

The initial variant used a broad “same original block” `Choice` and flattened
all blank gaps. On the English sample it got 23/28 queried boundaries correct;
five list-item boundaries were joined and the resulting list was classified as
a paragraph. This is concrete evidence that the question wording and
deterministic treatment of blank gaps matter. The corrected variant achieved
27/27 queried boundaries and exact reconstruction of all 8 blocks/types on an
English ADR 0009 excerpt, and 25/25 boundaries with exact reconstruction of all
7 blocks/types on a Spanish research excerpt. Both preserved the exact token
sequence (288 and 272 tokens respectively). Each sample used two live
`jev-1.13.0` requests. These are small, inspected development samples with
source-derived labels, not independent human adjudication or a quality
estimate. Confidence remains descriptive and uncalibrated.

Receipts, external runner and source/build fingerprints are kept outside Git:
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v1\` (failed
prompt variant; result SHA-256 `E9F57BE9D17C73BA2F3C467261794D5D7D5B2252C07F06C86D9ECACEFEED3DCE`),
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v2\` (English
corrected variant; result SHA-256
`5AAF8B40E0B6B431EC336662905810208D017B98A5632EF40BA6DA05C83BC97C`), and
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v3\` (Spanish
corrected variant; result SHA-256
`9D0D283DFDE99090961696D977733E064FC856191B8DF87D4EA63C3B9C16FE0C`). No
canonical document was modified. The result supports an opt-in composed
preview as a plausible next implementation, but not automatic formatting or
merge. Before exposing a product tool, test code/callout blocks, citation and
line provenance retention, and a separate owner-adjudicated set; evaluate
thresholds separately from token preservation.

A separate structure-type/provenance check classified an existing JSON code
block and a Markdown validity callout correctly (2/2; raw Choice confidence
1.0 for both). After Jev returned, the runner re-read both source files and
verified the repository revision, source-document hashes, exact line ranges,
range fingerprints and rendered text; all checks passed. The call used 1,374
input and 123 output tokens. Receipt and runner are in
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v4\` (result SHA-256
`B94C0EF539DAE358862EC9A3F9779AEFB8B5A82F73FF6E2A07D303D7E394C6B5`). The sample
tests classification and citation readback only; it does not test recovery of
unmarked code boundaries or general accuracy.

See TypeSafe's [Structure recovery](https://docs.typesafe.ai/cookbooks/autoformat),
[Re-ranking](https://docs.typesafe.ai/cookbooks/rerank_typesafe),
[question primitives](https://docs.typesafe.ai/primitives), and
[confidence-gated routing](https://docs.typesafe.ai/patterns/confidence-routing).
