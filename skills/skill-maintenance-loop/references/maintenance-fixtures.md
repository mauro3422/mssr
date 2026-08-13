# Fixture-authoring

Read when a skill, routing gate or continuation behavior needs regression coverage.

1. Reproduce the failing minimal case before the fix when practical.
2. Use vocabulary values exactly; do not invent command names as domains, actions, artifacts, needs or signals.
3. Pair each positive with a nearby negative that would have failed before the correction.
4. Add context continuation for brief replies such as `dale`, `seguí`, `mandale` or `hacé eso` when the workflow is resumable.
5. Test active and deferred selections, required dependencies, exclusions and phase placement.
6. Keep fixtures bounded and observable; never embed transcripts or private reasoning.
