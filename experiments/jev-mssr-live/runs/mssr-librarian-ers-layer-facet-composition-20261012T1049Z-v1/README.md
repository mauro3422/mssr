# mssr-librarian-ers-layer-facet-composition-20261012T1049Z-v1

Development replay only. This reruns an exposed ERS question from Run45/Run47 with deterministic host decomposition into three bounded layer facets, then exact fetch, evidence packing and cited paragraph composition.

## Limits

- This shares source and question lineage with Run45/Run47; it is not an independent sample or holdout.
- The expected facet map is self-reviewed from the source, not owner-adjudicated gold.
- Jev confidence and sufficiency outputs remain descriptive and uncalibrated.
- No runtime, policy, score threshold, or source-project file is changed.
- The purpose is to locate which stage loses compound coverage and whether host decomposition plus citations repairs this specific exposed failure.

The original broad-query baseline selected only Layer 2 (Run45, provider confidence 0.45 and Noul 0.42); its blind review was partial because Layers 1 and 3 were omitted. Run48's candidate pools were frozen before any Jev calls. See `PRECALL_SHA256SUMS.txt`.

