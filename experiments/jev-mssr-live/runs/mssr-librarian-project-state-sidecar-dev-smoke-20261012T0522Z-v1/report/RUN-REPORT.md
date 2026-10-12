# Run 42: one-case live MSSR metadata-sidecar smoke

## Question and scope

This development smoke compares the existing MSSR Project Context Librarian metadata sidecar with the lexical baseline for one Spanish question over English MSSR state text: how many first-party operational roots the core package has, and whether Semantic Evidence is a separate skill. The live path used Bridge 0.6.172, embedded MSSR 0.2.127, and TypeSafe Jev 1.13.0. No runtime, production behavior, or confidence threshold was changed.

The run is one paired query over two already exposed development sources. It is neither a clean holdout nor an independent accuracy sample. `inputs/expected.json` was retained for local development comparison and was not included in either Jev request.

## Focused verification

The existing MSSR `test:librarian-contract` suite passed, including retrieval, Jev range selection, and evidence-pack regressions. `test:trace-identity` passed. On the Bridge source checkout (`3de489cf040f5e581b2b328521f4cbd44f2b81a9`, package 0.6.172), `test:mssr-trace-owner-isolation` passed with its build. These checks validate existing contracts; this run added no production code.

At close, the connected Bridge reported version 0.6.172 on the same runtime boot, with tunnel `healthz` live, `readyz` ready, and no pending restart request. No restart was needed because the Bridge implementation was not changed.

## Frozen inputs and readback integrity

`manifest.json` remains byte-for-byte unmodified. Its `providerCalls: 0` field is the pre-call snapshot value, not the completed call count. The actual calls are recorded in `run-receipt.json`.

The manifest declares itself frozen before searches/provider calls. Its and the input/source files' modification times precede the first Jev selection. A contemporaneous pre-call checksum index was not captured, so the hashes in `SHA256SUMS` and the receipt are post-run readback hashes; they protect the present packet but do not retroactively prove byte identity at freeze time.

Both source snapshots match their declared SHA-256 hashes. The two Librarian metadata-authority hashes in the manifest also reproduce from the pinned MSSR `gitHead` (`89538d0a3a9f453a01a667da3fc780b47e77b2dd`); the metadata authorities were hash-pinned, not copied into the run. This lets the metadata state be recovered from the parent commit without duplicating the files in the experiment packet.

## Paired search and selection

| Path | Search result | Jev choice | Exact validation |
|---|---:|---|---|
| Metadata sidecar | 2 candidate ranges projected from 4 declared entries; 2 omitted as `source-not-provided` | Selected the `Core skill package state` section in `.mssr/PROJECT_STATE.md`, lines 79–82 | Revision, range fingerprint, and exact 251-character fetch passed; the sidecar evidence pack validated with one citation |
| Lexical baseline | 8 candidate ranges over the same two source snapshots | Selected the same range, fingerprint, and text | Revision, range fingerprint, and exact 251-character fetch passed; no separate lexical evidence pack was built |

The sidecar reduced the candidate set from eight to two (six fewer, or 75%) for this query without changing the selected range. A blind Luna candidate review judged the target directly relevant and sufficient for both parts; it judged the other sidecar candidate weakly relevant and insufficient. In the lexical set, the same precise target and a nested 220-character block also contained direct evidence, while broad parent ranges and unrelated state/evaluation ranges added overbreadth. See `BLIND-CANDIDATE-REVIEW.md`.

The two Jev calls used 2,501 input and 194 output tokens combined; their provider-reported elapsed times sum to 1,492.3 ms. These are per-call usage totals, not end-to-end wall time. Sidecar Choice confidence/evidence sufficiency were 1.00/0.88; baseline values were 0.93/0.90. All scores are uncalibrated provider outputs and are not success probabilities or thresholds.

## Overlap diagnostics

The sidecar result reports zero same-source/revision pairs because its two candidates belong to different source files. The lexical result reports 16 same-source/revision pairs, 8 overlapping pairs, and 8 nested pairs, including the parent section and its selected child range. This matches the implementation's read-only, same-owner/source/revision interval rule and the existing nested-range regression; the zero in the sidecar response is not a diagnostic defect.

## Bridge trace attribution

Bridge trace `mssr-jev-sidecar-metadata-dev-smoke-20261012-46` reports the smoke's Bridge runtime as version 0.6.172 and one runtime boot generation. The ten-call experiment chain succeeded: route/bootstrap, two searches, two Jev selections, two exact fetches, and one sidecar evidence pack. Later read-only trace-evidence retrievals increased the evidence query's total to thirteen calls; they are not experiment calls.

The persisted `route_planned` event has `details.taskKey: null`, while per-call metrics include `mssr-jev-holdout-exposure-audit` for the initial route call and `mssr-jev-sidecar-metadata-dev-smoke` for the later calls. The read-only Bridge source review used checkout commit `3de489cf040f5e581b2b328521f4cbd44f2b81a9`: `recordMssrRoute` persists the returned route's task key; `getMssrTraceEvidence` derives canonical identity from route events and separately aggregates call-level metric keys; `resolveMetricTaskKey` uses the bound trace key for subsequent calls. Therefore this evidence does **not** show that a canonical trace identity migrated. It shows that this trace has no persisted canonical `taskKey`, so the call-level values cannot establish task identity continuity. The inspected checkout also has fail-closed task-key binding and tests for incompatible explicit trace reuse. Bridge's runtime reports version and boot ID but not a source commit/hash, so this code review is not a binary-to-source attestation. No Bridge source or runtime was changed or restarted.

## Result and limits

This one paired smoke supports a narrow claim: for this query, the project-specific sidecar retained a sufficient exact range while reducing Jev's candidate set, and both paths fetched identical source-bound evidence. The evidence-pack validation applies only to the sidecar path.

It does not establish general recall, answer composition quality, contradiction handling, atom quality, production reliability, or confidence calibration. Both sources were previously exposed in development work; the reviewer assessment is model-assisted, not owner-gold. Do not tune confidence thresholds or promote a general quality claim from this run.

Next useful evaluation: freeze a new, unexposed source cluster and independent owner labels before calls; compare sidecar and lexical candidates with the same questions; measure sufficient-range retention, distractor/overbreadth, exact fetch, and composed-answer completeness as separate outcomes. Keep score calibration separate until there are enough independently adjudicated cases.
