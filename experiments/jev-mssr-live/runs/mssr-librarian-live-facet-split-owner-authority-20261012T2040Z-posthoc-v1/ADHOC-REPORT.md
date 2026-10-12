# Ad-hoc live Librarian/Jev facet and authority diagnostic

- **Execution window:** 2026-10-12 20:40:13–20:48:04 UTC
- **Classification:** post-hoc exploratory integration diagnostic; excluded from controlled-run denominators and all calibration claims.
- **Source revision:** MSSR branch `codex/mssr-librarian-query-variants-0.2.112`, HEAD `3f428c1a6cf9aa9d5998d923965cb0adedef5a49` (MSSR 0.2.127).
- **Live host:** MauroPrime Bridge 0.6.175, boot `165f4d43-61f9-4ba7-89d4-19e0add66d00`; Jev 1.13.0.
- **Scope:** real Markdown under `D:\Dev\mssr`; no source, threshold, or runtime change.

This note was assembled after the provider calls. No frozen manifest, raw request/response packet, preregistered labels, or holdout was created before inference. The exact prompt text is not reproduced here; the query intents and observable outcomes below are a derived record, not a replayable controlled benchmark. The calls are linked diagnostics over one project and overlapping documents, not independent benchmark units.

## Observed call path

The Bridge trace recorded 21 tool calls: 20 successful and one schema validation rejection. It includes 10 Librarian searches (9 successful), five Jev selections (5 successful), three evidence packs, one exact fetch, one initial skill load, and one final trace readback. All five Jev requests used `typesafe-jev` / Jev 1.13.0. Provider-reported Jev latency ranged from roughly 0.78 to 0.99 seconds. Bridge telemetry retained call status/timing and runtime identity, not raw prompts or tool arguments.

### Simple same-project smoke

A direct question about which section lists the 100 Jev use-case hypotheses used four explicit source files and the Project Context sidecar. The sidecar declared and projected all four supplied sources. Jev selected the exact `100 hipótesis de uso` heading (`jev-decision-model-use-cases.md`, `heading-9`, lines 78–211) from two search candidates. Provider confidence was 0.86, evidence sufficiency 0.69, usage 851 input / 67 output tokens, and latency 930.9 ms. Exact fetch returned 7,728 characters with fingerprint `9197101e89eee91feea5862c14ac1ec29c4a0036eb0fbf9d1e744a0e2306a1d5`; the evidence-pack call succeeded. This is a clear integration smoke, not an accuracy estimate.

### Sidecar source-scope control

The next search supplied exactly three files: `docs/decisions/0009-semantic-evidence-plane.md`, `.mssr/PROJECT_CONTEXT.md`, and `.mssr/PROJECT_STATE.md`. The manifest declared four sidecar entries; one projected and three were omitted as `source-not-provided`. An exact `domain=agent-orchestration` filter returned no candidates. Removing that filter returned lexical candidates (the requested top 12 were truncated). This is consistent with exact host-supplied filters and confirms that sidecar projection does not discover omitted source files.

One initial request used `maxSnippetChars=320` and was rejected because the live schema caps it at 240. The request was corrected to 220 before the successful searches; it made no Jev call and read no source. This was a caller-parameter error, not a product defect. Maintenance review: **reviewed-none**; no reusable code or routing correction is justified by one corrected input.

### Compound query and split facets

The compound question asked who supplies/authorizes source references and what prevents Jev from becoming an authority or initiating an autonomous scan. Search returned eight exact-fetchable candidates, including ADR 0009 §3.1. Jev abstained: provider confidence **0.35**, evidence sufficiency **0.31**.

The same intent was then split into two single-facet questions:

| Facet | Jev result | Provider confidence | Evidence sufficiency | Exact selected range |
| --- | --- | ---: | ---: | --- |
| Who supplies the exact Markdown source references? | selected | 0.73 | 0.46 | ADR 0009, `block-27`, line 108 |
| Does Jev establish source authority, permission, or canonical truth? | selected | 0.45 | 0.54 | ADR 0009, `block-43`, line 167 |

The selected handles were revalidated and packaged together. The pack returned unchanged source text with two citations, 808 + 209 = **1,017 characters** total, and `advisoryOnly=true`, `truthAuthority=false`, `canonicalRewriteAllowed=false`:

- `block-27`, line 108, fingerprint `951db1ca110f6e085bfdcb2cda7f47f014ffdb41119c2f67497881a6abff1069`, citation `docs/decisions/0009-semantic-evidence-plane.md:L108-L108`.
- `block-43`, line 167, fingerprint `7a2c3f01ffae957a848224815295753a80680c1513f0a33e2d7a30b4f713f1b1`, citation `docs/decisions/0009-semantic-evidence-plane.md:L167-L167`.

This demonstrates a host-driven **split → select → exact evidence union** on one example. The evidence pack preserves exact ranges; it does not synthesize prose. The host remains responsible for decomposition, deciding whether the union covers every facet, composing any answer, and retaining citations.

### False-premise control

The adversarial question asked which response field authenticates the caller-asserted project owner. Search returned eight candidates, including the relevant ownership/authority sections. Jev abstained with provider confidence **0.53**, evidence sufficiency **0.31**, and `none` probability **0.58**. No evidence was fetched from an unselected candidate.

A blind GPT-6 Luna subagent independently read only the canonical sources; it did not inspect Jev results or call Jev. Its source-only review judged the first three questions answerable from the cited union and the final premise unsupported: no field authenticates the caller-asserted owner. This is analyst review, **not repository-owner gold**.

## Interpretation and next gate

- The real Bridge → sidecar/search → Jev → exact fetch/evidence-pack path is operational for these calls.
- Jev handled two narrow facets and the false premise conservatively, but abstained on the compound question. The useful pattern is host-side facet decomposition plus a cited union; automatic query decomposition, semantic coverage gating, and paragraph synthesis remain untested.
- The sidecar projected only declarations whose exact source files were supplied. Current `sourceRefs` selection is still host-owned. A project-root-plus-question discovery adapter remains the next architecture gate and belongs in the host/Bridge I/O layer, not the portable MSSR pure contract.
- Exact fetch and citation preservation remain stronger than retrieval breadth and semantic completeness. Search candidate lists contained nested parent/child ranges; Jev still selected the exact child for both split facets in this packet.
- Provider confidence and evidence sufficiency were descriptive and uncalibrated. Do not treat 0.35–0.73 as correctness percentages or adjust a decision threshold from this packet.
- All diagnostic cases share one project and reuse overlapping sources. They do not approach the controlled protocol's 30-independent-unit floor and cannot support superiority, reliability, promotion, or production-safety claims.
