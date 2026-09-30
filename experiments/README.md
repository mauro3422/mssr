# Experimental evidence archive

This directory is intentionally separate from MSSR production source and is not included in the npm package. The branch `codex/benchmark-archive` preserves the existing Jev lab harnesses and result folders as research artifacts; their presence does not make them production tests, validated ground truth, or permission to promote Jev decisions.

## Audit record — 2026-09-30

- The archive contains the existing `typesafe-jev-lab` harnesses and runs plus a four-observation Semantic Experience JSON. Existing run files are preserved byte-for-byte; this note does not revise results or labels.
- The first benchmark labels were proposed by Codex and are not human ground truth. Continuation cases are not an independent holdout. Manual labels in `real-section-split` are not independent human adjudication. The semantic-curator result contains two cases (44/56 classifications correct); the current Semantic Experience artifact records four observations and zero verified labels.
- `references` runs have the strongest replay evidence: prepared input and snapshots of the selector and reader are stored with runs. Older `ontology-context-v2/v3` and `real-section-split` runs fingerprint their cases but do not freeze every project-context/build input, so those results are historical evidence and are not exactly replayable from the run folder alone.
- `latest.json` formats vary: some duplicate full records, some embed only selected fields, and some use machine-local `file:///` paths. Treat per-run timestamped folders as primary records; treat `latest.json` as a convenience pointer/copy with no portability guarantee.
- No API key was found in the audited files. The local lab server listens on loopback, but `server.mjs` may return provider `error.body` to its local client; review that boundary before sharing the UI or errors.
- These data do not establish Librarian integration, Jev calibration, routing quality, or permission to promote automatic decisions. Keep deterministic MSSR output and Jev proposals separately measured; require independently adjudicated labels and held-out, replayable inputs before making comparative quality claims.

## Requirements for new runs

Keep every run immutable in a timestamped directory. Its manifest should hash the case set, runner, dependency lock, MSSR source/build/dist and every authority document consumed; preserve replayable input snapshots where licensing and privacy permit. Record model/provider/configuration and label provenance, including whether adjudication was independent. Store raw records once, keep summaries/reports derived, and make `latest` a small portable run-id plus artifact-hash pointer. Do not overwrite or silently “repair” historical labels or outputs; corrections require a new run and an explicit comparison.
