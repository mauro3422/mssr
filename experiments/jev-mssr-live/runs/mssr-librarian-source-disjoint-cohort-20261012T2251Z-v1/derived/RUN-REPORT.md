# Run 63 — fresh-source Jev Librarian cohort

**Run:** `mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1`
**Date:** 2026-10-12
**Provider:** TypeSafe Jev 1.13.0 through connected Bridge MCP
**MSSR metadata:** off; exact sourceRefs; no query variants
**Production/runtime changes:** none; no thresholds changed

## What was measured

Six Spanish/English questions used three exact Markdown sources in three project roots. Three questions were labeled answerable and three unanswerable by two source-only reviewers before provider calls. These are analyst judgments, not repository-owner gold. Exact source paths were absent from the local Jev run ledger, but all three project families had prior exposure; this is source-path-disjoint, not a certified project-disjoint or globally unseen holdout.

Only handles returned for each exact search query could be offered to Jev. Zero search candidates meant `not-run`, never implicit whole-document fallback. Candidate ranges containing machine-local path/network details were excluded before provider calls. The full review packet v2 gave blind reviewers the complete offered range text, not truncated snippets.

## Results

| Case | Search pool offered to Jev | Jev | Source-only adjudication |
| --- | --- | --- | --- |
| A1 — Spanish Godot question | 0 candidates | Not run | Answerable from the source; retrieval miss. No Jev decision to score. |
| A2 — maximum edge crossings | 12 safe candidates, including the complete source parent | Abstained; Choice 0.99, Noul 0.03 | No edge-crossing maximum is specified. The source's `overlap_count: 0` is a different metric; abstention correct. |
| B1 — NeoPSE Gemma comparison | 9 safe candidates; exact table `block-21`, lines 88–91, was offered | Abstained; Choice 0.50, Noul 0.13 | False abstention despite exact evidence in the candidate pool. |
| B2 — WR CPU historical P95 | 9 safe candidates; historical table was absent from the pool | Abstained; Choice 0.91, Noul 0.08 | The source does not report WR CPU P95; abstention correct. |
| C1 — real NeoForge batch | 8 safe candidates | Selected `block-2`, lines 6–17; Choice 1.00, Noul 0.94 | Sufficient: exact answer is in row 10 (13 sessions, 750 model samples, 18,000 parts per stage, 39 authentic PNGs). Selected range is broader than the minimum row. |
| C2 — visual mesh penetrations | 5 safe candidates | Abstained; Choice 0.96, Noul 0.04 | No visual mesh-penetration count exists in the source; physical collisions are not equivalent. Abstention correct. |

Two blind quality reviewers independently confirmed the A2 distinction and the B1 miss. A third blind reviewer made a documented A2 metric-confusion error; the exact source lines and the other two reviews resolve it. See [adjudication](BLIND-REVIEW-V2-ADJUDICATION.md) and the three preserved raw reviews. The pre-provider labels and their original span corrections remain separate.

## Aggregate

- Search target present: **2/3 answerable questions** (A1 missed; B1 and C1 present).
- Positive selection after a target was offered: **1/2** (B1 false abstention; C1 selected).
- Unanswerable questions abstained: **3/3**.
- Correct Jev dispositions among calls: **4/5**; the fifth is B1. A1 is excluded from this denominator because Jev was not called.
- Selected range sufficient: **1/1**, though broader than the minimum row.
- Exact fetch and citation/evidence pack: **1/1** for selected C1.
- Jev calls: **5**; input tokens **8,447**, output tokens **653**, summed provider elapsed time **4.0363 s**.

The raw Choice/Noul fields are provider outputs, not correctness percentages or calibrated confidence. This small sample cannot estimate reliability or justify a threshold. Search recall and Jev selection show distinct failure modes: A1 failed before Jev because retrieval returned nothing; B1 reached Jev with the exact table and was still declined.

## Evidence transport and run-quality notes

C1 exact fetch plus evidence pack preserved the selected Bridge range unchanged (2,037 characters; citation `docs/MINECRAFT_REFERENCE_DATASET_INDEX.md:L6-L17`). The first pack attempt was rejected as stale for the caller-provided source revision. A retry using exact UTF-8 bytes from Bridge `read_text_file` passed. The receipt does not establish the stale attempt's cause, so this remains a diagnosed retry rather than a confirmed product defect or confirmed caller-representation bug. Both attempts are preserved.

Two v1 blind reviews were invalidated because the packet showed truncated snippets rather than full candidate ranges; their outputs and erratum remain preserved and were excluded. Packet v2 corrected that review defect. The untracked package audit also found local-path text in two snapshots; exact candidate ranges containing such strings were filtered from Jev. No local source file changed.

## What this says and next experiment

The Librarian pipeline can preserve and cite an exact fetched range, and Jev abstained on the three absent-answer questions in this packet. It is not consistently selecting answerable evidence: one exact positive range was declined, and one Spanish query did not retrieve its answer. Calibrating the score alone would not fix both layers.

Next, compare Spanish-only against a host-supplied English query variant on the same source snapshots and fixed candidate budgets, score retrieval recall separately from Jev selection, and exact-fetch/pack every selection. Expand to project-grouped, owner-adjudicated cases before using the output as a reliability or confidence claim. Keep metadata/atom discovery and this retrieval experiment separate so their effects are identifiable.

## Frozen-input note

The pre-call manifest remains immutable. Its awaiting-provider status and zero call count describe the frozen checkpoint; see [post-call erratum](POSTCALL-ERRATUM.md). The checksums cover the full run package except the checksum file itself.
