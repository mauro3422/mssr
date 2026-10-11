# Historical MSSR live Bridge/Jev smoke — 2026-10-11

The evidence in this report records Bridge 0.6.167 / MSSR 0.2.115 and must not be read as a current runtime readback.

## Scope and method

One read-only live smoke used Bridge 0.6.167 / MSSR 0.2.115 against `docs/decisions/0009-semantic-evidence-plane.md` (source revision `63bac32774a54bdb8e7a5dd6021fa3f0351e491c6475cbb6745ce4c1e05ed2ad`). Search was lexical-only (`metadataMode=off`) for the question: “What does EvidenceAtom v2 require for freshnessEvidence to be structurally consistent, and what does that not prove?” Search returned eight exact-fetchable candidates.

The live Jev provider (`typesafe-jev`, model `jev-1.13.0`) made one call and selected `heading-4` (“1. Common evidence atom”) from eight candidates. Provider confidence was `0.79`; evidence sufficiency was `0.44`. Both are explicitly uncalibrated provider scores. The call used 1,806 input and 127 output tokens and took about 1.03 seconds.

## Exact-fetch review

Bridge fetched the selected range at lines 28–63, offsets 2,082–4,048, source revision above, fingerprint `3011bc7f729130c60359bb6167921b35642ee5e4a26a67296596927609269c94`. The returned section states that a `fresh` label requires a caller-supplied assertion matching canonical owner, normalized ref, and revision, with an observation timestamp. It says validation checks consistency only; it does not authenticate the host or independently prove that the observation occurred.

The fetched text directly supports both parts of this query. This is a source-derived manual review of one case, not owner-gold, blind adjudication, holdout, or a calibration point. It does not estimate retrieval accuracy or justify a score threshold.

## Reproducibility

The full receipt, including the exact fetched text and candidate summary, is stored outside the repository at `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-mssr-live-bridge-smoke-20261011-v1\receipt.json` (SHA-256 `97b121fe9e68bea28569bdc983cdeec627265791938ba2a6065e75cfcead82fe`). This live Bridge smoke is separate from the offline baseline/candidate diagnostic.

## Bilingual abstention and range-precision follow-up

A follow-up on the same source revision used Bridge 0.6.167 / MSSR 0.2.115 and Jev `typesafe-jev` 1.13.0. These calls share one document and claim; they are correlated diagnostics, not independent evaluation cases.

The live runtime search schema accepts up to four explicit `queryVariants` in the nested query object. The dedicated ChatGPT connector schema omits that field; `bridge_tool_query` successfully passed it to the runtime. Search does not translate; it reports per-query lexical overlap and prioritizes primary-query matches. With a Spanish primary query and one English variant, the eight exact-fetchable results included `heading-4` and nested `block-11` at ranks 1 and 2. Each scored 0.083333 on the Spanish primary and 0.454545 on the English variant. These are lexical ranking values, not confidence.

| Query / options | Jev result | Raw provider fields |
| --- | --- | --- |
| Earlier English wording, eight candidates | selected `heading-4` | confidence 0.79; sufficiency 0.44; 1,806 input / 127 output tokens |
| Spanish wording, eight candidates | abstained (`none`) | confidence 0.73; sufficiency 0.19; 1,756 / 124 tokens |
| Spanish wording, same two candidates (`heading-4`, `block-11`) | abstained (`none`) | confidence 0.41; sufficiency 0.22; 860 / 64 tokens |
| English wording, same two candidates and order | selected `heading-4` | confidence 0.19; sufficiency 0.65; 823 / 67 tokens |

Two blind assessments received the Spanish question and exact passage without Jev's output. Both judged the passage complete, said abstention was not appropriate when it was offered, and preferred `block-11` as the minimum sufficient range. `heading-4` also answers the question but is broader. The exact paragraph fetch is lines 62–62, offsets 3,137–4,046, fingerprint `8b52f9321fd1b5ad3468a8b7533ce9c6d5f72ff41d46e235e8970fd96f13e9c9`; its text is recorded in the prior receipt and the original smoke report. The English selection was exact-fetched at lines 28–63, offsets 2,082–4,048, fingerprint `3011bc7f729130c60359bb6167921b35642ee5e4a26a67296596927609269c94` and contains the exact paragraph.

On the paired two-option comparison, changing only the query language changed Jev from abstention on Spanish to selection of the broader section on English. This is evidence of language-sensitive behavior in this single case, not an estimate of Spanish performance. The selected English range is correct but less precise; the Spanish abstentions are misses for this offered-candidate task. All scores remain uncalibrated, and blind adjudication of one source does not establish owner-gold or general accuracy.

Next: use source-grouped owner-labeled bilingual cases with fixed candidate pools. Compare Spanish-only, English-only, and host-supplied bilingual retrieval; compare Jev over identical handles; then exact-fetch and blind-adjudicate completeness and minimum sufficient span. Report abstention, false selections, range precision, facet coverage, and score calibration separately. Resolve the dedicated connector schema gap in its owning Bridge integration workflow before relying on variants through that connector.

One retry with malformed reconstructed fingerprints failed locally without calling Jev; subsequent comparisons used exact handles.

## Paired source-grouped development diagnostic — 2026-10-11

To extend beyond ADR 0009, four different canonical MSSR documents were searched with explicit Spanish/English variants. For each source, the same retrieved handles were offered to one Spanish and one English live Jev Choice call; selected ranges were exact-fetched and independently reviewed blind. These are four source groups within one repository, not four independent projects or owner-adjudicated labels.

| Source case | English | Spanish | Blind source/range review |
| --- | --- | --- | --- |
| Directional `supersedes` (`semantic-consistency-relations-retrieval.md`) | selected `block-2`, confidence/sufficiency .59/.27 | selected `block-2`, .76/.43 | Complete: left replaces right; no deletion/consolidation authority |
| Coverage and empty results (`document-surface-librarian-contract.md`) | selected `block-6`, 1.00/.87 | abstained, .57/.24 | `block-6` fully answers Spanish query; false abstention |
| Historical vs current truth (`semantic-consistency-current-truth.md`) | selected `heading-1`, .88/.79 | selected `block-3`, .84/.44 | Both answer; English section is broader |
| Sidecar metadata (`project-context-librarian-metadata.md`) | selected `block-4`, .34/.79 | abstained, .42/.45 | EN omits selector non-inheritance; whole doc answers ES but is broad. Minimum pair: `block-2` + `block-4`; pack retained both citations (1,214 chars), no synthesis. |

Across eight calls, six selected and two abstained. One selected range omitted a required facet despite Noul sufficiency .79; both Spanish abstentions had an offered answerable range. Scores are raw, uncalibrated provider outputs, not correctness percentages. This small within-repository diagnostic supports two follow-up gates: measure answer coverage by required query facet, and evaluate Spanish abstention separately from retrieval. It does not estimate general accuracy, justify a threshold change, or establish reliability. No runtime, code, or confidence policy changed.

The direct MSSR MCP provider `typesafe-jev` 1.13.0 handled these calls. The contemporaneous MSSR registry snapshot reported the MauroPrime Bridge provider unavailable (`MCP error -32000: Connection closed`), so this paired diagnostic does not verify the Bridge endpoint. Detailed request fingerprints, token usage, source revisions, and blind-review outcomes are in the separated artifact `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\paired-librarian-diagnostic-20261011-v1\RUN.md` (SHA-256 `7E0DAA5627BB7205BEBB61A37DFF5033D3E8E615F15076FB5D5594D36EF7B623`).
