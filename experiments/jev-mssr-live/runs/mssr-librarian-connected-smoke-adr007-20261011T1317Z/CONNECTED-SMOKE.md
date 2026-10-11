# Connected Jev/Librarian smoke — ADR 0007

Status: completed, exploratory, linked diagnostic. Captured 2026-10-11 UTC.

## Scope

This was one connected Bridge smoke over the already exposed
`docs/decisions/0007-automatic-lifecycle-coverage.md` source. It is one source
cluster and two linked queries, not independent samples, owner-gold, or a
calibration run. The source revision for both calls was
`92e6a35bc007060a6e8634c63e94dc638e3636ba5a7c5f46abdd2a87f8e16a69`.

## Results

| Query | Search candidates | Jev result | Exact fetch and pack |
| --- | ---: | --- | --- |
| Compound: action for ambiguous ownership/current trace or unavailable tool | 8 search results (truncated); 7 offered to Choice | `block-9`, broad activation rules; confidence 0.47, Noul 0.26, `none` probability 0.44; 1,557 input / 117 output tokens | Passed; selected source range matched revision and fingerprint |
| Narrow: action for ambiguous, mismatched, or unknown trace ownership | 25 search results (truncated); 5 exact handles offered | `block-9/item-7`; confidence 0.99, Noul 0.90; 1,216 input / 97 output tokens | Passed; exact line 38 matched revision and fingerprint |

The narrow query selected the exact rule:

> 7. Ambiguous, mismatched or unknown trace ownership never migrates a trace. The decision abstains into `review`/`inspect-traces`; R1 remains the authoritative owner-integrity contract.

The fetched evidence answers the ownership facet. It does not answer what to
do when a required tool is unavailable. That second facet needs a source that
defines capability-unavailability behavior; it must not be inferred from this
ADR.

## Interpretation and limits

- The result supports testing explicit query decomposition plus exact-handle
  selection when a compound query scores weakly. It does not establish that a
  high Jev score means high correctness: confidence and Noul are uncalibrated.
- Both queries target the same ADR and overlap heavily. Do not count them as two
  independent benchmark cases or tune a confidence threshold from them.
- Search returned advisory candidates; Jev selected one range; Bridge then
  revalidated the exact source; evidence-pack output preserved source text and
  citation unchanged. This smoke did not ask Jev to write or synthesize prose.
- Dedicated Bridge connectors did not carry the active trace in this chat
  session. Their calls were blocked before execution. After inspecting the live
  runtime schema, explicit `bridge_tool_query` (read-only) and
  `bridge_tool_action` (Jev external call) with the same trace succeeded. This is
  connector trace-propagation friction, not a Librarian search/fetch failure.
- Runtime evidence identifies Bridge boot `adf97c06-a668-4ff9-a187-c12ab058bff2`,
  Jev provider `typesafe-jev`, model `jev-1.13.0`. No clean Bridge source build
  snapshot or replayable provider receipt was captured; this record is not a
  frozen benchmark packet.

Machine-readable result summary and exact handle fingerprints are in
[`observations.json`](observations.json). This record is append-only.
