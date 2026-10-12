# Publication-close

Read after implementation and verification when capability changes must be persisted.

1. Re-plan at verification, persistence and close; load only skills active for each phase.
2. Verify source repositories, runtime junctions, generated docs, routing fixtures and live catalog discovery.
3. Use `git-change-publication` for bounded commits and remote readback. Never force-push to resolve ambiguity.
4. For multiple repositories, preserve per-repository outcomes and dependency order. A repository without a remote remains local-only.
5. Restart Bridge only after commits are durable when a runtime, tool or schema change requires it.
6. Verify live process version, tool catalog, focused smokes and full gate after restart.
7. Record one MSSR outcome with one primary skill; use bounded dimensions for differing subsystems.
8. Remove temporary prompts, scripts, terminals and test fixtures; enumerate deliberate residual state.
