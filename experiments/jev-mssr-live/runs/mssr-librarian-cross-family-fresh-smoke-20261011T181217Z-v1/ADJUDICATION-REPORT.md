# Cross-family fresh-source diagnostic — 2026-10-11

## Frozen setup and provenance

- Three one-query cases over three separately owned Markdown source documents in MSSR.
- Bridge release adapter: 0.6.169 / packaged MSSR 0.2.121; Jev `jev-1.13.0`.
- Run manifest SHA-256: `c137b88c28b566fc23f5976fa6574168f038bf61867be9e3778294cc94f45cbf`.
- Execution window from request events: 2026-10-11 18:14:29.944–18:14:32.408 UTC.
- Source paths and exact byte hashes are frozen in `manifest.json`; no matching path or distinctive answer phrase was found in persisted experiment artifacts or reachable experiment history. This cannot establish that provider-side context was never exposed.
- Queries and source-derived answer labels were frozen before Jev calls. A separate Luna reviewer examined the exact fetched text after execution without seeing Jev scores or those labels.
- The first `--allow-network` invocation failed preflight because the manifest's authorization-method wording did not match the runner's required literal. This was corrected while the manifest was still `prepared`; the corrected dry-run passed, and the failed preflight made no provider request.

## Results

| Case | Jev raw Choice confidence | Exact fetch / evidence pack | Blind text review |
| --- | ---: | --- | --- |
| ChatGPT Web re-plan phases | 0.48 | passed / passed, 388 chars | Complete; some extra caller, Bridge, and route/bootstrap details |
| Telemetry epoch boundary | 0.95 | passed / passed, 333 chars | Complete; also includes the separate database-reset rule |
| New/renamed skill stability | 0.58 | passed / passed, 450 chars | Complete; surrounding audit and contamination-check guidance adds context |

All three queries selected the expected source section. Normalizing the returned display title by removing the Markdown heading marker yields 3/3 exact target sections; the same targets appeared in search results 3/3. Exact fetch fingerprints matched 3/3 and evidence packs built 3/3. The machine-generated `summary.json` reports 0/3 heading matches and target recall because its frozen runner compares expected headings with `#` against returned titles without `#`; that strict formatting mismatch is a scorer defect, not a Jev selection miss. Preserve the original summary and consult this derived correction.

The runner also retained static text from its five-document/ten-request template in the summary's `independentUnits` and `limitations`. The mechanically derived `summary-calculated.json` correctly reports three source-document clusters, three requests, three selections, three exact fetches and three evidence packs. It is the authority for counts; the stale template text is not.

Jev returned Choice confidences of 0.48, 0.95 and 0.58. The raw runner records `noul:null` for all three cases because it reads `selected.noul`/`selected.sufficiency`, while the MSSR contract publishes the numeric field as `evidenceSufficiency`. The selector's successful results require a Noul answer, so these nulls are a recorder data-loss gap, not evidence that Jev omitted Noul. The raw call response was not persisted, so the three numeric values cannot be recovered. The follow-up summarizer flags this gap. Choice values remain descriptive and uncalibrated; three cases cannot set a threshold or establish reliability. The three files are separate document clusters for this small diagnostic, but share one repository, authoring process, provider and adapter.

## Adjudication limits

The reviewer found each excerpt answerable and complete, with varying amounts of adjacent but accurate context. The boundary between focused and overbroad needs a separately frozen rubric before scoring in future cases. These are model-assisted labels, not project-owner adjudication or an independent population. Do not treat exact fetch integrity as semantic correctness. No production behavior or confidence threshold changed.

## Integrity

`manifest.json`, `runner.mjs`, raw `records.jsonl`, `request-events.jsonl`, `run-completion.json`, `summary.json`, and the original `SHA256SUMS` remain unchanged after the live call. This report and `summary-calculated.json` are derived artifacts; their hashes are listed separately in `DERIVED-SHA256SUMS`.
