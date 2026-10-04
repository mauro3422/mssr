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


## Live Bridge runtime metadata smoke — 2026-10-04

A separate read-only run against the active Bridge runtime is archived at
[`runs/20261004130221-bridge-0.6.153-live-sidecar/`](runs/20261004130221-bridge-0.6.153-live-sidecar/).
It freezes the exact MSSR source documents, manifests, Bridge health/schema identity,
queries, target ranges and fetch fingerprints.

Observed on Bridge 0.6.153: all 4 declared sidecar entries projected from the
three explicit source files; all 4 metadata-filtered exact target searches and
all 4 exact fetches passed; the same typed filters with metadata mode off returned
zero results. An exact lexical heading query returned the same ranking with and
without the sidecar. A restricted source list projected 2 and explicitly omitted
the other 2 as `source-not-provided`, confirming that this path does not crawl
or silently add documents.

The four positive queries echo declared selector values. This is runtime
integration evidence only, not natural-language retrieval quality, Jev decision
quality, Noul sufficiency quality, calibration, or activation evidence. No Jev or
Noul provider call was made. One setup request exceeded the live schema's
240-character snippet limit and was rejected; it was corrected before the
successful run.

The runtime reports Bridge 0.6.153 and a healthy 185-tool catalog. Exact MSSR
dependency provenance remains unresolved: the active process's on-disk checkout
reports 0.6.144 and its installed MSSR package 0.2.96, which does not identify
the bytes loaded by the 0.6.153 runtime. Do not deploy the 0.6.156 branch until
runtime source/dependency identity is mapped and candidate-only verification
passes in an isolated checkout.

## MSSR 0.2.104 Codex-local metadata smoke — 2026-10-04

A direct in-process smoke against the clean product candidate
`codex/jev-citation-evidence-pack-clean` at
`e3e03912d63231ebf646fdaec9353ee1e28fe403` used MSSR 0.2.104
(`mssr-build:sha256:1508c8a279dc911c`). The sidecar projected 4/4 declared
entries, omitted none, returned all four metadata-filtered exact ranges, and
passed all four fetch fingerprints across three source files (10,779 fetched
code units).

The four queries echoed their declared selector values. No Jev, provider, or MCP
call was made; an optional Jev request was only constructed in memory. This
demonstrates local projection/search/fetch plumbing, not natural-query relevance,
ranking quality, Jev selection, Noul sufficiency, calibration, or Bridge runtime
adoption. The ignored original receipt SHA-256 is
`6cf526d3ba45334679219aabbd98f031229bd4305c6da44b9eafa309c8f7c58f`. The
portable, path-scrubbed summary preserves per-entry source and fingerprint
evidence: [project-context-librarian-smoke-20261004.json]
(evidence/project-context-librarian-smoke-20261004.json).

The separate v18-based frozen preflight (21 documents, 26 concepts, 52 eligible
requests) did not include `.mssr/project-context-librarian.json`; its
provider-gate success therefore does not cover the 0.2.104 metadata path. Create
a new immutable sidecar-aware snapshot before measuring natural queries or
comparing retrieval.

## Unadjudicated query inventory

[`candidate-bank.md`](candidate-bank.md) contains 32 bilingual candidate
query pairs anchored to 27 MSSR source files. They are not labels or evaluation
results. The independent source/concept cluster count is unadjudicated; the
bank does not yet pass its 30-independent-unit reporting gate and still needs
two-reviewer accepted-range labels before Jev selection or probability
calibration.

Two blind AI reviewers assessed answer sufficiency against MSSR source commit
`ad9a46ad2c0d95dc012fe1e07049bfd45cc3c330` without receiving the candidate
anchors or Jev outputs. Their unadjudicated proposal is preserved at
[`review-proposals/2026-10-04-blind-ai-review.md`](review-proposals/2026-10-04-blind-ai-review.md):
they agree on 16 sufficient and 2 partial cases (C02/C03). This is an
AI-generated review aid, not independent human adjudication, gold data, or a
benchmark result. Do not use it to calibrate thresholds or claim quality.
The 14 candidate additions C19–C32 came from two read-only Luna seed scans;
their provenance and exclusions are recorded at
[`review-proposals/2026-10-04-candidate-seed-scan.md`](review-proposals/2026-10-04-candidate-seed-scan.md).

## Sidecar-aware offline preflight

The v18 runner remains frozen and cannot cover the .104 sidecar: it pins an older
source commit and runs with metadata off. The separate runner
`metadata-preflight.mjs` uses `metadata-preflight-pins.json`; it supports offline
preflight mode only, pins the clean .104 candidate/build/sidecar/source identities,
snapshots declared inputs including the package lock, checks the installed Zod
version and records the Node runtime, and verifies projection, typed-filter
lookup, exact fetch, fingerprints, and fail-closed omitted/stale sidecar controls.

From the benchmark repository, after committing the runner changes:

```powershell
node .\experiments\jev-metadata-integration\metadata-preflight.mjs --preflight --candidate-root 'C:\Users\mauro\.codex\worktrees\jev-evidence-pack-integration\mssr' --run-root 'D:\MSSR-benchmark-artifacts\jev-sidecar-preflight-20261004-v1'
```

The output root must be new, outside every repository, and outside any directory
named `runs`. It contains the frozen input snapshot, structural receipt, README,
and SHA256SUMS. No Jev/provider/MCP calls, labels, query-quality scores, or
production changes are involved. This preflight is not a relevance-quality or
calibration benchmark; use owner-adjudicated grouped data for those.
The missing-sidecar negative control omits the Librarian manifest argument to the
projector; the physical sidecar input is separately required by the pinned input
map and hash check.

Run its regression tests with `node test/metadata-preflight.test.mjs`.
