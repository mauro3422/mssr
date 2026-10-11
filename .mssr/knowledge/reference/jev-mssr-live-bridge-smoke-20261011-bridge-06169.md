# Exploratory MSSR Librarian smoke on Bridge 0.6.169 — 2026-10-11

This is a bounded live integration smoke, not an owner-adjudicated benchmark, accuracy estimate, or confidence calibration sample.

## Runtime and scope

- Bridge 0.6.169 release source commit `683303b7b00857b2a788a48b996c81e4042104d4` (activation documentation follow-up `2ee6ddcd788836b4edb4e03b8569f1b8606e3cbc`), boot `adf97c06-a668-4ff9-a187-c12ab058bff2` (watchdog ack `18b4db27-1fc8-47c5-b670-dafc194ab57f`; 188 tools; tunnel live/ready; no restart pending; zero new transport failures since the post-restart baseline), with the exact MSSR 0.2.121 artifact (SHA-256 `181bf914da4f5767c457755990798169f6d539f56886b420bd8410951b5d8971`) and Jev 1.13.0.
- Source: `.mssr/knowledge/architecture/semantic-evidence-plane.md`.
- Two sequential Choice calls tested a compound authority/freshness question. This is one source family and one query task, not two independent cases.
- MSSR trace: `mssr-20261011102543-19432ac1-8f0`.

## Selection and exact acquisition

The first call offered 16 exact candidates (20 nested range overlaps) and selected `block-4` at line 13. It was relevant to the source-authority and revision boundary but only partially covered the compound question. Choice confidence was 0.34 and Noul evidence sufficiency was 0.79; neither value is calibrated, and the sufficiency value did not establish coverage of every query facet.

A targeted follow-up search offered 10 candidates and selected `block-9` at line 26. Its passage covered host-side re-read/revision checks, approval for writes outside MSSR, independent verification, and handling unresolved or stale evidence. Choice confidence was 0.30 and Noul was 0.54; both remain uncalibrated.

Both handles passed exact fetch. The first fetched range had source revision `97771c3da97e468d945d6d627024e322300bd336da48453688a1df202215cd94` and fingerprint `6664f0aa337fcc7f328af4241999aefc49288ff0613173df37047e38dd3e21bd`. The Bridge 0.6.169 release record independently confirms both fetches used that same source revision; this MSSR record does not retain a separate fingerprint for the second handle. The final evidence pack assembled two unchanged cited ranges in source order (1,595 UTF-16 code units) without semantic rewriting.

## Interpretation and limits

The host covered a missing facet by issuing a targeted follow-up selection and exact-fetching its evidence. This demonstrates a usable live search → Jev selection → exact fetch → cited-pack path for this case. It does not establish retrieval recall, answer accuracy, general reliability, calibrated confidence, or a threshold suitable for production. No owner-gold labels were created, no thresholds changed, and no canonical source was rewritten or promoted to authority.

## Same-snapshot direct MSSR/Bridge connector parity — 2026-10-11

This is one exploratory connector-parity case, not an owner-adjudicated benchmark, accuracy estimate, reliability sample, or confidence calibration sample.

### Setup

- Both paths received the same fetched Markdown bytes from `.mssr/knowledge/architecture/semantic-evidence-plane.md`: 9,431 characters, 65 lines, source revision `97771c3da97e468d945d6d627024e322300bd336da48453688a1df202215cd94`.
- Exact fetched fingerprint: `55cc7dcec8e39fa0c7bd33415aa37a857416205c2e704fea1572929248ee1a83`.
- Query: “What must the host verify after Jev selects an exact evidence range before using it for a write or synthesis?”
- The first comparison accidentally included a terminal newline in local PowerShell output, which changed the derived revision. Re-reading both values as exact strings showed identical text; that attempt is excluded from the paired comparison.

### Results

- Direct MSSR and Bridge Librarian search returned the same 12 candidates in the same order, with matching `rangeId`, offsets, and lexical scores.
- Both Jev calls selected `heading-3` (lines 11–16), fingerprint `aa1a4555149ff2cfc27077271adf28530351cc4b4ef9c92b1a6647a27adecc67`. Choice confidence was 0.62 for both. Raw Noul values were 0.81 and 0.82; these are uncalibrated provider outputs, not calibrated confidence values.
- Both exact fetches passed and returned identical 769-character text.
- Both evidence packs passed with one unchanged paragraph (769 characters), identical citation fields and fingerprints, `advisoryOnly=true`, and `truthAuthority=false`.
- The Bridge path is associated with the runtime recorded above (Bridge 0.6.169 / MSSR 0.2.121). The exact direct-connector build and provider/model configuration were not captured in a persisted receipt, and no hashed request/result bundle was retained. Independent replay of this comparison is therefore unavailable.

### Interpretation and limits

This records one same-input path through search → Jev selection → exact fetch → cited evidence assembly across direct MSSR and Bridge. It supports observed connector/data-path parity for this case, not general semantic equivalence, answer correctness, source coverage, benchmark quality, reliability, or calibrated scores. Keep source bytes and serialization framing identical in future comparisons: host-output framing can create a false revision mismatch. No source, threshold, authority, or runtime was changed by this smoke.

### Trace provenance and replay limits

- Trace `mssr-codex-parity-provenance-20261011T1100Z` confirms the limit: Bridge evidence records its runtime/calls, but not connector namespace or full tool inputs/results. It cannot prove the direct MSSR build or Jev provider/model for this paired case; no hash-bound request/result receipt exists, so replay is unavailable.
- Future receipts should bind trace/call IDs, connector/tool/schema and runtime/package identities, observable Jev provider/model, exact source/query-input hashes, status, and canonical output hashes. Keep secrets and full prompts out of generic telemetry.
- The related packet `D:\MSSR-benchmark-artifacts\jev-shep-calibration-20261011-v1\jev-mssr-semantic-evidence-plane-atomic-20261011-v1` has manifest SHA-256 `4e338d6963edd8a87cf83ba7985e22c7f66477291169721888a44c2a9a91e0ac` and records Bridge 0.6.167 / MSSR candidate 0.2.120 / Jev `typesafe-jev` 1.13.0. It is a different atomic-query evaluation, not a receipt or replicate for this 0.6.169/0.2.121 parity case.
