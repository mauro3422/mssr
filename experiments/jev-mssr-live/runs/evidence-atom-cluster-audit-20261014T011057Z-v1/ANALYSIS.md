# EvidenceAtom ablation: cluster-level reanalysis

- **Run:** `evidence-atom-cluster-audit-20261014T011057Z-v1`
- **Mode:** offline reanalysis; zero Jev/provider calls
- **Original live run:** `benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17`
- **Original source:** commit `dfb295653b2e3f0f2a6f0d25bb2bc5cbe9634962`, build `mssr-build:sha256:1f537b23769e1e6e`, Jev 1.13.0
- **Frozen packet:** `D:\Dev\mssr-snapshots\benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17`

The original run contains 153 successful provider calls: three representations (`text`, `parent`, `evidence-atom-v2`) over the same 17 section cases, repeated three times. Those repetitions are correlated observations, not 51 independent cases. The 17 sections come from only four parent-module clusters.

The analysis script rechecks every entry in the original `SHA256SUMS`, groups records by variant and case ID, compares action/lifecycle choices with the frozen labels, and checks its totals against the original summary. All eight source checksums matched. The labels were author-created, not independently adjudicated; the dataset had already been opened and used for tuning.

## Results grouped by the 17 sections

| Representation | Action correct calls | Action correct on all 3 repeats | Action decision stable | Lifecycle correct calls | Lifecycle correct on all 3 | Lifecycle decision stable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Text | 34/51 | 11/17 | 16/17 | 37/51 | 12/17 | 16/17 |
| Parent metadata | 45/51 | 15/17 | 17/17 | 51/51 | 17/17 | 17/17 |
| EvidenceAtom v2 | 48/51 | 16/17 | 17/17 | 45/51 | 14/17 | 15/17 |

EvidenceAtom v2 was descriptively better than parent metadata on the action label for one additional section, with one additional stable action decision. It was worse on lifecycle: three sections did not get all three labels correct, compared with none for parent metadata. This supports a task-specific effect from representation; it does not establish an overall winner.

“Stable” means the exact same choice was returned for a section in all three repetitions of that representation. “All 3 correct” means each repeated choice matched the author label. The source summaries remain authoritative for the per-call metrics; this packet adds the section-grouped view.

## Limits

- Four source-module clusters and 17 author-labeled sections do not satisfy the preregistered minimum of 30 independent units.
- Labels were not adjudicated by an independent human; all source data are exposed development data, not a protected holdout.
- The analysis does not establish calibrated confidence, cross-project reliability, or a production threshold.
- It evaluates classification with three context representations. It does not measure retrieval, evidence sufficiency, contradiction quality, synthesis faithfulness, paragraph compaction, or safe canonical merge.

## Reproduction

From the MSSR root, with the frozen packet available at the path above:

```powershell
node experiments/jev-mssr-live/runs/evidence-atom-cluster-audit-20261014T011057Z-v1/recompute.mjs --root "D:\Dev\mssr-snapshots\benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17"
```

The script emits `cluster-audit.json`. The original manifest, records, labels, summary and complete source hash inventory are referenced in `manifest.json`; raw prompts, document text and provider records were not copied into this Git repository.
