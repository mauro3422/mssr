# Run 63 candidate-budget/filtering variant — execution deviation

**Observed:** 2026-10-13 23:34 UTC
**Type:** post-hoc diagnostic over the same frozen cases as Run 63; not an independent run or cohort
**Provider:** TypeSafe Jev 1.13.0 through the connected Bridge
**Runtime:** Bridge 0.6.179 / MSSR 0.2.132; metadata off; no query variants
**Production changes:** none; no threshold, source, runtime, or canonical project data changed

## Why this report exists

I misread Run 63's immutable pre-call manifest (providerCalls: 0) as the final status and repeated five Jev calls. The original package's [post-call erratum](../mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1/derived/POSTCALL-ERRATUM.md) and [run report](../mssr-librarian-source-disjoint-cohort-20261012T2251Z-v1/derived/RUN-REPORT.md) already record the completed five-call run. The manifest was intentionally frozen at the pre-call checkpoint. This package keeps the accidental variant separate and leaves the original package untouched.

The variant also changed the evidence pool. Original Jev candidate counts were 12/9/9/8/5 for A2/B1/B2/C1/C2 after safety filtering. This pass sent 20/20/13/10/6 candidates from the fresh Bridge searches without reapplying that filter. Every new request fingerprint differs from its original. It is therefore a candidate-budget/filtering diagnostic, not a controlled repeatability test. Do not pool it with Run 63 or claim the changed B1 choice was caused by one specific factor.

## Results

| Case | Label | Old offered | Variant offered | Variant result | Choice / Noul | Evidence result |
|---|---|---:|---:|---|---|---|
| A1, GodotAtlas (ES) | Answerable | 0 | 0 | Search empty; no Jev call | — | Retrieval miss |
| A2, GodotAtlas (EN) | Unanswerable | 12 | 20 | Abstained | 0.86 / 0.08 | Correct source-only abstention |
| B1, NeoPSE (ES) | Answerable | 9 | 20 | Selected block-21, L88–91 | 0.41 / 0.29 | Exact target; fetch + pack passed |
| B2, NeoPSE (EN) | Unanswerable | 9 | 13 | Abstained | 0.78 / 0.15 | Correct source-only abstention |
| C1, Elemental Frontier (ES) | Answerable | 8 | 10 | Selected heading-1, L1–31 | 0.90 / 0.94 | Direct support, but broad; fetch + pack passed |
| C2, Elemental Frontier (EN) | Unanswerable | 5 | 6 | Abstained | 0.93 / 0.05 | Correct source-only abstention |

Variant-only descriptive totals: target found for 2/3 answerable cases; Jev selected 2/2 answerable cases whose target was in the offered pool; it abstained on 3/3 unanswerable cases. Both selected passages received independent blind Luna judgments of direct support, with C1 broad in scope. Only B1 selected the exact annotated range (1/2); C1 selected a 31-line parent section. Exact fetch and verbatim evidence pack passed 2/2.

Five Jev calls used **12,015 input / 916 output tokens** and reported **5.0633 s** total provider latency. A1 did not reach Jev. The Choice/Noul values are raw and uncalibrated. In particular, B1 was selected at Choice 0.41, so this tiny exposed sample does not support a universal threshold.

## Privacy and process deviation

The search snippets and selected full ranges were not screened before this variant. A post-run local scan found one private-IPv4 literal among 69 search snippets and one local drive path in C1's fetched full-document range. No URL or common credential-pattern match was found in the examined snippets/fetched text. The exact provider prompt payload was not retained, so whether those two literals reached Jev is **unresolved**; treat this as potential exposure, not confirmed transmission or confirmed non-transmission. This package omits all snippets and fetched prose, normalizes project roots, and stores only exact handles, fingerprints and bounded result metadata. The source snapshot and labels remain in the original frozen package.

## Conclusion and follow-up

This variant is directionally interesting: the earlier B1 false abstention changed to an exact selection, while C1 remained answerable but overbroad. Because the offered pools changed and all request fingerprints differ, it cannot diagnose why. The 3/3 negative abstentions and 2/2 evidence-integrity passes are encouraging plumbing observations only; they do not establish reliability, calibration, or production readiness.

Do not call Jev again on these six cases as if they were fresh. Before another provider run, the runner should require reading the post-call report/erratum, assert the exact filtered handles and their privacy audit before selection, preserve the request fingerprint plus a redacted audit of what text was offered, and fail closed when an empty search returns no handles. The next confirmatory gate remains owner-adjudicated, frozen cases grouped by project family; reserved owner-review packets stay untouched.

## Frozen provenance

- Original case file SHA-256: 61adeeeaf87651098f4a3dce8ce77f30266ddc941f411649baff7c8f8f4a2b52.
- GodotAtlas source SHA-256: ef0b0fa250c9b5e19e7f486dfc8e56cdb03c34b6d3323ab5d8d7cf49e8ef925d.
- NeoPSE source SHA-256: aeb71416156ca39fb533e05982ca9283ace633a217e2a5316c81a1735ade6b3d.
- Elemental Frontier source SHA-256: 299148d04e0071444601c7366571f7958b15d1dfabfc11afe569898b49a4a2d0.
- The original Run 63 manifest, source snapshots, cases, and reports were not modified.
- Structured, redacted machine-readable evidence: [evidence-summary.json](evidence-summary.json).
