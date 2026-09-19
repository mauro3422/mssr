# ADR 0008 — Context Economy v2

Status: accepted for portable MSSR implementation; consuming-host adoption pending.

Date: 2026-09-19

## Context

R2 makes substantial work enter MSSR lifecycle automatically. Replanning that lifecycle is correct, but the procedural context cost can become repetitive when a host still has the exact same skill guidance in its current uncompacted model context. Historical trace state cannot safely answer that question: a prior `skill_load` may predate compaction, restart, handoff, source edits, or another context reconstruction.

MSSR already gives selected skill core/modules stable ordered unit ids and exact bounded paging. R3 should reuse that substrate instead of adding a second context system or raising budgets.

## Decision

A procedural context unit is a reusable obligation identified by:

- its stable unit id (`<skill>:core` or `<skill>:module:<id>`); and
- a SHA-256 fingerprint of the exact assembled content bytes.

A host may send a bounded `retainedContextObligations` list only for units it knows are still present in the current uncompacted context. Portable MSSR matches those receipts against the newly reconstructed selected units and suppresses only exact id+fingerprint matches.

The host observation is intentionally ephemeral. MSSR does not infer retention from trace history, completed phases, timestamps, semantic similarity, prior delivery receipts, or a previous process. If the host omits the receipt after compaction/restart/handoff, the obligation becomes unmet and normal delivery resumes. If source bytes change, the fingerprint changes and only that changed obligation is re-delivered.

## Paging and lifecycle semantics

Retention participates in the context plan itself:

1. reconstruct selected units and content fingerprints;
2. validate bounded host retention receipts;
3. remove exact retained units from the page-budget reservation set;
4. page only unmet units with the existing whole-unit rules;
5. bind the retention set into the opaque cursor fingerprint, so a caller cannot change retention assumptions in the middle of a continuation chain;
6. report retained units and `retainedContextCharsSaved` separately from newly delivered characters.

A routed skill whose complete selected guidance is covered by exact retained receipts remains lifecycle-satisfied. It returns `loaded=true`, `contextSatisfied=true`, an empty new-content payload, and zero `deliveredChars`; this preserves required-skill compliance while keeping byte-delivery accounting truthful.

`loaded=true` therefore means the selected guidance is available to the current route, not necessarily that this specific response serialized new guidance. `deliveredChars` / `totalContextCharsLoaded` remain the evidence for newly delivered procedural bytes.

## Safety boundaries

- Receipt ids alone are insufficient; content fingerprints are mandatory.
- Conflicting fingerprints for the same receipt id are invalid.
- Unknown/stale receipts cannot suppress current units.
- Retention may reduce reserved/delivered context but may not increase context budgets.
- Required context still blocks/continues under the existing indivisible-unit rules when it is unmet.
- The opaque cursor contains no prompt, transcript, secret, or procedural text.
- Hosts own the observation that guidance is retained; MSSR owns deterministic validation, matching, paging and budget semantics.
- Retention never authorizes tool/file/project mutation.

## Verification expectations

Portable verification must prove:

- exact receipt reuse can reduce a repeated route to zero newly delivered procedural characters;
- changed content invalidates only the changed unit receipt;
- omitting receipts re-delivers guidance after compaction/restart/handoff;
- malformed or conflicting receipts are rejected;
- changing retention assumptions mid-cursor-chain invalidates the cursor;
- no-loss/no-duplication page continuation remains intact; and
- required-skill lifecycle state remains satisfied when its current guidance is fully retained.

Consuming-host adoption is a separate gate. A host must prove it emits receipts only for guidance that remains in its actual current context and clears them at compaction, restart, handoff, or any other boundary where retention is no longer known.