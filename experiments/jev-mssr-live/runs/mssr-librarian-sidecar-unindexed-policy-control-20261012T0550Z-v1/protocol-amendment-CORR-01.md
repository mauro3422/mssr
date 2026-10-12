# Protocol amendment CORR-01

The original frozen requests are preserved unchanged. Four initial search calls returned zero lexical candidates before any Jev/provider call. The request sent `query.metadata.domain=coding` to both the `metadataMode=off` baseline and the sidecar arm. MSSR applies `query.metadata` as an actual candidate-range filter regardless of metadata mode (see `src/librarian-retrieval.ts:624-626`); neither explicit source declares this tag, so the empty results are consistent with the contract and reflect caller request construction.

The corrected paired searches omit `query.metadata` in both arms while keeping each query and its two explicit sources unchanged. Only `metadataMode` differs. The sidecar is expected to report its four declarations as `source-not-provided` and retain lexical results; if it loses those results, no Jev calls will be made until the behavior is understood.

This amendment was created before corrected searches and provider calls. The initial request, labels, snapshots, hashes, and no-hit responses remain preserved. No source, sidecar, production code, threshold, or expected target changed. This is a development negative-control diagnostic over previously exposed MSSR documents, not a holdout or calibration sample.
