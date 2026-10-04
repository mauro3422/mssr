# Historical Jev confidence diagnostic — 2026-10-04

**Classification:** offline rescore of preserved exploratory runs. No Jev or MCP call was made. No file under experiments/**/runs/** was edited.

## What the offline rescore measures

confidence-diagnostic.mjs reads only the frozen scored-records.json and score-summary.json from the 0.2.97 direct 80k v2 and hierarchical 64k v1 runs. It verifies each source against its run's SHA256SUMS and fixed hashes before computing anything.

The binary target is the archived author-preferred exact-heading flag (exactTarget) among selected responses. Brier and log loss are conditional on selected outputs; abstentions count as coverage loss and do not get a fabricated confidence score. Threshold rows and reliability bands are descriptive. They do not tune a cutoff or validate answer quality.

| Archived run | Requests / concepts | Provider calls | Selected / abstained | Exact preferred heading among selected | Coverage | Binary Brier | Binary log loss |
|---|---:|---:|---:|---:|---:|---:|---:|
| 80k direct v2 | 52 / 26 paired concepts | 52 | 50 / 2 | 34/50 (0.6800) | 50/52 (0.9615) | 0.17809 | 0.51479 |
| 64k hierarchical v1 | 52 / 26 paired concepts | 156 | 49 / 3 | 31/49 (0.6327) | 49/52 (0.9423) | 0.16692 | 0.48701 |

These are not comparable calibrations: both runs use 21 documents and the same paired English/Spanish concepts, but direct choice ranks 200 candidates while hierarchical choice ranks four finalists. The 52 rows represent only 26 bilingual concepts. The old score summaries say humanOwnerAdjudication: false; a strict miss may still be a valid overlapping or parent range. Exact fetch passed for 50/50 direct and 49/49 hierarchical selections, which proves handle integrity only.

## Descriptive cutoff sweep

The following uses the old strict target and chooses rows after seeing the outcomes. It is included to inspect coverage/error tradeoffs, not to recommend a threshold.

| Confidence floor | Direct retained / 52 | Direct strict matches | Hierarchical retained / 52 | Hierarchical strict matches |
|---:|---:|---:|---:|---:|
| 0.50 | 41 (78.85%) | 31/41 | 33 (63.46%) | 26/33 |
| 0.70 | 29 (55.77%) | 23/29 | 26 (50.00%) | 22/26 |
| 0.80 | 22 (42.31%) | 19/22 | 22 (42.31%) | 19/22 |
| 0.90 | 15 (28.85%) | 15/15 | 15 (28.85%) | 15/15 |

The apparent 15/15 strict-match result at 0.90 uses the same small, correlated, already-scored dataset and covers less than one-third of requests. It is post-hoc and cannot support a production rule. The separate three-case exact-handle smoke had one answer independently judged direct-answerable at confidence 0.42; that sample also supports no cutoff in either direction.

## Case-level audit of the historical labels — 2026-10-04

A read-only Luna audit of the bilingual records found attribution limits that the
aggregate strict-heading score hides:

- The direct run offered 200 headings. A miss against its single preferred
  heading is a selection/label disagreement, not evidence that retrieval omitted
  the target.
- The hierarchical run logged 200 initial candidates and four final candidates,
  with three calls per request, but did not retain each stage's finalist set. Its
  misses cannot be assigned to early pruning versus final selection.
- Exact fetch success verifies handle integrity only. It does not establish
  relevance, answerability, sufficiency, or citation coverage.
- Cases 08, 16, 17, 22, 25, 27, 28, and 30 may be strict-target false negatives:
  a parent, child, sibling, or alternate range could answer the question. Case 23
  looks like a stronger semantic-miss candidate, still pending owner review.
- English/Spanish disagreement appears in cases 06, 21, and 27. Strict misses
  with high raw confidence include direct cases 17 and 22, and hierarchical cases
  13 and 25; some remain label-ambiguous.

These are audit leads, not corrected labels. The owner worksheet remains blank.
Do not relabel records from this review, infer calibration from these rows, or tune
a threshold before acceptable-range, sufficiency, and abstention labels are
adjudicated. The 0.2.104 selector-echo smoke is documented separately in the
suite README and its evidence receipt; it does not resolve the historical labels.

## What is still missing for genuine calibration

- Accepted evidence is not a single preferred heading. An owner must label every acceptable exact range, answerability, whole-query sufficiency, expected abstention, and contradiction/temporal/scope class. The separate owner worksheet has 32 bilingual concept pairs, 38 proposed citations across 28 unique source paths, and 32 blank owner-label blocks. Its 30-file source manifest includes two files not cited by a proposed range. No labels are gold yet.
- The old 52-row corpus has 26 concepts across 21 documents. Related-source and concept clusters, not translations, define independence. The prior grouped holdout was opened during tuning; do not treat it as an untouched test set.
- Noul/evidence-sufficiency is a different target from exact-heading match. There are no owner-adjudicated sufficiency labels, so no Noul Brier score or sufficiency threshold is valid.
- The archived 80k live probability-distribution smoke stores only a distribution hash and one unlabeled response, not the ordered map needed to reconstruct multiclass Brier/log loss. The 52-request old runs do not retain per-request Choice maps. Therefore multiclass calibration cannot be recovered from those records.
- These results predate MSSR 0.2.104's atom-derived Bibliotecario path. They do not measure metadata retrieval benefit, contradiction handling, synthesis, compaction, or cited-paragraph fidelity. The 0.2.104 product contract records per Choice call the offered option order, selected option, probability map or explicit null, raw confidence, Noul and provenance; this supports better future observation but supplies no labels by itself.

## Next evaluation design

1. Keep deterministic candidate recall and metadata retrieval separate from Jev's conditional selection. Freeze product/source revisions, exact candidate ranges and per-call ordered probability maps. Preserve explicit nulls for absent distributions.
2. Have the document owner adjudicate acceptable-range sets, answerability, sufficiency, abstention and relevant contradiction/temporal labels without seeing provider outputs. Hash the labels separately and keep them out of requests.
3. Partition by project/document/source lineage and related concepts. Keep English and Spanish for one concept in the same split. Use a development split to choose any calibration method; lock it before opening a genuinely untouched project/document holdout.
4. Evaluate Choice distribution against accepted-range mass and accepted-selection correctness; report multiclass Brier/log loss and reliability with cluster-aware uncertainty. Evaluate Noul separately against owner-labeled evidence sufficiency. Report abstention precision/recall and risk-coverage as separate outcomes.
5. Treat exact fetch/citation integrity, semantic sufficiency, contradiction review, confidence, and host authorization as separate gates. Confidence never overrides source provenance, exact revision/fingerprint, scope/time conflicts, or permission boundaries.

**Decision:** historical confidence is descriptive only; no calibration claim or numeric production threshold is adopted. A new provider run remains behind a reviewed immutable receipt and the exact START_JEV gate.
