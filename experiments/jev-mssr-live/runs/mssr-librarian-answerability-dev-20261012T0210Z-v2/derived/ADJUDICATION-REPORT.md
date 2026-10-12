# Jev Librarian answerability cohort v2 — result and limits

## Scope and provenance

Ten live Jev 1.13.0 requests were run through the local Bridge release module identified as Bridge 0.6.172 / MSSR 0.2.127. They cover five linked source-document clusters, each with one positive and one source-scoped negative query. The frozen manifest identifies the local adapter; the packet does not prove which separate connected MCP process served a call. All ten requests completed, and the five selections passed exact fetch, fingerprint, and evidence-pack checks. Usage was 30,279 input and 2,415 output tokens.

Labels were proposed and source-checked by one Luna reviewer; they are not owner-gold or independent adjudication. One additional blind Luna quality review read only `BLIND-REVIEW-INPUT.json`; see [`BLIND-REVIEW.md`](BLIND-REVIEW.md). That review is also model-assisted, and neither review calibrates Jev confidence.

## Results

- **Answerability disposition:** 5/5 source-labeled answerable queries were selected and 5/5 source-labeled unanswerable controls were abstained. The corrected derived scorer reports 10/10 disposition decisions for these ten labeled cases. This is not a population reliability estimate.
- **Range precision:** 4/5 selections matched the exact pre-labeled range. The expected heading appeared in search 5/5, while the exact expected range appeared 4/5.
- **Evidence integrity:** all five selected ranges exact-fetched with matching frozen-source text/fingerprints; all five evidence packs validated.
- **Q09 radar case:** Jev selected lines 239–279 (1,212 characters) where the query's exact ordered trace is at lines 251–257. The blind reviewer found the answer complete and direct, with high overbreadth. The selected range is outside the frozen exact/relevant labels; its semantic usefulness is therefore **ungraded by the range labels**, rather than assumed irrelevant or silently added to the labels after the call.
- **Raw scores:** positive selections had Choice/evidence-sufficiency values `0.76/0.91`, `1.00/0.91`, `0.92/0.95`, `0.58/0.42`, and `0.48/0.68`; negative abstentions had `0.87/0.08`, `0.98/0.06`, `0.97/0.06`, `0.74/0.10`, and `0.81/0.07`. These are descriptive, uncalibrated values. The overlap and the broad low-Choice positive are further reasons not to set a threshold from this cohort. Noul was not captured in the records.

## Measurement correction

The original `summary.json` remains frozen. Its original `decisionCorrect` calculation conflated “select when answerable / abstain when unanswerable” with exact or pre-labeled relevant range quality, so the broad-but-answer-bearing Q09 range reduced the former score. The experiment summarizer and runner now report answerability disposition separately from exact, relevant-labeled, and outside-labeled range outcomes. The derived [`summary-calculated.json`](../summary-calculated.json) is the recalculation; `outside-labeled-ranges` means only that the selected range did not match the frozen precision labels. It does not assert semantic irrelevance. No frozen provider output, manifest, source snapshot, case, or label was edited.

## Limits and next gate

Five source clusters are descriptive and do not establish independent statistical sampling. This cohort evaluates selection/abstention and exact evidence acquisition. It does not test Jev-generated paragraphs, multi-query union, compaction, contradiction resolution, confidence calibration, or production adoption. The next quality iteration should use more owner-adjudicated, document-diverse cases and separately label exact targets, acceptable contextual ranges, and overbreadth before provider calls. A future composition cohort should separately judge citation coverage and paragraph quality while retaining the verbatim source trail.
