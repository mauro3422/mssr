# Spanish query source-holdout pilot

- Run ID: mssr-librarian-spanish-source-holdout-pilot-20261012T161950Z-v1
- Freeze: 2026-10-12T16:22:24Z
- Scope: six queries, three exact public Markdown sources from separate project roots.
- Source disjointness: 85 eligible documents across the audited roots had zero exact hashes or relative-path matches against 160 source snapshots from 83 prior runs.
- Project-level caveat: Zomboid project name/path appeared in three prior handoff copies; the content is unseen, but the project is not name-blind.
- Corpus exclusions: benchmark reports, performance reports, test fixtures, simulator pages and test-only HTML are not documentation-evaluation sources.
- Query design: Spanish questions over English documentation; metadata off; no generated query variants; one sourceRef per case.
- Labels: source-derived, independently reviewed before provider calls, not owner-gold; labels are not in Jev request state.
- Negative labels mean the answer is not reported in that exact source, not that the whole project lacks it.
- Independent unit: three source-document clusters. This is a diagnostic pilot only and cannot support calibration, production reliability or threshold claims.
- Holdout is frozen before live calls and will not be used to tune the same packet.

## Planned cases

| Case | Source | Type |
|---|---|---|
| ducksugar-tc03-es | CHANGELOG.md | answerable |
| ducksugar-wer-negative-es | CHANGELOG.md | source-scoped negative |
| farm-flowering-range-es | docs/prototypes/TOMATO_FULL_GROWTH_CYCLE.md | answerable |
| farm-real-days-negative-es | docs/prototypes/TOMATO_FULL_GROWTH_CYCLE.md | source-scoped negative |
| zomboid-watch-loss-result-es | changelogs/0.2.12.md | answerable |
| zomboid-tick-latency-negative-es | changelogs/0.2.12.md | source-scoped negative |
