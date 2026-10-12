# Run report — prospective citation precision in host composition

## Scope

Run54 is a prospective host-side composition follow-up to Run52/Run53. Before the writer was invoked, the run froze two questions, two exact evidence packs revalidated by Bridge against the current source revisions, a writer prompt, and a blind review plan. One fresh GPT-6 Luna writer composed Spanish answers. No Jev calls were made.

The two source clusters were already used in Run52: publication restart guidance and incident-recording guidance. This is not an independent source holdout.

## Result

Both blind Luna reviewers independently rated both answers fully supported, complete, concise, citation-exact, and usable (4/4 case-review judgments). Neither found an unsupported claim or missing material. The writer used four supplied citations, each to the narrow exact range selected for its claim.

The exact evidence text totals 718 UTF-16 characters. The composed answers total 1,179 characters including citations (64.2% longer than the evidence text), or 874 after removing citation strings (21.7% longer). This run therefore did not demonstrate compression. The increase is consistent with rendering the source fragments as complete Spanish prose while retaining explicit citations; these counts are descriptive string lengths, not token usage.

## Interpretation and limits

This small example supports a narrow observation: a host writer can produce complete Spanish answers with exact citations from prevalidated ranges in these two cases. Reviewer agreement is model-assisted, not human adjudication or owner-gold. Both reviewers came from the writer's model family. There was one writer output per question, no independent source cluster, no controlled baseline, no Jev selection or fetch call, and no calibration target.

Do not infer general citation reliability, Librarian retrieval reliability, semantic-compaction quality, token savings, or a calibrated confidence score from this run. No runtime, routing policy, threshold, or production behavior changed.

## Next useful experiment

Use new source clusters with owner-checked required facts and exact acceptable citation ranges. Compare exact-pack passthrough, deterministic citation handling, and host composition. Have a human or independent-model adjudication identify unsupported claims, omissions, citation span fit, and abstentions; report output size separately from factual and citation quality.
