# Connected Jev/Librarian smoke — capability-gap guidance

Status: completed, exploratory, linked diagnostic. Captured 2026-10-11 UTC.

## Scope

This follow-up used the connected Bridge runtime and a different source document
from the ADR 0007 ownership smoke: `docs/AGENT_PROTOCOL.md`, revision
`30e9f8da6103c4904559009533fa946ac53c3e5bf04ac5898e6088f919a458ca`. Two linked
queries narrowed a capability-chaining rule from its section to the exact block.
This is one source-document cluster, not two independent cases.

## Results

| Query | Jev result | Exact fetch and pack |
| --- | --- | --- |
| Broad capability/replanning question over multilingual search candidates | `heading-13`, confidence 0.94, Noul 0.71; 802 input / 67 output tokens; 785.7 ms | Passed; section handle, revision and fingerprint revalidated |
| Narrow capability-needs/replan question with parent and child ranges offered | `block-46`, confidence 0.80, Noul 0.91, `none` 0.01; 809 input / 67 output tokens; 694.6 ms | Passed; exact child block, revision and fingerprint revalidated |

The exact range says:

> When a selected skill/tool reveals another need, record the signal and a short
> `capabilityNeeds` description, refresh or inspect the registry if necessary,
> then re-plan. The host retains normal authority to use any available authorized
> tool; MSSR is not an allowlist.

This is relevant guidance for discovering/chaining a needed capability. It does
not define a formal failure policy specifically for a required tool being
unavailable, so that narrower claim remains unverified.

## Interpretation and limits

- The exact child range had higher Noul (.91 vs .71), while raw Choice was lower
  (.80 vs .94). The calls differed in query and candidate pool; this is a
  diagnostic observation, not a controlled comparison or causal result.
- Search used explicit English and Spanish/English query variants across four
  caller-supplied Markdown sources. Returned result sets were truncated; only the
  selected exact source range was used as evidence.
- Both calls target one source revision and are linked. There is no owner-gold,
  independent adjudication, or confidence calibration. Do not tune thresholds.
- Runtime: Bridge boot `adf97c06-a668-4ff9-a187-c12ab058bff2`, provider
  `typesafe-jev`, model `jev-1.13.0`, trace
  `mssr-codex-unavailable-tool-facet-20261011-01`.
- Evidence-pack output is verbatim. This smoke tested search, Jev range
  selection, exact fetch and evidence packing; it did not test Jev paragraph
  composition or synthesis.

Machine-readable selections and fingerprints are in [`observations.json`](observations.json).
This record contains bounded metadata only, not raw queries, credentials, or
provider responses.
