# Current-release cross-family diagnostic — 2026-10-11

- **Run:** `mssr-librarian-current-release-cross-family-20261011T2247Z-v1`
- **Frozen manifest SHA-256:** `63895b3bcc7e3bccebd768601b4fa95a46b30fc5ae22a96a77b8ade079c2728a`
- **Source revision:** MSSR `460c3d00ae3ca44199b1aa296349ceb6a942ca63`
- **Runtime under diagnostic:** Bridge release module `0.6.172`, MSSR `0.2.127`, Jev `1.13.0`

## Result

The live Jev path completed all **3/3** requests. Each target appeared in search, Jev selected the expected source heading, exact fetch and fingerprint checks passed, and the evidence pack was built. The blind Luna reviewer found all three excerpts complete and directly supported, with no missing or unsupported facts; one digest excerpt included moderately overbroad adjacent context. See the separate [blind review](BLIND-REVIEW-20261011.md).

| Case | Source cluster | Expected heading | Choice score (raw) | Exact fetch | Pack |
|---|---|---|---:|---|---|
| `digest-hard-bound` | `changelogs/0.2.127.md` | `Behavior` | 0.70 | pass | pass |
| `retained-context-receipt` | `docs/decisions/0008-context-economy-v2.md` | `Decision` | 0.66 | pass | pass |
| `shadow-verification-sequence` | `docs/HANDOFF_SEMANTIC_EXPERIENCE_LAYER_2026-09-29.md` | `Goal` | 0.93 | pass | pass |

The three calls used 24,070 input and 1,821 output tokens. Raw Choice scores are descriptive and uncalibrated. Numeric `evidenceSufficiency` and Noul are absent from all three records; treat that as a measurement/capture gap, never as zero. The complete mechanical summary is [summary-calculated.json](summary-calculated.json).

## Sources and exposure review

The packet contains byte-frozen snapshots of the three public MSSR Markdown sources above. The changelog body and distinctive behavior did not appear in the reviewed 48-run artifact set. ADR 0008 had only a topic/link mention there, not its body or an exact range. The historical semantic-experience handoff had no path or body hit in that local run set. These bounded checks do not establish model-level non-exposure.

Targets were manually mapped from MSSR headings and explicit authored statements. They were not independently adjudicated by the project owner. Three source refs are three descriptive clusters; they are not sufficient evidence for generalization, reliability, or calibration. This was not a statistical holdout.

## What this did and did not exercise

This case set checked search → Jev selection → exact fetch → evidence-pack construction over three source families. It did not test relation review, contradiction detection, synthesis, automatic query decomposition, or production policy. No confidence threshold, runtime behavior, or adoption policy changed.

The exact run interval was `2026-10-11T22:49:16.305Z` through `2026-10-11T22:49:20.302Z`. The frozen runner output includes copied static text for five documents/ten requests and Bridge 0.6.169 / MSSR 0.2.121. It is incorrect for this packet; the append-only [erratum](RUN-ERRATUM-20261011.md) records the corrections without rewriting frozen evidence.

## Evidence integrity

The original `SHA256SUMS` and all frozen payloads remain unchanged. The mechanical summarizer verified the original checksum index (11 entries). `DERIVED-SHA256SUMS` covers the derived report, blind review, erratum, and mechanical summary. The manifest remains `prepared` because it is the immutable pre-call freeze; `run-completion.json` records the execution as `complete`.
