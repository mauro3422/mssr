# Bridge Librarian compound versus split-query diagnostic — 2026-10-11

This is a post-hoc, single-source development diagnostic. It is not an owner-
adjudicated benchmark, protected holdout, accuracy estimate, or confidence
calibration sample. All five Jev requests concern one Markdown source cluster;
repeated/focused queries do not count as independent cases.

## Runtime and source

- Calls used the connected `MauroPrime_Bridge` wrappers for Librarian search,
  Jev selection and exact fetch. Bridge runtime boot was
  `adf97c06-a668-4ff9-a187-c12ab058bff2`, matching the live Bridge 0.6.169 /
  MSSR 0.2.121 record in `.mssr/PROJECT_STATE.md`. `bridge_metrics_status`
  independently returned the same boot ID; persistence had 0 pending, 0 failed,
  0 dropped events, an active writer and no last error. The wrapper responses
  identified `typesafe-jev` / `jev-1.13.0`.
- Source: `.mssr/knowledge/decision/canonical-project-context-cutover.md`.
- Source SHA-256/revision: `78454857b313a70bfef25c00d24ecc59cbf6ff52ec3d1d1f0cc05ef2d0ee6905`.
- Search returned three exact candidates: `heading-1` (section, 844 UTF-16
  code units), `block-1` (257), and `block-2` (344). The section contains both
  child blocks. Source identity, owner, revision and privacy class stayed fixed
  across the comparisons.
- A first search call was rejected locally because `maxSnippetChars=500`
  exceeded the runtime maximum 240. It made no Jev provider call and is excluded
  from all five request metrics below. The corrected call used 220.

## Results

| Query arm | Offered candidates | Selected range | Choice confidence | Noul sufficiency | Exact fetch |
|---|---:|---|---:|---:|---|
| Compound: canonical authority plus obsolete inbox receipts, initially offered only `block-1` | 1 | `block-1` | 0.68 | 0.45 | pass |
| Focused inbox query, initially offered only `block-2` | 1 | `block-2` | 1.00 | 0.89 | pass |
| Compound query with the fixed three-candidate pool | 3 | `block-2` | 0.32 | 0.83 | pass |
| Focused authority query with the same three-candidate pool | 3 | `block-1` | 0.89 | 0.78 | pass |
| Focused inbox query with the same three-candidate pool | 3 | `block-2` | 0.93 | 0.83 | pass |

All 5 selected handles were re-read through the Bridge fetch wrapper, and all 5
returned fingerprints equal the offered handle fingerprints. The fixed-pool
compound Choice distribution was `heading-1=0.40`, `block-1=0.01`,
`block-2=0.49`, `none=0.10`; Jev selected `block-2`. The five provider requests
used 4,141 input and 345 output tokens in total. Provider latency summed to
3,587.6 ms (mean 717.5 ms); these are per-call observations, not benchmark
throughput claims.

## Literal evidence review

- `block-1` says active project-context fallback to `.bridge/` was removed and
  managed projects must be initialized under `.mssr/`.
- `block-2` says obsolete pre-0.2.18 runtime inbox receipts are discarded
  instead of migrated due to stale `.bridge` provenance. It also says durable
  legacy authorities are deleted only if their canonical counterpart exists;
  otherwise cleanup is blocked for explicit review.
- The compound query asks both about canonical authority and inbox receipts.
  Its fixed-pool result, `block-2`, supports the inbox and legacy-cleanup facet
  but omits the explicit no-fallback rule from `block-1`. It is therefore
  partial under literal coverage review even though Noul returned 0.83.
- The two focused queries over the same fixed pool selected their expected
  source-derived facets. This supports trying host-side facet decomposition
  followed by exact fetch and union coverage checks. No answer synthesis or
  semantic coverage verifier was run here.

One blinded Luna reviewer assessed only the compound query and exact selected
text, without seeing Jev's scores. The reviewer independently classified it as
partial: inbox discard and legacy-cleanup safeguards were covered; canonical
`.mssr/` authority and the removal of `.bridge/` fallback were omitted. This is
one model-assisted review, not an owner label or gold standard.

The one compound result is a concrete warning that a high raw Noul score can
coexist with missing query coverage. Five related calls on one source do not
estimate how often this happens. Scores remain uncalibrated; no threshold,
production behavior, retrieval policy or canonical source changed.

## Bridge metric receipts

Successful Bridge metric IDs observed after the calls:

- Search: `mv42ocie-mcqoaxev`.
- Initial single-candidate selections/fetches:
  `mv42ohy3-apdqm3bb`, `mv42okv6-wgzb68d6`,
  `mv42oqd4-u037ck7f`, `mv42ounn-d5u4przc`.
- Fixed-pool compound selection/fetch:
  `mv42p9qc-io5ybz2b`, `mv42pdbo-x43bydb8`.
- Parallel fixed-pool facet selections/fetches:
  `mv42q8ja-63o5xa9g`, `mv42q930-dys2g22b`,
  `mv42qexq-2a07qm1b`, `mv42qexw-2p5c2v3g`.

Bridge SQLite reported every listed event `ok=true`. The local schema-rejected
search attempt is not a Jev result and is not included.

## Next experiment

On a fresh source-document cluster, preregister an atomic-query arm and a
compound-query arm over the same candidate pool, blinded labels, and exact
fetch checks. Have an independent reviewer grade literal facet coverage and
overbreadth. Only after enough independently labeled, project-grouped cases
should Noul calibration be estimated. Until then, keep it descriptive and use
explicit host-side union coverage as a separate gate.
