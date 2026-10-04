# Blind range proposals — 2026-10-04

**Status:** machine-generated review proposals for later human adjudication. These are not gold labels, accepted ranges, answer-quality scores, or calibration data.

## Frozen review provenance

- Both read-only reviewers used MSSR source commit `ad9a46ad2c0d95dc012fe1e07049bfd45cc3c330`.
- Each Spanish/English pair was treated as one query. Neither reviewer was shown the candidate bank or source anchors.
- `R1` is `range_proposal_a`; `R2` is `range_proposal_b`. They are two `gpt-6-luna` proposals, not independent human reviewers.
- Range pointers below are verbatim in substance from their outputs. They are leads for adjudication, not accepted citations. Cases where the two proposals disagree must be resolved against one frozen source snapshot before use.
- No Jev or Noul call was made. No answer labels, thresholds, or benchmark scores were created.

## Per-case answerability and range proposals

| Case | R1 proposal and cited range | R2 proposal and cited range |
|---|---|---|
| C01 | sufficient — `.mssr/knowledge/architecture/architecture-impact-review-history.md`, “Coarse and structural refinement” / “Derived invariants…”, 9–13 | sufficient — `.mssr/knowledge/architecture/architecture-impact-review-decision.md`, “Architecture impact review decision”, 1–3; or `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 1–3 |
| C02 | sufficient — `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md`, “What the MSSR runs establish”, 8–29 | partial — `docs/HANDOFF_SEMANTIC_EXPERIENCE_LAYER_2026-09-29.md`, “Current automation and remaining learning gate”, 144–150 |
| C03 | sufficient — `changelogs/0.2.55.md`, “Changes” and “Verification”, 11–21 | unanswerable — no specific range; the query does not identify which package warning/follow-up it means |
| C04 | sufficient — `.mssr/knowledge/research/jev-decision-model-use-cases.md`, “100 hipótesis de uso”, 85–89 | unanswerable — no exact inventory range identified |
| C05 | sufficient — `.mssr/knowledge/decision/mssr-learning-activation-decision.md`, 1; `docs/LEARNING_LOOP.md`, 5–16 | sufficient — `.mssr/knowledge/decision/mssr-learning-activation-decision.md`, 1; `.mssr/PROJECT_STATE.md`, 168–170 |
| C06 | sufficient — `.mssr/knowledge/pattern/mssr-change-history-contract.md`, 1–3 | sufficient — same file, 1 |
| C07 | sufficient — `.mssr/knowledge/architecture/project-document-reference-lifecycle.md`, “Retroactive discovery”, 16–20 | partial — `src/project-document-references.ts`, registration plan 49–79 and apply/readback 101–148 |
| C08 | sufficient — `.mssr/knowledge/architecture/project-document-reference-lifecycle.md`, “Reference-on-miss” / “Forward registration”, 22–32 | sufficient — `src/project-document-references.ts`, `planMssrProjectDocumentReferenceRegistration`, 49–79 |
| C09 | sufficient — `.mssr/knowledge/decision/semantic-consistency-current-truth.md`, “R4 temporal validity”, 11–15 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 3; or `docs/PROJECT_CONTEXT.md`, 153–157 |
| C10 | sufficient — `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md`, “Keep source evidence separate from Jev judgment”, 60–65 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 5 |
| C11 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 1–7 | sufficient — `docs/AGENT_PROTOCOL.md`, “Routing evidence checkpoint and notices”, 102–110 |
| C12 | sufficient — `.mssr/knowledge/architecture/semantic-evidence-plane.md`, “Progressive section retrieval” / “Document Surface…”, 11–20; `.mssr/knowledge/decision/semantic-consistency-relations-retrieval.md`, 3–5 | sufficient — `docs/decisions/0009-semantic-evidence-plane.md`, “Hierarchical Markdown and skill indexing”, 72–92, and “Document Surface and the Librarian contract”, 98–106 |
| C13 | partial — `docs/AGENT_PROTOCOL.md`, “Friction and learning loop”, 218–225; “Stages and phases”, 142–149 | sufficient — `docs/AGENT_PROTOCOL.md`, “User-visible progress contract”, 114–129 |
| C14 | sufficient — `.mssr/knowledge/decision/human-task-identity.md`, 1–7 | sufficient — `docs/AGENT_PROTOCOL.md`, “Stable human-task identity above traces”, 76–80 |
| C15 | sufficient — `.mssr/knowledge/architecture/context-economy-v2.md`, 3–11 | partial — `docs/AGENT_PROTOCOL.md`, “Intent envelope”, 9–18; “Selective procedural context”, 42–54 |
| C16 | sufficient — `AGENTS.md`, project ownership, 29–35 | sufficient — `docs/AGENT_PROTOCOL.md`, 32–40; `.mssr/knowledge/architecture/canonical-ownership.md`, 1 |
| C17 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 3–5; `.mssr/knowledge/architecture/architecture-impact-review-history.md`, 5 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 3; `.mssr/PROJECT_STATE.md`, 5–6 |
| C18 | sufficient — `.mssr/PROJECT_STATE.md`, “Current release” and historical 0.2.98 receipt, 3–12 | sufficient — same sections, 3–4 and 10–12 |
| C19 | sufficient — `.mssr/knowledge/architecture/semantic-evidence-plane.md`, coverage contract, 27–29 | sufficient — `docs/decisions/0009-semantic-evidence-plane.md`, “Producer coverage and negative-claim safety”, 114–122 |
| C20 | sufficient — `.mssr/knowledge/architecture/semantic-evidence-plane.md`, “Progressive evidence acquisition”, 39–56 | sufficient — `docs/decisions/0009-semantic-evidence-plane.md`, “Progressive evidence acquisition”, 182–220 |
| C21 | sufficient — `.mssr/knowledge/decision/mssr-first-party-skill-direction.md`, 3; `changelogs/0.2.55.md`, 11–14 | partial — `docs/decisions/0009-semantic-evidence-plane.md`, 90–92; `docs/AGENT_PROTOCOL.md`, 42–54 |
| C22 | sufficient — `.mssr/knowledge/decision/canonical-project-context-cutover.md`, 1–7 | partial — `docs/AGENT_PROTOCOL.md`, “Project context and context budget”, 29–35 |
| C23 | sufficient — `docs/REGISTRY.md`, “Provider model” and “Degradation”, 18–23 and 45–50 | sufficient — `AGENTS.md`, “Structured skill routing”, 43–46; `docs/decisions/0009-semantic-evidence-plane.md`, 114–122 |
| C24 | sufficient — `.mssr/knowledge/architecture/project-context-librarian-metadata.md`, “Projection and stale-data behavior”, 30–46 | sufficient — `docs/PROJECT_CONTEXT.md`, 141–143; or `docs/decisions/0009-semantic-evidence-plane.md`, 98–102 |
| C25 | sufficient — `experiments/CONTROLLED_RUN_PROTOCOL.md`, manifest `labels`, `split`, and `plan`, 102–124 | sufficient — same protocol, “Labels, holdouts, and claims”, 162–182 |
| C26 | sufficient — `docs/FIRST_PARTY_SKILLS_V1.md`, “Opt-in migration”, 69–76 | unanswerable — no precise range identified |
| C27 | sufficient — `docs/OPERATIONAL_NOTICE_PLANE.md`, “What this is not” / semantic-delivery split, 16–27 and 93–100 | partial — `docs/AGENT_PROTOCOL.md`, 114–116 and 139 |
| C28 | sufficient — `docs/LEARNING_LOOP.md`, digest contents and empirical rates, 18–46 | sufficient — `docs/AGENT_PROTOCOL.md`, “Selective procedural context”, 42–54 |
| C29 | sufficient — `.mssr/knowledge/architecture/jev-confidence-merge-evaluation.md`, “Confidence and merge policy”, 114–151 | sufficient — `docs/decisions/0009-semantic-evidence-plane.md`, 225–229 and 265–267 |
| C30 | sufficient — `.mssr/knowledge/operations/jev-librarian-integration-handoff.md`, “Repository snapshot and preservation” / “Product lineage audit”, 14–28 and 43–52 | unanswerable — no precise range identified |
| C31 | sufficient — `.mssr/knowledge/architecture/architecture-impact-review-history.md`, “Derived invariants…reviewed-current receipts”, 11–13 | partial — `.mssr/knowledge/architecture/architecture-impact-review-decision.md`, 3 |
| C32 | sufficient — `.mssr/knowledge/operations/mssr-project-knowledge-drift-review.md`, 1–7 | sufficient — same source, “Project knowledge drift review decision”, 1–3 |

## Disagreement review before any benchmark use

- **C02:** R1 points to a benchmark-history document that enumerates real runs and explicitly says their labels are not independently adjudicated. R2 points to an experience-layer handoff describing shadow categories and the independent-verification gate. The query's “which examples” wording needs a human decision about whether examples means run types, persisted shadow events, or per-example records. Neither proposal establishes gold labels.
- **C03:** The query is anchored to the current “Core skill package state,” which does not identify a package warning in the pinned snapshot. R1 found an older, concrete 0.2.55 warning, but it is not shown to be the warning intended by the query. Treat current answerability as unresolved; rewrite the query to name the warning or require abstention.
- **C04:** R1 found the requested inventory heading; R2 did not identify it. The exact heading/range should be confirmed in the frozen source before treating this as a retrieval miss or an answerability failure.
- **C07, C13, C15, C21, C22, C27, C31:** Differences mix answerability judgments with citation selection. In particular, C13 and C27 have direct protocol/notice sections that should be checked against the query before accepting a partial label from a less-specific citation.
- **C26 and C30:** R1 found direct historical sources while R2 abstained. These cases test source discovery and historical scoping; they do not establish current installer behavior or current Git state.

The owner must adjudicate each query, accepted exact range(s), answerability, abstention, and temporal/contradiction scope against one frozen source snapshot. Keep bilingual variants and related source/concept clusters together. Only then may the labeled set enter the separate pre-registered Jev/Noul benchmark workflow.
