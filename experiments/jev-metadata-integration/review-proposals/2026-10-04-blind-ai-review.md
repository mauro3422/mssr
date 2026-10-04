# Blind AI review proposal — 2026-10-04

**Status:** unadjudicated proposal for human review. These are not gold labels,
benchmark outcomes, acceptable-range annotations, or confidence-calibration
data.

## Frozen review provenance

- MSSR source revision read: `ad9a46ad2c0d95dc012fe1e07049bfd45cc3c330`.
- Query-only input SHA-256: `267CD320255C9ECD14ACF40BB5478482B7430A6F3E83AA77A8877196FE71DF93`.
- Two separate `gpt-6-luna` reviewers at low reasoning effort assessed the
  18 English/Spanish paired questions. They were not shown candidate anchors,
  Jev/Noul outputs, the candidate bank, `PROJECT_MEMORY`, or adjacent
  `PROJECT_STATE` history. They read MSSR source independently; neither saw
  the other review before submitting.
- No Jev or Noul provider call was made. Reviewer outputs are AI-generated
  proposals from one model family, so their agreement is not statistical
  independence or human adjudication.
- The review question was whether the visible source set sufficiently answers
  each query. Reviewers did not author the benchmark's gold answer, accepted
  exact-range alternatives, or final abstention labels.

## Category agreement

| Case IDs | Reviewer A | Reviewer B | Proposal |
|---|---|---|---|
| C01 | sufficient | sufficient | sufficient |
| C02 | partial | partial | partial; source states cross-project shadows and an independent-label gap, but does not enumerate examples |
| C03 | partial | partial | partial; the permitted current package section does not state the query's warning or later verification |
| C04–C18, except C02/C03 | sufficient | sufficient | sufficient |

Agreement is 18/18 on this coarse sufficiency category: 16 sufficient, 2
partial. It is not a quality score for Jev or the Librarian. C03 specifically
needs an abstention or a narrower question unless its evidence scope is
expanded; reviewers correctly declined to infer the missing warning from
neighboring state history. C02 supports only the aggregate label-gap claim,
not an example-by-example inventory. C16's ownership evidence also varied by
reviewer; the owner should adjudicate against the canonical ownership contract.

## Evidence pointers from the blind reviews

All line numbers below refer to source revision `ad9a46a` above. Paths are
repository-relative to `D:\Dev\mssr`.

| ID | Reviewer A source | Reviewer B source |
|---|---|---|
| C01 | `.mssr/knowledge/architecture/architecture-impact-review-decision.md`, “Architecture impact review decision,” lines 3–5 | `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, “Project knowledge drift review decision,” lines 3–5 |
| C02 | `.mssr/PROJECT_STATE.md`, “Learning dataset state,” lines 170–172 | Same section, lines 170–172 |
| C03 | `.mssr/PROJECT_STATE.md`, “Core skill package state,” lines 174–176 | Same section, lines 174–176 |
| C04 | `.mssr/knowledge/research/jev-decision-model-use-cases.md`, summary and “100 hipótesis de uso,” lines 14, 85, 141 | Same source, “E. MSSR, contexto y conocimiento del proyecto,” lines 141–152 |
| C05 | `.mssr/PROJECT_STATE.md`, “Learning dataset state,” line 172 | `.mssr/knowledge/decision/mssr-learning-activation-decision.md`, line 3 |
| C06 | `docs/PROJECT_CONTEXT.md`, changelog contract, lines 198–211 | `.mssr/knowledge/pattern/mssr-change-history-contract.md`, line 3 |
| C07 | `.mssr/knowledge/architecture/project-document-reference-lifecycle.md`, “States” and “Forward registration,” lines 11–12, 20, 28–32 | Same source, “States,” lines 7–14 |
| C08 | Same source, “Reference-on-miss” and “Forward registration,” lines 22–32 | Same source, “Reference-on-miss,” lines 22–26 |
| C09 | `.mssr/knowledge/decision/semantic-consistency-current-truth.md`, “R4 temporal validity,” line 13 | Same source, lines 11–13 |
| C10 | `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, line 5 | Same source, line 5; `.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md`, line 5 |
| C11 | `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, lines 3, 5 | `docs/AGENT_PROTOCOL.md`, “Routing evidence checkpoint and notices,” lines 102–110 |
| C12 | `.mssr/knowledge/architecture/semantic-evidence-plane.md`, lines 11–19 | Same source, lines 11–19 |
| C13 | `docs/AGENT_PROTOCOL.md`, “User-visible progress contract,” lines 114–129 | Same source, lines 118–129 |
| C14 | `.mssr/knowledge/decision/human-task-identity.md`, lines 3–7 | `docs/AGENT_PROTOCOL.md`, “Stable human-task identity above traces,” lines 76–82 |
| C15 | `.mssr/PROJECT_CONTEXT.md`, line 9; `.mssr/knowledge/architecture/context-economy-v2.md`, lines 5, 9, 11 | `docs/AGENT_PROTOCOL.md`, “Selective procedural context,” lines 49–52 |
| C16 | `.mssr/PROJECT_CONTEXT.md`, “Architecture,” line 15; `docs/PROJECT_CONTEXT.md`, ownership contract, line 280 | `docs/AGENT_PROTOCOL.md`, lines 32–40; `.mssr/knowledge/architecture/canonical-ownership.md`, line 1 |
| C17 | `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, line 5 | Same source, line 5; `docs/ARCHITECTURE.md`, lines 175–178 |
| C18 | `.mssr/PROJECT_STATE.md`, “Current release,” lines 3–4 | `.mssr/PROJECT_STATE.md`, “0.2.98 package release receipt — historical,” lines 10–12; “Current release,” lines 3–4 |

## Required human adjudication

For each case, the owner should record an answerability decision, the canonical
answer, acceptable exact source ranges (including alternatives), required
abstention behavior, and any temporal/contradiction relation. Inspect the
source at the frozen revision. Resolve C02/C03 and C16 explicitly; do not copy
these sufficiency categories into the gold set. Keep Spanish/English variants
and shared source/concept cases in the same data split. A separate immutable
provider-run receipt must be prepared and reviewed before a live Jev run; the
exact user authorization token for that run is `START_JEV`.
