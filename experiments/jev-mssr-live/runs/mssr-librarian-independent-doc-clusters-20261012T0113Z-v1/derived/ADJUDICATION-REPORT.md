# Adjudication report — independent-document diagnostic v4

## Scope and provenance

This exploratory run evaluated three prospective questions against three current MSSR documents: `docs/ARCHITECTURE.md`, `docs/ROUTING_EVIDENCE_OBSERVATORY.md`, and `docs/skill-routing/INCIDENTS.md`. Before provider calls, each exact `sourceRef` was absent from the preceding 54 run directories, and no byte-identical archived Markdown snapshot was found. The frozen labels record this audit. Indirect prior exposure cannot be ruled out; these are document-disjoint diagnostic cases, not owner-gold labels or a protected holdout. Three documents do not establish statistical independence or a reliability estimate.

The source baseline was MSSR commit `9f0e4c8aed2237a76b3f5757e1555828e0122a52`; the production Bridge was 0.6.172, boot `ced583a2-8431-486a-bdb4-0f7d24928ff2`, with the 189-tool catalog hash `fe34a30b4af0975a`. The run made three Jev provider calls. It did not change the production package, thresholds, or selection policy.

## Retrieval, exact fetch, and live parity

All three cases found the expected search target, selected the expected exact range, fetched the selected handle, passed the source fingerprint check, and built an individual evidence pack (3/3 for each reported gate). Re-executing the same cases through the active Bridge selected the same handle and range as the isolated release adapter in all three cases. Live fetch handle/fingerprint and evidence-pack citation/text checks passed 3/3. This is runtime parity for these cases, not a second independent quality sample.

The live Bridge union pack retained three exact citations and 747 source characters. Its verification confirms matching selected handles, source revisions, fingerprints, fetched text and citations; it also confirms `advisoryOnly=true`, `truthAuthority=false`, and `canonicalRewriteAllowed=false`. The pack shows that verified evidence can be combined without promoting the union to truth authority or permission to rewrite canonical sources.

| Case | Isolated Choice / sufficiency | Live Choice / sufficiency | Exact range, fetch, and pack | Blind answer review |
|---|---:|---:|---|---|
| Bridge semantic ownership | 0.96 / 0.83 | 0.95 / 0.82 | Pass | Direct; low overbreadth |
| Notice fields and action limit | 1.00 / 0.93 | 1.00 / 0.93 | Pass | Direct; low overbreadth |
| `skill_recommend` compatibility correction | 0.55 / 0.83 | 0.57 / 0.84 | Pass | Partial; medium overbreadth |

Choice and evidence-sufficiency values are raw descriptive provider outputs. This run does not validate them as probabilities, calibrate a threshold, or show that high scores imply a correct or complete answer. The third case is a useful counterexample: the exact target was retrieved at a lower raw Choice score, while the cited answer was only partial after composition added unsupported context.

## Blind review and composition correction

One blind Luna reviewer, given only `derived/BLIND-REVIEW-INPUT.md`, rated the first two answers direct with low overbreadth and the third partial with medium overbreadth. No answer was marked unsupported or ambiguous, and the review found no causal overclaim. The third draft added “incidente MSSR-014” and “corrección registrada,” which were not supported by its selected/fetched line. The host removed those additions in `derived/HOST-COMPOSED-PARAGRAPH.md`; the original blind input and result remain preserved. A fresh Luna reviewer then rated the corrected paragraph Direct with low overbreadth on all three sentences and found no unsupported factual or causal additions (see `derived/BLIND-REVIEW-CORRECTED.md`). This is a second review of a different answer version: the initial 2-direct/1-partial count remains valid for the original draft, while the corrected paragraph received 3/3 direct. Do not combine the two counts as if they scored the same composition.

The corrected composition now passes one independent blind re-review against its exact cited passages. The next quality gate is broader owner-gold evaluation across more unseen document clusters, separately scoring retrieval integrity, completeness, and overbreadth. The frozen source, provider responses, labels, and original review remain unchanged.

## Recording and verifier errata

The runner reports label/adjudication status as “not declared” because `manifest.json` declares only the labels file path and SHA-256. The frozen `inputs/labels.json` does contain the prospective adjudication description, including the document-disjoint audit and holdout limitation. The manifest and frozen `summary.json` are preserved; `derived/MANIFEST-LABEL-ADJUDICATION-ERRATUM.md` records the mismatch and points to the hashed label file as the authoritative declaration.

The first derived live parity check expected local-adapter field names for fetch results and therefore recorded false values even though the Bridge fetches had succeeded. The raw live payload is preserved unchanged. `derived/LIVE-BRIDGE-RUNTIME-ERRATUM.md` documents the schema mismatch, and `derived/live-bridge-runtime-parity-verification.json` independently checks the Bridge response shape: exact handle, fingerprint, citation and fetched text all pass 3/3.

## Conclusion and next evaluation gates

This run demonstrates a narrow, useful path: MSSR search surfaces a document range; Jev selects a bounded candidate; the host fetches exact source bytes; the pack preserves citations and fingerprints; and the host can compose a short answer from a verified union. The active Bridge agrees with the isolated adapter on the three exact handles. The principal observed weakness here was answer composition adding context beyond the fetched range; the score itself did not detect that issue.

Do not pool these cases with linked or previously exposed runs as independent observations. Do not set a confidence threshold from these values, claim model calibration, claim protected-holdout quality, or promote automatic multi-facet planning from this result. Next useful work is: blind-rate the corrected paragraph; create a larger owner-gold set with explicit question, required-facet and abstention labels; score answer completeness and overbreadth separately from retrieval/fetch integrity; then test confidence calibration on held-out clusters after exposure tracking is complete.

## Repository consistency gate

A review-only `project_change_consistency` call returned `ok=true`, `publishReady=false`, with warnings: current release changelog/context claims are not part of this observed change set, and Project Context Health remains at `review`. This packet and its state update are experimental evidence, not an MSSR package release; no versioned changelog, package version, or production behavior was changed. The warnings therefore remain a release-readiness limitation and are not reported as a successful release gate. The user-requested normal push persists only the experiment branch and current-state/ledger documentation.
## Evidence files

- Frozen run inputs and provider records: this run's `manifest.json`, `records.jsonl`, `request-events.jsonl`, `inputs/`, and `summary.json`.
- Live parity: `derived/live-bridge-runtime-parity.json`, its corrected verification JSON, and `derived/LIVE-BRIDGE-RUNTIME-ERRATUM.md`.
- Union: `derived/live-bridge-union-evidence-pack.json` and `derived/live-bridge-union-verification.json`.
- Blind review and corrected composition: `derived/BLIND-REVIEW-INPUT.md`, `derived/BLIND-REVIEW.md`, `derived/BLIND-REVIEW-CORRECTED-INPUT.md`, `derived/BLIND-REVIEW-CORRECTED.md`, `derived/HOST-COMPOSED-PARAGRAPH.md`, and `derived/HOST-COMPOSITION-ERRATUM.md`.
- Hash index: `SHA256SUMS`, regenerated after these derived reports were added.