# Run 67 — Bridge live compound/facet diagnostic

Date: 2026-10-13 UTC. Exploratory, post-hoc diagnostic on one already exposed source cluster.

## Purpose and setup

Verified the current Bridge-to-MSSR Librarian-to-live-Jev path and compared a compound question with one targeted follow-up facet. The only source was the current canonical `.mssr/PROJECT_STATE.md`, revision `8f788e951ead3e19e92477e477c77f56d8ee4c2e07be8fb43d65959903762299`. Metadata was off and Jev received only exact handles returned by search.

## Results

- Primary compound query: “What evidence and remaining gate are required before saying Jev is reliable or calibrated in MSSR?” Search returned eight candidates; Jev selected the exact expected `block-3` at line 10. Choice raw confidence and selected-option probability were both 0.97; Noul evidence sufficiency was 0.53. Exact fetch and evidence-pack citation passed. A separate blind Luna reviewer rated the excerpt **partial**: it explains the lack of owner-gold/holdout and requires frozen owner labels, but does not define evaluation criteria or a pass threshold.
- Post-hoc facet follow-up: “What is the minimum size and structure of the independent labeled Jev cohort before reliability claims?” Search returned eight candidates; Jev selected the exact expected `block-10` at line 24. Choice raw confidence was 0.39 and selected-option probability 0.46. The exact excerpt names the documented gate of at least 30 independent labeled units, grouped by project, with separate reporting for retrieval, selection, sufficiency, overbreadth, abstention, and evidence integrity. Fetch and exact citation passed.
- The final verbatim evidence pack preserved both exact ranges and citations, 1,163 characters total. It is an evidence bundle, not generated prose or semantic compaction.
- The two selections cover complementary facets of the question. They are queries against the same known document, and the second was post hoc; count them as one dependent diagnostic cluster, not two independent benchmark units.

## Integration and system health

- Current Bridge health reported server **0.6.177**, tunnel health `200/live`, readiness `200/ready`, and 189 catalog tools. The direct Bridge search → Jev → exact fetch → evidence-pack path succeeded; no files or canonical content were modified.
- A separate MSSR registry refresh still reported provider `mauroprime-bridge` as unavailable (`-32000: Connection closed`, zero capabilities; its `observedAt` remained 2026-10-11). This does not mean the direct Bridge tool path is down. The registry discovery/stdio failure remains unresolved.
- The previous state said Bridge 0.6.176 adopted the exact MSSR 0.2.130 artifact. The live server is now 0.6.177, but its installed MSSR package hash was not independently read during this diagnostic; adoption on 0.6.177 remains unverified.

## Interpretation and limits

The primary choice is the useful warning: a raw Choice score of 0.97 did not mean the excerpt alone fully answered the compound question, and Noul was lower at 0.53. The targeted follow-up found the missing gate despite lower Choice confidence. This supports testing query decomposition and scoring selection separately from evidence sufficiency. It does not validate automatic decomposition, calibration, general reliability, merging, contradiction detection, or synthesis. The frozen suite has one source cluster, no owner-gold labels, and no protected holdout.

The documented `n >= 30` cohort is a pilot floor, not by itself a pass threshold or proof of calibrated confidence. The existing policy also calls for risk/coverage across cutoffs plus reliability bins and Brier/log-loss or ECE; no numerical acceptance criterion is presently established in this run.

No runtime, threshold, canonical source, or merge behavior changed.
