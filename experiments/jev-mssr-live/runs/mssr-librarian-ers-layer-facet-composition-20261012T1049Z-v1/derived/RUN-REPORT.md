# Run48 — ERS multi-facet selection and cited host composition

Date: 2026-10-12
Classification: development replay on an exposed source/question lineage
Source: `docs/ELECTRONICS_MODULAR_SYSTEM.md`, revision SHA-256 `4a5556680a4f395bdbc4e6b578d9fbc368c15483fdad6b6f57aeef3e84a5cd77`

## Result

This replay decomposed the previously partial ERS question into three layer
facets, ran the live Bridge Librarian → Jev selection → exact fetch → cited
evidence pack path, and then composed one answer on the host. Jev selected the
expected Layer 1 and Layer 3 sections. For the compound Layer 2 query, it
selected only the placement/lineage sentence at line 55 and missed the bounded
module definition at line 45. Its reported evidence sufficiency was 0.88
despite that gap. A deterministic host-side follow-up query found the definition
at rank 4 and a fourth Jev call selected it. Together, those two Layer 2 ranges
covered the self-reviewed facet claims.

| Facet/call | Jev selection | Choice | Evidence sufficiency | Outcome |
| --- | --- | ---: | ---: | --- |
| Layer 1 | `heading-4`, L28-L42 | 0.46 | 0.83 | Expected section selected |
| Layer 2 compound | `block-13`, L55 | 0.43 | 0.88 | Partial; definition omitted |
| Layer 3 | `heading-6`, L57-L70 | 0.93 | 0.74 | Expected section selected |
| Adaptive Layer 2 definition | `block-11`, L45 | 0.32 | 0.95 | Missing definition recovered |

The initial searches returned 68, 56, and 68 handles; the adaptive search
returned 43. The expected section was present at rank 3 in each primary pool;
the follow-up definition was at rank 4. Each Jev call received the frozen
top-12 pool. Across four calls the wrapper reported 7,483 input and 668 output
tokens, with 3,861.6 ms summed reported elapsed time. These raw Choice and
evidence-sufficiency values are uncalibrated and are not probabilities of
answer correctness.

All four selected handles were fetched from the same source revision. Their
returned fingerprints matched the selection handles, and recomputing the text
fingerprints passed 4/4. The evidence pack retained four disjoint exact ranges,
four citations, and 1,129 characters. No containment dedupe occurred and no
semantic compaction was performed. The host, not Jev, wrote the cited paragraph
in `outputs/assembled-answer.md`. One independent blind Luna reviewer judged it
“correcta y completa,” found no material omission or unsupported statement,
and verified the layer/placement citations. See
[`blind-review.json`](blind-review.json) and [`metrics.json`](metrics.json).

## Interpretation

This is useful evidence for a **host-managed** loop: split an exposed compound
question into facets, inspect coverage after each exact selection, issue a
bounded follow-up for the missing facet, re-fetch exact ranges, pack citations,
and compose on the host. The concrete failure is equally important: a high
reported sufficiency value (0.88) did not detect the omitted Layer 2 definition.
Sufficiency cannot replace a claim/facet coverage check.

The replay does not show that Jev automatically decomposes queries, that an
evidence pack semantically merges sources, or that the paragraph is reliable
on new content. It is one source cluster linked to Runs 45 and 47; labels are
self-reviewed rather than owner-adjudicated; there is no holdout, negative
control, calibration analysis, or production claim. No runtime, threshold, or
source-project file changed. The full packet-integrity exception is recorded in
[`RUN-ERRATUM.md`](RUN-ERRATUM.md); the append-only post-call hash inventory is
[`POSTCALL-SHA256SUMS.json`](POSTCALL-SHA256SUMS.json).

## Verification performed

- Source SHA-256 still matches the frozen source revision.
- Primary pre-call checksum list: 7/8 files match; only `manifest.json` differs.
- Adaptive follow-up pre-call checksum list: 2/2 files match.
- Four selection/fetch/source/text-fingerprint bindings: 4/4 pass.
- Evidence-pack paragraph text matches the four exact fetched texts: 4/4.
- Blind-review input was the exact assembled answer plus its cited evidence; no
  earlier run context was supplied to the reviewer.
- `git diff --cached --check` reports extra blank lines at EOF in some original
  frozen packet files. They are retained byte-for-byte to preserve their
  pre-call hashes; JSON parsing and the independent post-call hash inventory
  pass. The staged project-document paths have no whitespace errors. Existing
  CRLF warnings on three unrelated modified files remain outside this commit.
