# Cross-project source-disjoint Librarian/Jev development cohort

## Purpose

Run a bounded, real-document development diagnostic on four independent project families. Measure exact lexical retrieval, Jev range selection or abstention, exact fetch/evidence-pack integrity, evidence compaction, and host paragraph composition as distinct stages. Include English and Spanish versions of one question per family.

This is not a certified holdout: the local experiment ledger (Runs 1–44) contains no matching source title, full body fingerprint, or distinctive target phrase for the selected documents, but exposure outside that ledger cannot be ruled out. Labels are analyst-derived from the frozen source text and have no document-owner adjudication. Do not use the results as production reliability or confidence calibration.

## Frozen source set

Four tracked Markdown documents from four separate repositories are snapshotted under `sources/`. Each target file was clean in its repository at freeze time. Three repositories have unrelated dirty working-tree paths; those paths are not included. See `manifest.json` for exact source commit, target-file hash, and worktree status.

## Cases and stages

`inputs/cases.json` contains 16 single-query cases: 12 answerable positive cases and four nearby source-negative cases, including four English/Spanish pairs that share four semantic facets. `inputs/labels.json` contains acceptable source ranges, narrow supporting line spans, or abstention labels. A second analyst independently checked all ranges and confirmed the negatives; the labels are still not owner-adjudicated. Labels are never passed to retrieval or Jev.

For each case:

1. Run deterministic MSSR Librarian search on that repository's one explicit Markdown source with metadata disabled. Record result order, exact handles, and whether an acceptable source range is in the candidate pool. This is the retrieval metric.
2. Give Jev only the frozen query, selected source path, and the exact handles returned by that search. Record abstention/selection, option distribution when supplied, provider/model, latency and usage. A missed retrieval target remains a pipeline miss; do not silently add it to the candidate pool after seeing the result.
3. For selected cases, revalidate with exact Librarian fetch and build the cited evidence pack from the same snapshot. Record these integrity results independently of relevance.
4. After calls are frozen, perform the nested-range compaction control and prepare short evidence-cited paragraphs. Send unlabeled source evidence and draft answers to a blind reviewer; semantic answer coverage is scored independently from exact range, fetch integrity, and pack compaction.

## Execution note

The live TypeSafe Jev provider was `typesafe-jev` / `jev-1.13.0`. The Bridge adapter served GodotAtlas, Kode, and Electronics Repair Simulator. Elemental Frontier's Bridge project context was health-gated because its project-identity core exceeded the configured budget, so that source used the portable MSSR search/select/fetch/pack path against the same frozen snapshot. This preserves the pipeline-stage observation but does not count as a Bridge source-adapter test for Elemental Frontier.

The four source snapshots matched their manifest SHA-256 and byte counts. All 14 Jev receipts contain exactly the IDs in their corresponding frozen search pools. The eight selected handles were revalidated by exact fetch and included in one-citation evidence packs. The derived script and report verify and summarize these observations; raw provider receipts and frozen labels remain unchanged.

The exact host-composed paragraph bodies were not preserved with the raw receipts before blind review. The review verdict is retained as a manual-review record, but the prose itself cannot be replayed text-for-text from this run package.

After provider calls, the derived checksum index locks the bytes for every frozen input, source snapshot, and raw receipt for later replay. It is a post-call integrity checkpoint, not pre-call attestation and not evidence that the provider did or did not see labels.

No query metadata filters, automatic query translation, automatic query decomposition, confidence thresholds, or source/runtime changes are part of this cohort. The English/Spanish questions are separately authored and remain paired observations, not independent samples.

## Compaction and composition controls

Use the Electronics Repair Simulator `Layer model` parent range and one exact child range as a deterministic containment control. Compare `dedupeContainedRanges=false` with `true`; this measures text-volume reduction and citation retention only. It does not demonstrate semantic summarization or that one range covers every requested facet.

Compose four short paragraphs from exact selected evidence, with source citations. Keep each family/paragraph independently identifiable. A blind reviewer receives only the query, fetched text and draft response, not the expected heading/range or source-negative label. Report answer coverage and overbreadth separately.

## Metrics

- Search: answerable target present in top 1/5/10, candidate-pool recall, negative candidate presence.
- Jev: exact accepted-range selection, supporting-span coverage and selected-range overbreadth, negative abstention, and paired English/Spanish agreement. Report raw Choice/Noul values descriptively only. Count the four bilingual pairs as paired conditions, not eight independent facets.
- Acquisition: exact fetch/fingerprint pass rate and evidence-pack integrity pass rate.
- Compaction: fetched character count before/after deterministic contained-range removal, retained citations, and declared omissions.
- Composition: blind answer completeness, citation support, and irrelevant overbreadth.

Report raw counts and per-family results. The sample is too small for calibration, confidence intervals that imply general reliability, or production claims.
