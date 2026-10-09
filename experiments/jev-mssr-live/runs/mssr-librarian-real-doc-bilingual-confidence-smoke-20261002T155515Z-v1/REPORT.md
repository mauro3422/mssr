# Live real-document Jev selection smoke (exploratory)

- **Run:** `mssr-librarian-real-doc-bilingual-confidence-smoke-20261002T155515Z-v1`
- **Input source commit:** `1dca80d0ee37dc22c7530f1c56ba35914e999e47`; source Markdown matched that committed revision when supplied.
- **Provider:** TypeSafe Jev `jev-1.13.0`, through direct MSSR MCP selection/fetch tools.
- **Corpus:** two current MSSR architecture/evaluation Markdown documents for the first Spanish and English calls; one of those documents for the third Spanish call.
- **Purpose:** observe live selection consistency across Spanish/English and inspect confidence variation. No gold labels or new holdout.

## Results

All three selections chose the same exact range, `Confidence and merge policy` (`heading-5`) in `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md`. The Spanish and English calls shared the same two-document corpus; the later Spanish call used a narrower one-document corpus, so it is not an identical repeat.

| Language/scope | Provider confidence | Noul sufficiency | Input/output tokens | Latency | Exact fetch |
|---|---:|---:|---:|---:|---|
| Spanish, two documents | 0.79 | 0.69 | 3,073 / 217 | 577.7 ms | not attempted in this call |
| English, two documents | 0.49 | 0.72 | 3,069 / 217 | 259.9 ms | separate reread returned stale |
| Spanish, one document | 0.74 | 0.63 | 1,950 / 137 | 310.5 ms | passed, fingerprint matched |

The separately supplied fetch after the paired calls returned `Evidence handle is stale for the caller-provided source revision`. Repeating Spanish selection and exact fetch with one in-memory source snapshot succeeded and returned the same handle fingerprint. The cause of the first stale response is unresolved; keep it as transport/revision evidence rather than silently discard it.

The selected handle had source revision `f925226a…de92fb7` and range fingerprint `5d850910…bd4e0711`; successful fetch returned 3,277 characters with the matching fingerprint. Total provider usage was 8,092 input and 571 output tokens; mean provider-reported latency was 382.7 ms.

## Interpretation and limits

This confirms live Jev selection and one same-snapshot exact fetch over real MSSR documents. The shared selected range is a useful consistency observation, not correctness: no expected answer was preregistered or independently adjudicated, the third corpus differed, and overlapping ranges may also be useful. Confidence ranged from 0.49 to 0.79 for the same selected range across these different queries/scopes; neither that score nor Noul is calibrated for MSSR. Do not infer bilingual accuracy, a production threshold, or quality improvement.

The new 0.2.98 exact-atom metadata projection was **not** exercised: the direct selector call supplied Markdown only, and the MCP response did not identify its running MSSR build. Existing direct Bridge host atom delivery remains a separate integration gate. Provider raw bodies, source text and credential values were not persisted.

## Files

- `manifest.json`: input/source/tooling scope and limits.
- `inputs/cases.json`: exact Spanish/English queries and candidate corpora, without labels.
- `records.jsonl`: normalized selector/fetch observations; no raw provider response or fetched text.
- `summary.json`, `run-completion.json`: bounded counts and interpretation.
- `SHA256SUMS`: artifact integrity list.
