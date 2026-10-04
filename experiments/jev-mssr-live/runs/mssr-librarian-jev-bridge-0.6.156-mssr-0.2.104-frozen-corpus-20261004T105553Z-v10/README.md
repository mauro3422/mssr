# Jev Librarian bootstrap context diagnostic — run10

## Scope and safety

Run10 is one fresh immutable bootstrap-only attempt, parented to v9. It pins
Bridge .156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The 26 concepts / 52 paired
language rows have been repeatedly used; this is exploratory regression
evidence, not independent calibration. The runner makes zero Jev/provider
calls, reads no labels or target-index, and performs no scoring.

The isolated candidate starts over local MCP stdio. Inherited
`TYPESAFE_API_KEY` is removed, and the runner sets no Jev credential target or
model. The receipt's credential-target setting reports runner configuration;
it does not inspect Windows Credential Manager. Active Bridge `.153` is not
contacted or restarted.

## Route and required context

The intent is `coding/skill-system/agent-orchestration`, actions
`analyze/review/verify`, artifacts `project/repository/document/mcp`, needs
`integrity-verification/cross-agent`, and signals `uncertainty/conflicting-evidence`.
Jev capability discovery is complete. Host-gated selection accepts only
`jev-decision-systems` as useful, and only when the route identifies it as an
active optional root.

The runner uses the candidate's supported `skill_route_plan` only, in
`responseMode=debug`, with `maxProjectContextChars=40000` and
`maxProjectContextModules=8`. It extracts the public `contextPlane.projectContext`
object directly, then persists only bounded metadata, core references/counts,
and module decision fields; it does not persist project text. Bootstrap uses
the same budgets and completes any exact continuation and lifecycle action.
Required gates: Project Context core included with positive characters,
`mssr-jev-confidence-merge-evaluation` and
`mssr-jev-confidence-benchmark-history` selected, Jev loaded, and
`feedback-learning-benchmarks` loaded.

## Inputs and commands

The run's `inputs/` contains only frozen query/corpus bytes and inventories;
labels and target-index are absent. Project staging and separate Git metadata
remain outside the run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; `run-completion.json` records the terminal
diagnostic state. This run cannot start a provider phase.
