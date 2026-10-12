# MSSR Librarian — cross-language query recovery diagnostic

## Purpose and boundaries

Compare Run45's metadata-off search baseline with explicit, blinded translations on the three positive cases that missed their acceptable range. Include nearby negative controls to measure variant-driven candidate noise. Kode and Electronics Repair Simulator use live Bridge 0.6.173 searches against their original project files; those file hashes match Run45. Elemental Frontier's Bridge path is blocked because its `.mssr/PROJECT_CONTEXT.md` exceeds the 1,800-byte project-core gate, so its positive and negative searches use portable MSSR 0.2.127 on the exact Run45 snapshot. This keeps content and owner/sourceRef stable but is not a Bridge adapter test for EF.

This is a diagnostic development arm, not a holdout, independent reliability estimate, or confidence calibration. The blind translator saw only the question text; sources, expected ranges, supporting lines, labels, and Run45 outcomes were withheld. Jev receives only the query, exact returned handles, and selected source. Labels stay in the repository-side evaluator.

## Frozen comparison

- Baseline: Run45 search receipts, metadata off, primary query only.
- Variant arm: same primary query and source plus one host-supplied translation; primary-query matches rank first, and each query's lexical score remains separate.
- Candidate cap: 10, same as Run45.
- Jev: call only when a variant arm adds candidates or recovers the expected range. Never add a range manually after inspecting labels.
- Negative controls: EF's English negative with blind Spanish translation, plus unmodified KODE/ERS English negatives.
- Acquisition: if Jev selects a candidate, exact fetch it and build a cited evidence pack. No prose generation is part of this arm.
- No metadata, atom projections, contradiction graph, query decomposition, confidence threshold, or canonical-source writes.

## Paired cases

| Case | Primary | Explicit variant | Execution |
|---|---|---|---|
| KODE-01-ES | Spanish | English | Live Bridge / Kode project |
| EF-01-EN | English | Spanish | Portable MSSR / frozen EF snapshot |
| ERS-01-ES | Spanish | English | Live Bridge / ERS project |
| EF-NEG-01 | English negative | Spanish | Portable MSSR / frozen EF snapshot |

KODE-NEG-01 and ERS-NEG-01 are unchanged English controls on live Bridge.

## Source integrity and EF gate

- Kode `docs/OPENCODE_PROVIDER.md`: `c4cd02ec1926068f593083e242b235319f76f49e133a37cbefa4f6163cbe6672`
- Elemental Frontier `combat-lab/TEST_PROTOCOL.md`: `07d5ea38cf9af29c10d3c838a8a9428b478f9eecb6a8d6a812b1dfb8cc3c49fe`
- Electronics Repair Simulator `docs/ELECTRONICS_MODULAR_SYSTEM.md`: `4a5556680a4f395bdbc4e6b578d9fbc368c15483fdad6b6f57aeef3e84a5cd77`

Bridge's EF route was attempted under an EF-owned child trace. Project-context loading returned `mssr-core-budget-blocked` for `.mssr/PROJECT_CONTEXT.md` (>1,800 bytes). The required `includeProjectContext=false` read loaded EF AGENTS; its next bootstrap hit the same gate. Core recovery was not attempted because this run does not authorize changing EF's project authority. EF used the portable API on the hash-verified snapshot, as Run45 did.

The packet retains exact search requests/responses, operational gate evidence, an aggregate script, and a post-call checksum index. The checksum index is an integrity checkpoint, not pre-call provider attestation.
