# Blind quality review v2 — adjudication

Run: `mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1`

Three fresh reviewers assessed the complete candidate-range text in packet v2 without Jev scores, outcomes, or pre-provider labels. Luna C and Luna D independently agreed on all six answerability dispositions and the Jev assessment. Luna B agreed on five cases but made a specific metric-confusion error on A2. The two-reviewer agreement is not owner-gold.

## A2 resolution

Question: “What maximum number of edge crossings is required to pass the audit?” The source lists `overlap_count` and `edge_crossings` as separate measurements (snapshot lines 30–31). Its suggested zero gate is explicitly `overlap_count: 0`; it declares no maximum for `edge_crossings` (lines 94–100). The complete source parent was among Jev's 12 safe candidates. Therefore A2 is unanswerable as phrased, and Jev's abstention is appropriate. Luna B's contrary interpretation conflated the two metrics; this reviewer error remains visible in `raw/blind-quality-luna-b-v2.md` rather than being overwritten.

## Case-level consensus used in the report

| Case | Source answerable? | Target evidence in offered pool? | Jev outcome | Adjudication |
| --- | --- | --- | --- | --- |
| A1 | Yes | No; search returned zero | Not run | Retrieval miss; not a Jev decision |
| A2 | No | Full source parent offered, enough to see no edge-crossing threshold | Abstained | Appropriate abstention |
| B1 | Yes | Yes; exact table lines 88–91 offered | Abstained | False abstention / selector miss |
| B2 | No | No historical WR CPU P95 in the source or safe pool | Abstained | Appropriate abstention |
| C1 | Yes | Yes; selected range includes exact row 10 | Selected | Sufficient, but broader than the minimum row |
| C2 | No | Yes; source explains the requested count is absent and view is pending | Abstained | Appropriate abstention |

The pre-provider source-only labels had already agreed on A1/B1/C1 answerable and A2/B2/C2 unanswerable. They remain analyst labels, not labels adjudicated by repository owners.
