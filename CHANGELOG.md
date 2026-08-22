# Changelog

The canonical MSSR release history now lives under [`changelogs/`](changelogs/INDEX.md).

- Current release: [0.2.53](changelogs/0.2.53.md)
- Version index: [changelogs/INDEX.md](changelogs/INDEX.md)
- Historical monolithic archive: [changelogs/LEGACY.md](changelogs/LEGACY.md)

New releases use one `changelogs/X.Y.Z.md` file with explicit `PROJECT_CONTEXT`, `PROJECT_MEMORY`, and `PROJECT_STATE` impact declarations. This lets host adapters audit change/memory consistency and selectively retrieve release history without loading an ever-growing monolithic changelog.
