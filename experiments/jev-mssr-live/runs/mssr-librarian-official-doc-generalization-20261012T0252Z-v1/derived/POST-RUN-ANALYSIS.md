# Post-run adjudication — official-doc generalization

- **Run:** mssr-librarian-official-doc-generalization-20261012T0252Z-v1
- **Prepared:** 2026-10-12
**Status:** additive post-run analysis; the frozen manifest, labels, requests, records, and raw summary were not edited.

## Scope

The run sent 16 requests to the live Jev-backed MSSR Librarian against eight pinned official Markdown documents from four upstream repositories. It contains eight answerable and eight intentionally unanswerable queries, all in English. The source snapshots and release artifacts are fingerprinted in the run packet. Labels were frozen before the calls and were not sent to Jev.

This measures document selection, abstention, exact-handle fetch, and evidence-pack construction on public documentation. It does not measure MSSR project metadata or atoms, contradiction learning, synthesis, or host paragraph composition. The 16 requests are paired across only four repository families; they are not 16 independent samples.

## Frozen run results

- 16/16 requests completed; 0 provider failures.
- Unanswerable queries: 8/8 correctly abstained; 0 false selections.
- Answerable queries: Jev selected in 8/8 cases.
- Exact-handle fetch and evidence-pack validation: 8/8 passed, with source fingerprints intact.
- Frozen strict score: 1/8 answerable selection correct, 0/8 predeclared relevant-range matches, and 9/16 total decisions correct (56.25%).
- Token usage: 221,969 input and 12,868 output tokens.
- Confidence and Noul remain descriptive and uncalibrated. This run does not support a production confidence threshold.

The low frozen positive score combines scorer-boundary problems with one real evidence-selection miss:

| Positive case | Frozen expected span | Jev-selected span | Frozen strict result | Blind excerpt review |
|---|---:|---:|---|---|
| TypeScript discriminated unions | 658 | 657–658 | mismatch | Direct, sufficient |
| TypeScript array forms | 31–32 | 29–36 | mismatch | Direct, sufficient |
| Rust RefCell runtime checks | 34–36 | 33–36 | mismatch | Direct, sufficient |
| Rust Mutex access rules | 37–39 | 37–39 | exact | Direct, sufficient |
| Node fs.readFile | 4543–4544 | 4543–4544 | heading-markup mismatch | Direct, sufficient |
| Node process.exit | 1821–1823 | 1821–1823 | heading-markup mismatch | Direct, sufficient |
| GitHub workflow permissions | 354 | 352–355 | mismatch | Direct, sufficient |
| GitHub default labels customization | 56 | 39–50 | wrong evidence span | Partial; misses the customization statement |

The scorer's field named exactHeadingMatches is stricter than its name suggests: it requires matching source, normalized heading, and identical start and end lines. Its heading normalization does not remove Markdown inline-code markers. That rejects the two Node cases despite exact selected line spans. Exact endpoints also reject four spans that contain the labeled answer and were independently judged sufficient in a blind Luna review. These are scoring/label-boundary disagreements, not proof that Jev failed to retrieve those answers.

A separate, post-hoc containment check found that 7/8 selected Jev spans contain the frozen accepted line span. This sensitivity result agrees with the blind review's 7/8 direct/sufficient assessment, but it is model-assisted and is not a replacement for the frozen score or human gold labels. The GitHub labels case is a real miss: Jev selected the list of default labels and omitted the nearby statement that organization owners may customize them. The search output surfaced the answer-bearing area, but Jev chose an incomplete block.

The frozen search-target metric is 3/8 under the runner's exact heading-and-range comparison. The two Node heading-format mismatches also affect that metric. Do not revise the frozen number; a future scorer should separately report exact block match, heading-normalized match, and accepted-span containment.

## Interpretation and next iteration

This is encouraging evidence that Jev can abstain on scoped unknowns and return fingerprint-valid evidence from several public document families. It is not evidence that the full metadata-rich MSSR workflow has been validated, nor that Jev's confidence predicts correctness. The end-to-end contract still needs separate evaluation of search recall, chosen-span sufficiency, exact fetch, evidence packing, and any later synthesis.

For the next run, keep this packet immutable. Fix the scorer in a new run version to normalize Markdown heading markup and report exact match separately from accepted-span containment. Freeze answerable spans against the actual source blocks, allow multiple independently reviewed acceptable ranges, and retain hard negatives. Add a separate cohort of MSSR system documents with their real metadata/atoms and test contradictions and synthesis as distinct stages. Use fresh holdout documents for confirmation; do not tune on these same eight positives and call the result confirmatory.
