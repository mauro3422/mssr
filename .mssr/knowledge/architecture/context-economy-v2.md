# Context Economy v2

R3 makes procedural skill context obligation-aware across replans without pretending that historical delivery proves current model-context retention.

Each selected skill core/module is a stable procedural obligation identified by its existing unit id (`<skill>:core` or `<skill>:module:<id>`) plus a SHA-256 content fingerprint. Hosts may send a bounded `retainedContextObligations` attestation only for units they know are still present in the current uncompacted context. Portable MSSR validates the receipts and suppresses only exact id+fingerprint matches. A missing receipt, changed fingerprint, compaction, restart or handoff makes the guidance unmet again and therefore eligible for normal delivery.

Retention is budget relief, not historical truth. Retained units do not reserve the next page budget and are reported separately through `retained`, `retainedContextCharsSaved` and per-skill `retainedUnits`. A fully retained routed skill remains `loaded=true` with `contextSatisfied=true` but carries an empty content payload and zero newly delivered characters, so lifecycle/observability do not misclassify a required skill as missing. `loaded` therefore means the selected procedural guidance is available for the current route; `totalCharsLoaded`/`deliveredChars` remain the byte-delivery evidence.

Paged continuation remains exact. The opaque cursor fingerprint binds stage, selection, unit order/content and the retention attestation set. Retention cannot be changed mid-chain without invalidating the cursor. Units already delivered earlier in the same compatible page chain remain available for that continuation only; this does not create durable retention across a fresh bootstrap.

MSSR never infers retention from completed phases, prior trace loads, timestamps or similarity. Hosts own the observation that guidance is still present; MSSR owns deterministic receipt matching, paging, budget accounting and fallback to re-delivery. No context limit is raised to hide lifecycle ceremony.

Verification must cover: exact-match zero-byte reuse; changed-unit selective re-delivery; receipt omission re-delivery after compaction/restart/handoff; malformed/conflicting receipt rejection; cursor invalidation when retention changes mid-chain; and unchanged no-loss/no-duplication paging behavior.