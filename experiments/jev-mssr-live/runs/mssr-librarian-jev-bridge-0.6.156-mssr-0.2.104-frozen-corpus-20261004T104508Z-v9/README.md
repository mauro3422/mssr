# Jev Librarian bootstrap context diagnostic — run9

## Scope and safety

Run9 is a new immutable bootstrap-only attempt, parented to v8. It pins Bridge
.156 / MSSR .104 and the exact 21-document source corpus from commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. Its 26 concepts and 52 bilingual
rows have been repeatedly used; this is exploratory regression evidence, not
independent calibration evidence. The runner makes zero Jev/provider calls,
reads no labels or target-index, and performs no scoring or threshold tuning.

The candidate starts as an isolated local MCP stdio process. Inherited
`TYPESAFE_API_KEY` is removed; the runner sets no Jev credential target/model.
The corresponding receipt field describes runner configuration only and does
not inspect Windows Credential Manager. No active Bridge `.153` service is
contacted or restarted.

## Routing and required context

Intent is `coding/skill-system/agent-orchestration`, actions
`analyze/review/verify`, artifacts `project/repository/document/mcp`, needs
`integrity-verification/cross-agent`, and signals `uncertainty/conflicting-evidence`.
Capability discovery is already complete. Host-gated selection accepts only
Jev (`jev-decision-systems`) as `useful`, and only if it appears as an active
optional root.

The runner calls portable `mssr_route_plan` with `contextMaxChars=40000`,
`contextMaxModules=8`, and `contextIncludeCore=true`, then Bridge
`skill_route_plan` with the matching 40,000-character/eight-module bounds in
debug mode. It records bounded route shapes and Project Context metadata from
the actual response objects, without persisting document text. The required
gates are core included with positive core characters, project modules
`mssr-jev-confidence-merge-evaluation` and
`mssr-jev-confidence-benchmark-history` selected, Jev loaded, and Jev's
`feedback-learning-benchmarks` module loaded. Bootstrap must complete its exact
continuation chain and lifecycle/post-context action before the diagnostic is
closed.

## Commands and outputs

`inputs/` contains only the pinned query/corpus bytes and inventories; labels
and target-index are absent. The external project root and separate Git
metadata remain outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; `run-completion.json` records terminal state.
No provider phase is permitted from this run, regardless of gate results.
