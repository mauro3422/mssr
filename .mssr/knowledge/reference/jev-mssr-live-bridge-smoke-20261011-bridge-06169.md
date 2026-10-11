# Exploratory MSSR Librarian smoke on Bridge 0.6.169 — 2026-10-11

This is a bounded live integration smoke, not an owner-adjudicated benchmark, accuracy estimate, or confidence calibration sample.

## Runtime and scope

- Bridge 0.6.169 release source commit `683303b7b00857b2a788a48b996c81e4042104d4` (activation documentation follow-up `2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc`), boot `adf97c06-a668-4ff9-a187-c12ab058bff2`, with the exact MSSR 0.2.121 artifact (SHA-256 `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`) and Jev 1.13.0.
- Source: `.mssr/knowledge/architecture/semantic-evidence-plane.md`.
- Two sequential Choice calls tested a compound authority/freshness question. This is one source family and one query task, not two independent cases.
- MSSR trace: `mssr-20261011102543-19432ac1-8f0`.

## Selection and exact acquisition

The first call offered 16 exact candidates (20 nested range overlaps) and selected `block-4` at line 13. It was relevant to the source-authority and revision boundary but only partially covered the compound question. Choice confidence was 0.34 and Noul evidence sufficiency was 0.79; neither value is calibrated, and the sufficiency value did not establish coverage of every query facet.

A targeted follow-up search offered 10 candidates and selected `block-9` at line 26. Its passage covered host-side re-read/revision checks, approval for writes outside MSSR, independent verification, and handling unresolved or stale evidence. Choice confidence was 0.30 and Noul was 0.54; both remain uncalibrated.

Both handles passed exact fetch. The first fetched range had source revision `97771c3da97e468d945d6d627024e322300bd336da48453688a1df202215cd94` and fingerprint `6664f0aa337fcc7f328af4241999aefc49288ff0613173df37047e38dd3e21bd`. The Bridge 0.6.169 release record independently confirms both fetches used that same source revision; this MSSR record does not retain a separate fingerprint for the second handle. The final evidence pack assembled two unchanged cited ranges in source order (1,595 UTF-16 code units) without semantic rewriting.

## Interpretation and limits

The host covered a missing facet by issuing a targeted follow-up selection and exact-fetching its evidence. This demonstrates a usable live search → Jev selection → exact fetch → cited-pack path for this case. It does not establish retrieval recall, answer accuracy, general reliability, calibrated confidence, or a threshold suitable for production. No owner-gold labels were created, no thresholds changed, and no canonical source was rewritten or promoted to authority.
