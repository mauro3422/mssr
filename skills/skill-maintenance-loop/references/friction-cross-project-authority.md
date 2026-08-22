# Cross-project authority and approval friction

Read when projects, repositories, catalogs or MCP adapters disagree about canonical ownership, validated snapshots, approvals or provider schema.

## Cross-project catalogs and approval evidence

### Derived catalog becomes an accidental source authority

A dashboard, index, library or normalized manifest can make many projects easier to browse without becoming the owner of their canonical source files. Copying source models/runtime artifacts into the catalog or editing a provider while still operating under the catalog's workflow creates split authority and ambiguous persistence.

Gate:

1. name the authoritative provider project before any mutation;
2. keep the catalog owner limited to adapters, normalized metadata, derived presentation evidence and navigation;
3. treat provider repositories as read-only while the catalog workflow is active;
4. hand actual source edits back to the provider's own context/workflow;
5. refresh the catalog only from durably persisted provider evidence after provider verification.

### Validated snapshot silently rewritten to match the current working source

A provider may have a previously validated hash while its live working source has since changed. Replacing the declared validated hash with the current hash makes drift disappear instead of representing it.

Gate:

1. preserve `validated/expected` and `current/measured` evidence as separate fields;
2. when bytes or hashes differ, report source drift explicitly and block claims that the current source is still the validated snapshot;
3. never rewrite expected evidence merely to make a verifier green;
4. clear drift only after the provider creates new durable validation for the current source;
5. keep permissions and historical approvals distinguishable from current-source integrity.

### Technical validation mistaken for human approval or downstream authorization

Automated checks can prove geometry, schema, hashes or import integrity without proving that a person accepted the visual result or authorized the next production phase.

Gate:

1. model technical validation, human approval and downstream authorization as separate states;
2. `PASS` never implies `approved` unless the provider contract explicitly says so;
3. preserve blocked export/runtime/integration flags even when all technical checks pass;
4. require durable provider evidence before promoting a human gate;
5. surface the distinction in dashboards and handoffs so agents do not infer permission from quality metrics.

### Provider schema guessed from neighboring examples

Adapters often fail when an agent assumes field names from another manifest or from an earlier revision instead of reading the actual durable provider schema/data. A close semantic guess such as `godotIntegration` versus `godot`, or `pass` versus `passed`, can silently weaken a gate when fallback logic is permissive.

Gate:

1. inspect the exact provider JSON/schema before implementing an adapter;
2. prefer structured fields over filename or lexical inference;
3. fail closed when a required approval/integrity field is absent or ambiguous;
4. add parser fixtures for the observed provider shape and one nearby incompatible shape;
5. treat schema mismatch as replan/debug evidence, not as permission to relax the contract.
