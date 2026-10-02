# MSSR Librarian Jev excerpt-window live smoke

- **Run:** mssr-librarian-jev-excerpt-window-smoke-20261002T180139Z-86070e-v1
- **Build:** mssr-build:sha256:86070e2a0e734090 (MSSR 0.2.99; active MCP readback was current)
- **Classification:** one-case live integration smoke; not a benchmark or quality score
- **Source:** `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md`, one exact caller-supplied snapshot, project metadata
- **Query:** see frozen `inputs/cases.json`; no expected answer or label was supplied

## Observation

Deterministic Librarian search returned 10 results and offered its top 6 exact handles to Jev. The real TypeSafe Jev provider (`jev-1.13.0`) made 1 call and selected `Librarian retrieval and evidence acquisition` (section, lines 67–106), ranked 2 by deterministic search. Raw choice confidence was 0.88; Noul evidence sufficiency was 0.72; both remain uncalibrated/descriptive. Usage was 1419 input / 107 output tokens; provider-reported tool latency was 488.7 ms.

Exact fetch returned success from the same Markdown snapshot. The fetched fingerprint matched the selected handle (a2569e6a6fd9ad7a46a6f1a4b7633cd8d0c9501d0ca04ba527ee0be2404ff611).

## Interpretation limits

This shows the active 0.2.99 MCP selector/provider/fetch path works for this one query and snapshot. The selected range was also the second-ranked deterministic-search result, but there was no frozen expected-range set or independent adjudication; that is not an accuracy claim. The separate deterministic regression test exercises the excerpt-window defect directly. This live smoke passed no atom/catalog inputs and cannot establish atom-search coverage, general selection quality, bilingual performance, calibrated confidence, or a production threshold. The run stores the frozen source snapshot and bounded lexical snippets; it does not store fetched section text beyond that snapshot, raw provider bodies, or credentials.
