## Canonical ownership

- Routing contract and fixtures: `config/skill-routing/`.
- Portable routing/context/learning implementation: `src/`.
- Host-specific filesystem/runtime integration belongs in the host adapter, not in portable core.
- `config/first-party-skills.json` names five bundled MSSR operational skills under `skills/`. `MssrFirstPartySkillProvider` is the canonical source for those reserved names; external, user, project, and plugin skills remain separate catalogs.
- A bundled source wins precedence. A runtime mount to the same real source is an alias; a divergent external source with a reserved name is a blocking shadow conflict rather than an alternative editable owner.
- Codex mounting is opt-in through `scripts/install-first-party-skills.ps1`; installation never runs implicitly at package install time and only mutates manifest-named targets.
- Versioned release history lives in `changelogs/`; root `CHANGELOG.md` is a compatibility pointer.
- Stateful host routing/bootstrap semantics are portable MSSR authority. `MssrAdapter` owns shared lifecycle, host-gating, selective context assembly and telemetry handoff; Codex/OpenCode host adapters specialize identity/defaults. `mssrHostRouteInputSchema` and `resolveMssrHostSkillSelection` are shared contracts so hosts must preserve `accepted`, explicit `skipped`, and absent/pending decisions instead of forking selection semantics.
- Current Project Context architecture is owned by `.mssr/knowledge/architecture/project-context-plane.md`; release-by-release Context Plane and Operational Notice Plane evolution is kept in separate selective history modules rather than this always-broad ownership surface.
