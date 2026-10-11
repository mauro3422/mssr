# Run 30 frozen-output erratum — 2026-10-11

This is an append-only correction to copied static text in `runner.mjs` output and `summary.json`. The frozen files, manifest, source snapshots, labels, request records, completion record, and original `SHA256SUMS` are preserved unchanged.

## Correct observed facts

- The run completed **3 requests across 3 distinct `sourceRef` clusters**, not five documents or ten requests. Three clusters are descriptive groupings, not a claim of statistically independent sampling.
- The frozen manifest identifies Bridge **0.6.172**, MSSR **0.2.127**, and Jev **1.13.0**. The local runner used the clean Bridge 0.6.172 release module/provider adapter; it did not call the active Bridge MCP server process.
- A post-run Bridge health read independently returned 0.6.172, boot `0f3859cd-6eca-4b4c-b2ad-1d20dd819012`, 189 tools, healthy tunnel endpoints, and no pending restart. Its tunnel-metrics snapshot is timestamped `2026-10-11T22:51:42.498Z`.
- `summary-calculated.json` is the mechanical count authority: 3/3 requests completed, 3/3 target headings found, 3/3 exact heading matches, 3/3 exact fetches with fingerprints, and 3/3 evidence packs built. Its 11-file checksum verification succeeded.
- A blind Luna review that received only `records.jsonl` judged all three excerpts full and directly supported, with no missing or unsupported facts. The digest excerpt was moderately overbroad; the other two were tightly scoped. This model-assisted review is not owner-gold.
- Raw Jev Choice scores were `0.70`, `0.66`, and `0.93`. The records have no numeric `evidenceSufficiency` or Noul values for these calls; the missing fields are a capture gap, not zero scores.

## Stale copied statements

The frozen runner's static text and frozen `summary.json` say “source-document clusters; 5 only,” describe five documents/ten requests, and identify Bridge 0.6.169 / MSSR 0.2.121 as the local package. Those copied claims do not describe this run. The runtime metadata and records identify three source clusters, three calls, and Bridge 0.6.172 / MSSR 0.2.127. The statement that the local runner did not invoke the active MCP server process is correct; the package version attached to that sentence was stale.

## Interpretation boundary

This is a small exploratory diagnostic with source-derived targets and no owner-gold adjudication, statistical holdout, calibration, or reliability estimate. It exercised search → Jev selection → exact fetch → evidence-pack construction; it did not test relation review, contradiction detection, host synthesis, or automatic query decomposition. Do not tune a threshold or change production policy from this run.

## Follow-up: exact evidence-sufficiency capture cause

Source inspection confirms Jev completed the typed Noul request and MSSR
returned the numeric value as evidenceSufficiency. The clean Bridge 0.6.172
adapter preserves that selector result. This run's frozen runner instead
serialized noul: selected.noul ?? selected.sufficiency ?? null, omitting the
canonical selected.evidenceSufficiency field. The three missing values are
therefore a runner serialization defect, not a Jev abstention or Bridge
omission.

The packet contains neither the canonical field nor raw vendor response bytes,
so the numeric values cannot be recovered from run 30. Its manifest, records,
summary, runner, and original checksum index remain unchanged. New packets
should use the shared selection-record.mjs serializer and freeze its hash
alongside the reusable runner. The regression exercises distinct canonical and
raw-Noul values and an offline, zero-network runner dry run.
