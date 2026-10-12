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

A syntax-recovery diagnostic on real MSSR documents was not an intrinsic Jev test. V5 recovered 14/14 adjacent boundaries and round-tripped one Markdown excerpt exactly. V6 recovered 41/46 boundaries, 23/31 exact blocks and 23/26 block types across three documents; its five errors were false joins. Preserve deterministic Markdown cues; the Noul 0.5 replay did not justify threshold changes. Frozen receipts remain at D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v5\ and D:\MSSR-benchmark-artifacts\jev-structure-recovery-20261008-v6\.

The October 2 offline bilingual lexical rewrite raised Spanish recall@100 from 4/26 to 9/26 but found 0/6 on the opened Spanish holdout; English fell from 18/26 to 14/26. Do not ship that frozen lexicon. The separate live repeatability smoke repeated one already-exposed concept and is not accuracy or calibration evidence; see experiments/jev-mssr-live/runs/mssr-librarian-jev-shortlist-repeatability-20261002T143234Z-v1/.

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

## Earlier live follow-ups (2026-10-12)

The independent four-project Spanish pilot used eight questions across four repositories (four answerable, four source-absent), explicit sourceRefs, and metadata off. Search found three of four positive targets in top eight; Jev selected two positives and selected no negative evidence (two negatives had no candidates). Exact labeled-range selection was 0/2; fetch/pack integrity 2/2. Labels are independent source-only review, not owner-gold. One WidgetForge contradiction pair got Jev contradicts at raw 0.95, but deterministic review and synthesis preview remained review/applyAllowed=false. These are exploratory, uncalibrated diagnostics; no runtime/threshold changed. See the experiment ledger.

## Cross-project live follow-ups: Runs 62–63 (2026-10-12)

Run 62 combined three completed clusters from its original Spanish cross-project pilot with one separately preflighted MauroAssetLibrary supplement after Codecraft failed before Jev because `.mssr/project-context.json` was absent. Across the four completed clusters, Jev selected all four answerable cases and abstained on all four negatives; exact fetch and evidence packs passed 4/4. Two blind reviewers judged the three original positive excerpts complete. Metadata was off; labels are source-only, the supplemental cluster is post-hoc, and this is not calibration or a certified holdout. The 100-candidate negative requests consumed most of the provider input tokens, so candidate-budget effects should be measured separately. Full details remain in the Run 62 ledger entry.

Run 63 used six Spanish/English questions across three exact source paths from three project roots, metadata off, and only same-query search handles. Search returned the target for 2/3 answerable cases; Jev selected 1/2 offered positive targets and abstained on 3/3 source-absent questions. The other positive had an empty pool and was not sent to Jev. One positive exact table was offered but declined; one selected broad range passed exact fetch and evidence-pack verification. Three blind quality reviewers assessed full candidate text: two agreed on all six cases, while one confused the distinct `overlap_count` and `edge_crossings` metrics in A2; source-line adjudication resolved the disagreement and preserves the error. Labels are not owner-gold. Source paths had no exact match in the local run ledger, but the project families were previously exposed, so this is not a project-disjoint or global holdout. Five Jev calls used 8,447 input and 653 output tokens in 4.0363 seconds of summed provider time. The initial C1 pack attempt was rejected as stale for the caller-provided source revision; exact Bridge-read bytes passed on retry, but the failure receipt does not establish the cause. Scores remain uncalibrated; no threshold or runtime changed. See `experiments/jev-mssr-live/runs/mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1/derived/RUN-REPORT.md`.

Together, Runs 62 and 63 reinforce that a successful fetch/pack path does not imply consistent retrieval or selection: Run 62's small curated/supplemental cohort completed all four positive decisions, while Run 63 exposed both an empty Spanish retrieval pool and a false Jev abstention on an exact offered table. Keep these stages scored separately, and do not adjust Choice/Noul thresholds from either sample. Next compare fixed-pool bilingual retrieval and Jev selection independently on owner-adjudicated, project-grouped cases.
