# MSSR Librarian → Jev candidate selection (exploratory)

## Question

Can live Jev select the expected exact Markdown section from the top 100 sections returned by MSSR's current deterministic Librarian, for English and Spanish queries over the same frozen MSSR corpus?

This is an isolated benchmark harness, not a production integration. It calls the same compiled `searchMssrLibrarianEvidence` implementation used by the MSSR evidence MCP handler, then the exported MSSR `MssrJevSemanticCuratorProvider` with TypeSafe Jev `jev-1.13.0`.

## Protocol

- Corpus and query set are byte-identical to the parent run `mssr-librarian-bilingual-retrieval-20260930-v1`: 21 tracked MSSR documents, 26 paired English/Spanish queries.
- For each query, the deterministic Librarian returns 100 ranked candidate sections. Jev receives the query, each candidate's source reference, heading path and bounded excerpt, and one `none` option. It chooses one option in one closed Choice question.
- Expected section labels, target index and scoring code are not loaded by the live runner and are not included in Jev requests. They are joined to responses only by `score.mjs` after all calls finish.
- The corpus was frozen at MSSR commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. Queries were processed sequentially. No candidate list was tuned after inspecting scores.
- The five-source grouped holdout is inherited from the baseline split and was reserved before scoring. It separates query cases by target source reference; the same 21-document corpus is still visible to the system.
- Credential Manager supplied the key to this one process only. The credential value, raw vendor HTTP bodies and raw provider errors were not written to the run.

## Results

All 52 Jev calls succeeded. Jev used 501,232 input tokens and 53,347 output tokens; mean observed request latency was 375.5 ms.

| Query language | Expected section in Librarian top 100 | Jev chose exact expected section | Exact choice, conditional on target offered | Exact targets selected from baseline rank >5 |
|---|---:|---:|---:|---:|
| English | 18/26 (69.2%) | 12/26 (46.2%) | 12/18 (66.7%) | 12 |
| Spanish | 4/26 (15.4%) | 3/26 (11.5%) | 3/4 (75.0%) | 2 |
| Combined | 22/52 (42.3%) | 15/52 (28.8%) | 15/22 (68.2%) | 14 |

On the grouped holdout, English targets were offered for 5/6 queries and selected exactly for 3/6 (3/5 when offered). Spanish targets were offered for 0/6 queries, so this holdout provides no evidence about Jev's Spanish selection quality; all six failures occurred before Jev had the expected section to choose.

The current deterministic baseline put the exact target first for 0/26 queries in either language. Jev often selected an exact target that the baseline ranked below fifth (14 cases). This is evidence that a Jev choice stage can improve selection among a supplied shortlist on these cases; it does not repair shortlist recall. In particular, 22/26 Spanish expected sections never reached Jev.

A paired audit rehydrated every non-`none` selection as a candidate handle and checked it with MSSR's compiled exact-fetch implementation. Of 33 selected ranges, 32 passed; one exceeded the 20,000-character fetch limit; none had a revision, range or fingerprint integrity failure. The separate full-heading run reports both pipelines' fetch counts and the expanded-catalog result.

## Interpretation and limits

- The strongest observed result is conditional: when the expected section was present in the top 100, Jev selected it in 12/18 English cases and 3/4 Spanish cases. The Spanish denominator is very small.
- Overall exact-section selection was 15/52. This conservative metric can mark a semantically useful alternate section wrong because labels identify one expected heading, not every acceptable evidence section.
- Labels and Spanish query translations were reviewed by two Luna agents, not adjudicated by the human document owner. Treat every score as exploratory, not gold-standard quality evidence.
- The grouped holdout protects against tuning this small query set; it is not an unseen-document test because the source documents remained available as candidate data.
- The selected-choice confidence values are descriptive only. This run does not calibrate confidence or establish an acceptance threshold.
- Every candidate list was limited to the Librarian's top 100. This tests one Jev Choice decision plus an offline exact-fetch audit, not Noul pairwise scoring, full ranking, autonomous follow-up searches, paragraph generation, compaction, citation synthesis, contradiction adjudication, or write authority.
- The run does not change MSSR or MauroPrime Bridge behavior. The public Librarian search tool remains deterministic and does not call Jev automatically.

## Next evaluation gate

Improve and independently label candidate recall first, especially cross-language retrieval, then replay the same Jev choice protocol on a larger source-grouped query set with human-approved acceptable evidence sections. Keep selection review-only until candidate recall, exact-source fetch integrity, alternate-valid-section adjudication, abstention and citation fidelity are measured separately. Do not infer confidence thresholds from this run.

## Files

- `inputs/`: frozen copies of the cases, labels, corpus and expected-section index.
- `runner.mjs`: live retrieval and Jev Choice calls; reads cases and corpus only.
- `requests.json` / `responses.json`: bounded request evidence and normalized outcomes; no credential or raw HTTP body.
- `score.mjs`, `scored-records.json`, `summary.json`: offline scoring and aggregate metrics.
- `manifest.json`, `SHA256SUMS`: source, input and artifact hashes for integrity checks.
