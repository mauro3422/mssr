## What the MSSR runs establish

On 2026-10-06, a deterministic Librarian search over ten frozen MSSR
documents and 36 bilingual queries returned all requests without provider
calls. The labels are AI-reviewed development evidence, not human gold: the
first 30 queries had two blind reviews; six added no-answer controls were
proposed by reviewer A and validated by reviewer B. Two grade disagreements
in the first set are recorded in the adjudication file. The corpus had a
bounded pre-run no-hit audit, but is now an open development set, not a
protected holdout. The exact duplicate `es-12`/`en-10` counts as one concept.

The baseline returned the supported source document in its top five for
23/28 queries and an adjudicated line span in its top five for 17/28. After
interleaving results only within equal-score/equal-fetchability groups, a
post-change source run kept document recall@5 at 23/28 and improved annotated
range recall@5 to 20/28 (Spanish 8/15; English 12/13); range recall@50 was
24/28 and recall@1 remained 14/28. All eight no-answer controls still had
nearby evidence in the top five. This measures retrieval only, not whether
Jev/Noul abstains, and supports no confidence threshold or accuracy claim.
Immutable baseline, post-change run, labels, hashes, and the corrected
post-run dataset status are kept outside Git under
`D:\MSSR-benchmark-artifacts\mssr-librarian-unseen-doc-labels-20261006-v1\`.

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

A host-side structure-recovery diagnostic used Jev 1.13.0 on one real MSSR
excerpt after removing JSON fences and blank-line separators while keeping
each source line's citation. V5 recovered 14/14 adjacent boundaries; Choice
classified all three exact blocks, and deterministic rendering reproduced the
original Markdown exactly (4,418 input / 346 output tokens). This was one
source-derived example with syntax-derived labels, not independent adjudication
or a calibration result. V5 receipt:
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v5\` (result
SHA-256 `BDC787EB651D8AF0FD21795FA3B10F2D2BA82E22648B76EBFD40EDE1793DB211`).

V6 tested 47 lines/31 blocks from three real documents after removing blank
gaps and Markdown markers. Jev 1.13.0 recovered 41/46 boundaries at Noul 0.5,
23/31 exact blocks and 23/26 block types. The five errors were false joins
(0.52–0.73): three list items and two paragraphs. Source hashes, line readback
and citations passed. This diagnoses lossy preprocessing, not intrinsic Jev
quality; preserve deterministic cues and ask Jev only about ambiguity. Offline
threshold replay did not justify changing 0.5. V1–v6 remain syntax-labeled
development diagnostics, not independent quality or calibration evidence.
Runner/receipt are outside Git at
`D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v6\` (result
SHA-256 `22B2AF9116D1F69B880A085C46DE80EA7A281911719D00C298D39BA777B8A0D5`).

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

2026-10-10: ten exposed queries repeated twice on the same five documents.
Choices/abstentions matched 10/10 per round.
Choice range mean/max was 0.040/0.080. Direct `minEvidence` wording raised
exact search rank 25→3 and Jev fetched the analysis-only rule (Choice
0.26/Noul 0.57); neutral wording scored higher but selected incomplete
evidence. D12/D14 probes found partial support or abstention. No owner-gold/
holdout; labels/thresholds unchanged. Receipts:
`D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261009-v1\librarian-contrastive-authority-abstention-20261010-v1\`.


## Run43 (2026-10-12)

Unindexed policy control: sidecar fallback matched lexical 8/8; expected ranges
were in 4/4 adaptive pools, but exact Jev target selection was 1/4. Two answers
were complete; one was 4.39x overbroad. Exploratory, uncalibrated; no
sidecar/policy/threshold change. Full results: `experiments/jev-mssr-live/README.md`.
