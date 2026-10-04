# MSSR Librarian metadata integration suite

This suite is separate from `jev-mssr-live`. The existing v1–v17 runs use
`metadataMode: "off"`; they are exploratory textual-retrieval and bootstrap
diagnostics. They do not measure the Librarian metadata sidecar, atom routing,
skill selection, or contradiction handling.

## Real-document integration smoke

The first offline run uses MSSR commit
`cbc4f355d2e3dc322f23acfab26a790b1957daeb` (`@mauroprime/mssr` 0.2.102) and the
repository's actual `.mssr/project-context-librarian.json` sidecar. Its receipt
is archived at
[`runs/20261004T121900Z-mssr-cbc4f35/metadata-smoke-receipt.json`](runs/20261004T121900Z-mssr-cbc4f35/metadata-smoke-receipt.json).

Observed: 4 declared entries, 4 projected, 0 omitted, 4 metadata-filtered
searches, and 4 exact fetches with matching fingerprints. The `.mssr`
segments manifest was present; the optional refs manifest was absent. The
receipt records the exact project-context/librarian manifest hashes, source
hashes, build receipt, branch, commit, and exact ranges.

This proves only that the current sidecar bindings project, metadata filters
can retrieve their declared ranges, and exact fetch validates the returned
fingerprints. The fixture uses declared selector values as queries. It does
not measure natural-query relevance, ranking quality, Jev decisions, Bridge
runtime adoption, confidence calibration, or production suitability.

## Benchmark design gates

1. Freeze a new immutable source snapshot containing the sidecar, project
   manifest, any selected segments/references manifests, all bound source
   ranges, and the exact Bridge/MSSR build identities. A missing or invalid
   sidecar must fail the metadata run; it must not silently fall back to
   lexical retrieval.
2. Create natural-language requests and a blind gold set of acceptable exact
   ranges, including direct, equivalent, partial, insufficient, stale, and
   conflicting evidence. Add lexical decoys. Keep declared metadata as a
   feature under test, never as proof that a range answers the question.
3. Group English/Spanish variants and shared source/concept clusters into the
   same split. The current four sidecar entries and 26 concepts in the textual
   suite are too small to support a calibration/holdout claim. The protocol's
   30-independent-unit floor is only a reporting floor, not a sample-size
   guarantee.
4. First measure offline sidecar projection, metadata-filtered recall/ranking,
   exact fetch integrity, stale-revision rejection, and explicit fallback
   status. Then run Jev selection and Noul sufficiency as separate tasks; freeze
   thresholds on calibration data and keep the holdout unopened until the
   analysis plan is fixed.
5. Keep contradiction review separate from lexical candidates. Use only
   independently verified relation labels and the deterministic MSSR
   contradiction projection as a named baseline. Keep skill ranking separate
   too: its typed telemetry adapter and inputs have different provenance.

No provider call was made for the archived integration smoke. Live Jev work
requires a new immutable run and review of its provider-gate receipt before the
exact `START_JEV` confirmation.
