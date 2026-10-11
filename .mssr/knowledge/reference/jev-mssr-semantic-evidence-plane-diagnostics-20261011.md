## Scope

One frozen MSSR source family: `.mssr/knowledge/architecture/semantic-evidence-plane.md`, SHA-256 `97771c3da97e468d945d6d627024e322300bd336da48453688a1df202215cd94` (9,431 bytes, 65 lines). Baseline was Bridge 0.6.167 / MSSR 0.2.115; candidate was the direct MSSR 0.2.120 path. Jev was `typesafe-jev` 1.13.0. The candidate package label comes from the known local candidate path, not a version readback in the selector response.

## Initial six-query chain

Baseline and candidate lexical pools had identical ordered range IDs and scores for all six initial questions. Jev selected identical ranges in both arms:

| Query | Selected range | Characters | Source review |
|---|---:|---:|---|
| EvidenceAtom provenance/freshness fields | `block-9` | 1,324 | Miss: pipeline and verifier-freshness content, not the v2 field schema. |
| Jev and host boundaries | `heading-5` | 2,149 | Relevant, but broad; the offered `block-11` (491 characters) states the boundary more directly. |
| Acquisition budgets | `block-13` | 443 | Direct support. |
| Evidence funnel | `block-18` | 352 | Direct support. |
| Promotion gates | `block-19` | 413 | Direct support. |
| Query coverage and gaps | `heading-8` | 1,069 | Direct support, including limits of the initial Markdown search. |

All 12 exact fetches passed source revision and exact-offset-slice checks. The six selected ranges totaled 5,750 characters per arm. This measures retrieved range volume, not answer accuracy.

## Facet follow-up

A targeted compound provenance query selected `block-5` (451 characters): it correctly says provenance is caller-asserted and unauthenticated, but omits the v2 field list. Decomposition produced:

- **Atom fields:** both arms selected `heading-2` (1,499 characters), which contains `block-2` (1,080 characters) with required `source class`, `canonical owner`, and `freshnessEvidence` matching owner, normalized ref, revision, and timestamp.
- **Provenance limit:** both arms selected `block-5` (451 characters), which states that metadata adaptation does not authenticate provenance and that exact fetch, independent verification, and separate permission/write gates remain necessary.

The corresponding exact fetches passed revision and source-slice validation. An additional instruction to choose the shortest range still resulted in `heading-2` rather than the contained `block-2`. This suggests testing deterministic removal of strictly contained ranges before Jev when precise citations matter; it is an orchestration hypothesis, not a validated code change.

## Limits and next gate

The later faceted searches did not have identical pool sizes across arms (for example, 18 versus 14 candidates for atom fields), and both arms use the same external Jev provider. The observed agreement is within one source family, not independent replication or causal evidence about MSSR versions. Query expectations came from the same source; there are no owner-gold labels, blind review, or holdout. Choice/Noul values remain uncalibrated. Do not infer an accuracy rate, set a threshold, or promote decisions from this run.

The useful host pattern is to decompose compound questions, retrieve per facet, fetch exact ranges, deduplicate overlaps, then verify every answer claim against the fetched bytes. No source/runtime was changed or activated.

Reproducible packet: `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-mssr-semantic-evidence-plane-atomic-20261011-v1\`. Report SHA-256 `4243e7008cc5251783ed935f3772b4b338de4ffb50f70e18173277671daaf48b`; packet hashes are in `artifact-hashes.json`.
