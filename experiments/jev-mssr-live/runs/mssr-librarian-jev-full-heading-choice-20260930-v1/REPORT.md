# MSSR Jev Choice over the full heading catalog (exploratory)

## Question

How much of the top-100 Librarian → Jev miss rate comes from the deterministic shortlist omitting a useful exact section, and can Jev choose it when every heading section in the frozen MSSR corpus is offered?

This is a separate harness experiment, not a production integration. It uses the compiled MSSR `buildMssrMarkdownDocumentSurface` implementation to expose heading sections, then the exported `MssrJevSemanticCuratorProvider` with TypeSafe Jev `jev-1.13.0`.

## Protocol

- Same frozen corpus and paired query set as the parent experiments: 21 tracked MSSR documents and 26 English/Spanish query pairs; source commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`.
- The corpus contains 200 Markdown headings and 505 non-heading blocks. This run offers all 200 headings, each with its source reference, heading path and bounded leading-block hint, plus one `none` option: 201 choices total.
- A preflight outside the live runner confirmed all 26 exact target headings exist in the 200-heading catalog. The live runner reads the queries and corpus only. It does not read the labels or expected-target index; those are used only by the offline scorer.
- One Jev Choice call was made for each of the 52 queries. The same five-source grouped query holdout was retained; the 21 documents are still visible to the model.
- Credential Manager supplied the API key to the local process only. No credential value or raw vendor HTTP body was persisted.

## Results

All 52 Jev calls succeeded. The full-catalog run used 829,804 input tokens and 105,392 output tokens, with 409 ms mean observed request latency.

| Query language | Jev exact choice from top-100 shortlist | Jev exact choice from full heading catalog | Full-catalog only hits | Shortlist only hits |
|---|---:|---:|---:|---:|
| English | 12/26 (46.2%) | 18/26 (69.2%) | 8 | 2 |
| Spanish | 3/26 (11.5%) | 16/26 (61.5%) | 14 | 1 |
| Combined | 15/52 (28.8%) | 34/52 (65.4%) | 22 | 3 |

The full-catalog Choice selected an exact expected section on 22 cases where the top-100 pipeline did not; the top-100 pipeline selected an exact expected section on 3 cases where the full-catalog Choice did not. Net result: 19 additional exact-section selections across these 52 cases. On the grouped query holdout, full-catalog exact selection was 4/6 English and 5/6 Spanish, versus 3/6 and 0/6 from the top-100 pipeline. These are small, document-visible query groups, not unseen-document generalization.

## Exact-source fetch integrity

Every non-`none` Jev selection was rehydrated to an MSSR evidence handle and checked with the compiled `fetchMssrLibrarianEvidence` implementation against the frozen source Markdown. The top-100 pipeline selected 33 ranges: 32 exact fetches passed, 1 was rejected by the 20,000-character fetch limit, and 0 had a revision, range or fingerprint integrity failure. The full-heading selector selected 48 ranges: all 48 exact fetches passed, with 0 size-limit rejections and 0 integrity failures. These checks establish source-range integrity, not that the excerpt is semantically complete or that the cited section alone proves an answer.

## Cost and interpretation

The full-catalog request used about 65.6% more input tokens and 97.6% more output tokens than the top-100 Jev run (829,804 / 105,392 versus 501,232 / 53,347), with 409 ms versus 375.5 ms mean observed latency. Token counts are reported instead of a dollar estimate.

This result suggests that lexical shortlist recall was the main obstacle in this small Spanish set: all expected headings were present in the complete catalog, and Jev selected 16/26 Spanish targets from it. It does not prove production retrieval quality. The full catalog is only 200 headings; MSSR's broader retrieval limits allow substantially more, so a production system exceeding the provider's 255-choice limit would need a measured hierarchical selection strategy or another bounded candidate-generation stage. The 505 body blocks were not individually offered.

## Limitations

- Target labels were double-reviewed by Luna agents, not approved by the human document owner. A non-target section may still contain valid evidence, so exact-heading accuracy is conservative.
- Query translations and labels share the same 26-case benchmark. No confidence threshold was calibrated.
- Each section contributes only its heading path and a bounded leading-block hint; relevant evidence later in a section may not be visible to Jev.
- This measures one bounded Choice call followed by exact-source fetch validation, not Noul pairwise ranking, true contradiction adjudication, citation-grounded paragraph synthesis, compaction, follow-up grep, or write authority.
- Nothing here changes the MCP search path. Production Librarian search remains deterministic and does not invoke Jev.

## Next gate

Get human-approved labels that allow multiple acceptable evidence sections, expand to independently sampled source documents and query languages, and measure selection quality, abstention, exact fetch and citation fidelity separately. Before any production path, compare hierarchical selection with a high-recall lexical/metadata shortlist under explicit token and latency budgets. Keep any first integration shadow/review-only.

## Files

- `inputs/`: byte-identical frozen cases, labels, corpus and target index from the parent run.
- `runner.mjs`: full-catalog live Choice calls; no label input.
- `requests.json` / `responses.json`: bounded request evidence and normalized results.
- `score.mjs`, `scored-records.json`, `summary.json`: paired offline metrics.
- `manifest.json`, `SHA256SUMS`: source, input and artifact integrity records.
