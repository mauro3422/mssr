# Provisional source/concept cluster map — 2026-10-04

**Status:** review aid only. No case labels or independent-unit claims are created by this map. Do not use it as a calibration/test split manifest until the owner adjudicates the case relationships against the frozen source snapshot.

## Basis and limits

- The owner worksheet describes 32 bilingual query pairs (one case per pair), 28 unique paths cited by its proposed ranges, and a 30-file frozen source manifest. The candidate bank separately has 27 primary anchor paths; these are different counts because a worksheet case can cite alternative files.
- I parsed the worksheet's per-case candidate-range source references. Four exact paths are shared across cases: C02/C03/C18, C07/C08, C12/C19/C20, and C13/C21.
- If every exact shared-source component stays in one partition, these four components reduce 32 cases to at most 26 source-connected components (`32 - (3-1) - (2-1) - (3-1) - (2-1) = 26`). This is an upper bound before semantic dependencies, not a confirmed count of statistically independent units. The worksheet's 30-unit reporting floor is therefore not reachable with the present 32 cases under this conservative source rule; at least four additional independent cases would be needed, and semantic links may require more.
- The two blind range proposals reviewed source commit `ad9a46ad2c0d95dc012fe1e07049bfd45cc3c330`, while the owner worksheet and v3 run freeze MSSR `e3e03912d63231ebf646fdaec9353ee1e28fe403`. Re-read and re-hash every proposed range against the `.104` frozen snapshot before adjudication. Luna proposals are not labels or gold data.

## Exact shared-source components

| Provisional group | Cases | Shared cited path | Why keep together for a split |
| --- | --- | --- | --- |
| S1 | C02, C03, C18 | `.mssr/PROJECT_STATE.md` | Learning-dataset status, package state, and current release claims draw from the same state authority. C02 and C03 also need query-stem review; C03's “warning” premise is unresolved in the frozen current-state section. |
| S2 | C07, C08 | `.mssr/knowledge/architecture/project-document-reference-lifecycle.md` | Both ask about reference registration and miss/registration behavior in the same lifecycle contract. |
| S3 | C12, C19, C20 | `.mssr/knowledge/architecture/semantic-evidence-plane.md` | Exact retrieval, producer coverage, and bounded acquisition are adjacent parts of the same plane and reuse the same evidence. |
| S4 | C13, C21 | `docs/AGENT_PROTOCOL.md` | Both depend on agent protocol requirements; C21 also has a second source in first-party skill direction. |

## Additional topic links for owner review

These links are conservative candidates, not automatic unions. Confirm whether the shared decision concepts could leak between a calibration partition and holdout; if yes, keep the cases together.

| Cases to review together | Relationship to inspect | Caveat |
| --- | --- | --- |
| C01, C32 | Conflicting architecture evidence and owner-controlled knowledge maintenance | Different source files; determine whether both exercise the same review/authority decision. |
| C02, C05, C29 | Learning-example/label state, automatic activation authority, and confidence/synthesis gates | Check whether the same learning outcomes or authority rules would leak across partitions. |
| C04, C29 | Jev use-case inventory versus confidence/synthesis gates | Broad shared subject only; questions may test distinct skills. |
| C09, C10 | Temporal validity/supersession versus similarity and verified relations | Check whether the same contradiction examples or rules appear in the frozen snapshot. |
| C19, C23 | Missing producer instrumentation versus empty/stale provider catalogs | Both test when absence of evidence can and cannot justify a negative capability claim. |
| C13, C14 | Trace lifecycle and separate human-task identity | C13 already belongs to exact-source group S4; C14 may extend that component. |
| C17, C30 | Runtime adoption evidence versus historical branch/evidence lineage | C30 is explicitly historical; preserve that temporal distinction while checking dependence. |
| C25, C29 | Calibration/holdout separation versus Jev confidence and synthesis gates | Strong candidate for same partition because both can expose threshold policy. |
| C15, C21 | Context-budget omission versus progressive skill/reference activation | Review for shared examples and common policy rather than grouping solely by vocabulary. |

## Supplementary candidate review

The separate v2 seed scan proposes P01 (portable event-evaluator invariants)
and P03 (routing/fixture governance) for possible MSSR-core review. Neither is
part of C01–C32 or this component count. Even if an owner accepts both and
confirms each is source/concept-independent, the source-only upper bound would
rise from 26 to at most 28, still below the 30-unit reporting floor; their
possible links to existing cases may reduce it further. P02, P04, P05, and P06
are candidates for separate OpenCode, visual-skill, Windows/Git, and
Roblox/Bridge suites. See
`review-proposals/2026-10-04-candidate-seed-scan-v2.md`; these are scope and
clustering proposals, not labels or approved partitions.

## Cases needing query or source adjudication before splitting

- **C02:** “Which learning examples” can mean run types, persisted shadows, or labeled per-example records. Choose one observable target in the frozen source.
- **C03:** “What warning” does not identify a warning in the cited current-state section. Rewrite to name the warning or label the case ambiguous/unanswerable for that snapshot.
- **C13/C16/C18/C19/C25/C30:** the worksheet flags a weak/original anchor, a repaired stem, a range that is context-only or too narrow, or source drift. Verify wording and citations against the frozen `.104` source, not current prose.
- The blind proposals also differ on sources and/or answerability for **C01/C02/C03/C04/C07/C13/C16/C18/C19/C21/C22/C24/C25/C26/C27/C30/C31**. Some alternatives may both be valid; this is a review queue, not a list of known failures. In particular, recheck C24 against the canonical sidecar contract and C01 against both the decision and history documents. A disagreement is not a label.

## Split and calibration gate

1. Have two reviewers independently label answerability, every acceptable exact range, sufficiency, expected abstention, and contradiction/temporal relation where relevant. Keep their labels blind to Jev output; an owner resolves disagreements and records rationale/date.
2. Confirm exact-source components and adjudicate the topic links above. Then recompute connected components and publish a versioned cluster/split manifest with source revisions and hashes.
3. Do not claim the 30-unit reporting floor from 32 cases. Expand with genuinely distinct source/concept cases until the owner-reviewed grouping supports the intended evaluation; the floor is not a sample-size guarantee.
4. Only then freeze separate calibration and unopened grouped holdout partitions. Tune probability thresholds on calibration data; evaluate the holdout once with accepted-set accuracy/recall, abstention risk/coverage, and Brier/log loss only where probabilities and outcomes are well-defined.

Until these steps are complete, all prior strict-heading scores, Brier/log-loss diagnostics, AI reviews, and the natural-query v3 remain exploratory. Confidence and thresholds are uncalibrated.
