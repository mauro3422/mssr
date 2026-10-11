## Scope

Read-only live Jev diagnostics on the Zomboid Smartwatch `hud-minimap.md` source family using Bridge 0.6.167 / MSSR 0.2.115 and Jev `typesafe-jev` 1.13.0. These are source-derived diagnostic cases, not owner-gold, a holdout, or confidence calibration. Choice/Noul are raw uncalibrated provider signals. The ZSW file and worktree were not changed.

## Round 1 — compound query coverage

One source family and one compound HUD-layer/MapOverlay authority concept. The compound query selected related but partial “Independent local layers” evidence. A targeted lifecycle/overlay facet selected the missing MapOverlay runtime-responsibility range, and exact fetch confirmed it. A battery-duration negative control abstained within the supplied source. This does not measure source recall or general answer quality.

Report SHA-256 `b7a6dcc6c636c0447d5bcdc73a48ebd841f05e1b04fe173f190de857b3fef777`; manifest SHA-256 `049913c31901709e144a9333519870e89a1b5a930799812f68bf27ecdbdaa622`. Artifacts: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-zsw-hud-minimap-query-coverage-20261011-v1\`.

## Round 2 — three grouped concepts

The same source family, three concepts, 8 Jev calls, 4 searches and 3 exact fetches:

- **HUD v9 profile reset/split-screen:** compound pools of seven candidates and overlapping ranges abstained (Choice/Noul .38/.20, 1/.03, 1/.02); exact `Ownership` selected (1/.92). Fetch confirmed reset behavior and no player-0 vanilla write for secondary profiles.
- **GPS membership vs HUD eligibility:** `Ownership` selected (.53/.93); fetch confirmed local eligibility requires a compatible powered watch and is unrelated to GPS membership.
- **Personal marker ownership/placement/menu:** broad and facet-pool queries abstained (.62/.27 and .27/.46); exact marker block selected (.1/.95). Fetch confirmed `MarkerStore`, `MarkerPlacement` and `MarkerMenu` responsibilities.

These query variants and retries remain within-concept observations. All expectations are source-derived, zero owner-gold labels, and no holdout. Report SHA-256 `bb1a54b346d352521a72e73ba0f497dee5556223d0acd28e741ae33a490f5bc8`; manifest SHA-256 `00dd3611c3df9abc84ac7b322f99321ba3b170be892bb7b05c48fa7daafdb758`. Artifacts: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-zsw-hud-minimap-query-coverage-20261011-v2\`.

## Round 3 — frozen 0.2.115/0.2.120 paired diagnostic and facet follow-up

The frozen `hud-minimap.md` source was re-read and hash-checked before testing (SHA-256 `7518b99ad7fda628cf53c736b15cd103561cd721e219d57f5ac2b64b1f292b71`); the ZSW source stayed unchanged. Deterministic retrieval was compared between the exact 0.2.115 and 0.2.120 package artifacts, then Jev 1.13.0 selected from each version's native candidate pool. The candidate's four selected handles passed exact-fetch revision, fingerprint, and offset-slice checks. Independent review classified one compound selection as partial: its `block-2/item-4` describes local layers but not MapOverlay's GPS snapshot and RemotePlayers ownership behavior. Exact fetch proves citation integrity, not answer coverage.

Two follow-up probes separated facets, using the same question and explicit coverage/abstention instruction in both arms:

- **c1a — responsibilities spread across several local HUD items:** both arms abstained (baseline 7 candidates, candidate 23). This is consistent with the single-range contract because no one local-layer item covers vehicle, discovery/place, marker storage, placement, and menu responsibilities together.
- **c1b — MapOverlay behavior and ownership limits:** baseline selected `heading-3` (lines 15–21, 681 characters), which only says the layers are composed by MapOverlay and does not answer its traffic/snapshot/remote-player ownership details. Candidate selected `block-3/item-2` (line 25, 450 characters), which directly contains those details. Both fetched ranges passed revision, fingerprint, and exact source-offset checks.

This is diagnostic evidence only. Candidate pools differ in version, size, and granularity (7 vs 23 for c1a; 7 vs 19 for c1b), so the narrower candidate selection cannot be attributed to list-item granularity alone. Choice and Noul values are uncalibrated provider signals; c1a Noul was 0.24/0.66 despite both abstentions, confirming it is not a coverage label. There is one source family, source-derived facets, and no owner-gold labels or independent holdout. Do not report an accuracy rate or promote a confidence threshold from this run.

Reproducible packet: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-zsw-hud-minimap-paired-freeze-20261011-v1\`. Facet report SHA-256 `afe673e27d123d8426ef2034384d295640b8f0943845bc7f063eb04192ee6319`; selection results SHA-256 `2ebbe57b263b769bf1a4ea4a8b4c55d048d22826850280b6316e5dabd476379e`; complete hashes are recorded in `facet-artifact-hashes.json`.

## Interpretation and next gate

This narrow diagnostic suggests query decomposition and candidate-range precision may expose useful evidence after abstention; it does not establish a general benefit, causal effect, accuracy or confidence calibration. Do not pool retries, facets or the same source family as independent samples.

The reports preserve concept descriptions and request fingerprints, but not every literal query, complete candidate pool and Jev request payload required for an exact replay. Do not reconstruct an “exact replay” from summaries. Recover the literal payloads from receipts/traces if available; otherwise freeze a fresh paired packet and label it a new diagnostic.

Next, run a controlled same-indexer comparison whose candidate text, ordering, model, instructions, and limits stay fixed while only range representation changes; include a multi-facet query that requires evidence from several items and test whether the contract supports multi-range selection or correctly abstains. The 0.2.115-vs-0.2.120 comparison bundles candidate-generation changes, so it cannot isolate their causal effect. Keep retrieval, selection, exact fetch, and answer coverage as separate measures; keep source-family and concept-level denominators explicit. Do not tune confidence thresholds without owner adjudication and an independent holdout.
