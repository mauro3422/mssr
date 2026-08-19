# Audit-only

Read when the task asks whether skills, tools, routing, providers or documentation need maintenance but no mutation is approved yet.

1. Freeze observable evidence and separate project, skill, routing, tool, provider, lifecycle, generated-output and product-context defects.
2. Query the smallest authoritative audit: `bridge_tool_audit`, `skill_route_audit`, live provider status and Git/project evidence.
3. Treat metrics as evidence, not permission. Zero calls or fewer than three failures without successes require a bounded smoke before lifecycle changes.
4. Classify each finding as local documentation, owner-skill update, routing/fixture, script/tool/guide, context handoff, new-skill candidate or insufficient evidence.
5. Prefer updating the existing owner. A new skill requires an independent recurring objective and separate verification boundary.
6. For skill structure, inspect `skill_route_audit.structuralHealth`: distinguish hard routing failure from advisory `WATCH`/`REVIEW`. Review missing/invalid `context-modules.json`, unindexed `references/`, full-fallback risk, monolithic cores and real context savings/selection evidence before proposing a split.
7. A daily host audit may persist privacy-safe structural snapshots (lines/chars, manifest/modules, refs, status/reasons and deltas) for trends. It must never persist recipe contents, prompts or transcripts and must never rewrite a skill automatically.
8. Return priorities, evidence, owner and next reproducible action. Do not mutate from an audit-only route.
