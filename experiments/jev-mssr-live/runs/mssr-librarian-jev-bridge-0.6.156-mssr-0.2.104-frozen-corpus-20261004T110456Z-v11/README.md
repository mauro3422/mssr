# Jev Librarian bootstrap diagnostic — run11

## Scope and safety

Run11 is one immutable bootstrap-only attempt, parented to v10. It pins Bridge
.156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The 26 concepts / 52 paired
language rows have been repeatedly used; this is exploratory regression
evidence, not independent calibration. The runner makes zero Jev/provider
calls, reads no labels or target-index, and performs no scoring.

The isolated candidate starts over local MCP stdio. Inherited
`TYPESAFE_API_KEY` is removed; the runner sets no Jev credential target or
model. The credential-target receipt describes runner configuration and does
not inspect Windows Credential Manager. Active Bridge `.153` is not contacted
or restarted.

## Intent and gates

Intent is `coding/skill-system/agent-orchestration`, actions
`analyze/review/verify`, artifacts `project/repository/document/mcp`, needs
`integrity-verification/cross-agent`, and signals
`uncertainty/conflicting-evidence/capability-discovery-needed/tool-chain-needed`.
These signals describe uncertainty in the exploratory evidence and the need to
discover and compose the deterministic search → Jev selection → exact-fetch
chain. Host-gated selection accepts Jev as useful only if it is an active
optional root.

The runner uses supported `skill_route_plan` in debug mode with bounded project
context budgets of 40,000 chars and eight modules. It records the public
`contextPlane.projectContext` route fields and keeps route and bootstrap
selection receipts separate. Required gates are positive included core,
`mssr-jev-confidence-merge-evaluation` and
`mssr-jev-confidence-benchmark-history` selected, Jev skill loaded, feedback
benchmark module loaded, and completed bootstrap/lifecycle actions.

## Inputs and commands

`inputs/` contains only frozen query/corpus bytes and inventories. Labels and
target-index are absent; project staging and separate Git metadata stay
outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is written separately. This
run cannot start a provider phase.
