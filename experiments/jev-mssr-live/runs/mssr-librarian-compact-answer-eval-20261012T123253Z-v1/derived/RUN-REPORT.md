# Run report — host composition and compact cited answers

## Scope

This is a separate, post-hoc exploratory follow-up to Run 52. One fresh GPT-6 Luna writer composed one Spanish answer for each of two exact evidence packs. No Jev calls were made. The review questions and exact inputs were frozen before two fresh Luna reviewers saw the cases; reviewers did not see labels, metrics, a baseline, or the writer method.

## Result

Both reviewers independently judged both answers fully supported, complete, concise, and usable, with good citation fit: 4/4 case-review judgments. Neither reported a missing material point or an unsupported claim.

The exact fetched source text totals 1,809 characters. The two answer bodies total 973 characters including citations, a descriptive 46.2% character reduction; excluding citation strings they total 894 characters (50.6% reduction). Counts use UTF-16 string lengths. They exclude source metadata and JSON envelopes and do not measure tokens.

The publication answer preserves the restart condition and all four follow-up checks. Its second citation spans L5-L12, broader than the specific checklist at L12; reviewers accepted it as supporting, but tighter citation selection is a useful next iteration. The incident answer preserves all four ledger destinations, required fields, and privacy exclusions.

## Interpretation and limits

This is evidence that a host can compose shorter, cited Spanish answers from exact Librarian packs in these two examples. It is not a controlled comparison against an uncompressed host answer, a token-cost measurement, a semantic-compaction benchmark, or evidence of general reliability. The writer output arrived before this review plan was frozen, so this is not a prospective writer score. The two source clusters were already used in Run 52; labels have no owner adjudication; the writer and both reviewers are model-assisted with no human gold review. Scores and confidence remain uncalibrated. No production thresholds, runtime behavior, or routing policy changed.

## Next useful experiment

Freeze a prospective writer prompt before generation, then compare (a) exact pack passthrough, (b) deterministic citation deduplication, and (c) host-composed concise answers on new source clusters with owner-checked labels. Score factual support, required-field coverage, citation precision, and UTF-16/token size separately; keep abstention and unsupported claims explicit.