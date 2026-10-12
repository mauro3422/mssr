# 0.2.115 — 2026-10-10

## Contract

- Summary: add opt-in exact contained-range compaction to cited Librarian evidence packs while preserving every omitted handle's provenance.
- Areas: Librarian evidence pack, MCP contract, project context
- PROJECT_CONTEXT: updated
- PROJECT_MEMORY: reviewed-none
- PROJECT_STATE: updated

## Behavior

- `dedupeContainedRanges` defaults to `false`; existing evidence-pack output and citations remain unchanged.
- When enabled, MSSR first validates every supplied handle against current caller-supplied Markdown, then omits only strict contained ranges sharing the same trimmed owner, normalized source reference, and revision.
- The retained parent text remains verbatim. `rangeCompaction.removed` maps each omitted handle to a retained citation and preserves its owner, source, revision, range, line, fingerprint, and privacy-class provenance.
- Disjoint, equal, partially overlapping, cross-owner, cross-source, and cross-revision ranges are not compacted. Compaction does not summarize, establish truth, or prove that a parent answers a child facet.
- This change grants no source authority, canonical-write behavior, or runtime adoption.

## Verification

- `npm run build`: passed.
- `npm run test:librarian-evidence-pack`: passed, including default compatibility, strict nested compaction, byte-for-byte retained text, complete removed-handle provenance, order determinism, disjoint-range retention, and stale-handle rejection before compaction.
- `npm run verify`: passed, including the full repository suite, cross-host conformance, and skill audit.
- `npm run release:gate`: passed; receipt `.mssr/runtime/releases/0.2.115.json` records the final package size and hash. This does not publish or activate the package.
