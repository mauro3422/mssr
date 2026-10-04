# Jev Librarian bootstrap diagnostic — run12

## Scope and safety

Run12 is one immutable bootstrap-only attempt, parented to v11. It pins Bridge
.156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The 26 concepts / 52 paired
language rows have been repeatedly used; this is exploratory regression
evidence, not independent calibration. The runner makes zero Jev/provider
calls, reads no labels or target-index, and performs no scoring.

The isolated candidate starts over local MCP stdio. Inherited
`TYPESAFE_API_KEY` is removed; the runner sets no Jev credential target or
model. The credential-target receipt describes runner configuration only and
does not inspect Windows Credential Manager. Active Bridge `.153` is not
contacted or restarted.

## Intent and gates

Intent is `coding/skill-system/agent-orchestration`, actions
`analyze/review/test/verify`, artifacts `project/repository/document/mcp`, needs
`integrity-verification/cross-agent`, and signals
`uncertainty/conflicting-evidence/capability-discovery-needed/tool-chain-needed`.
The test action truthfully describes preparing and evaluating this benchmark's
paired retrieval cases. Host-gated routing accepts Jev as useful only if the
route identifies it as an active optional root.

The runner uses supported `skill_route_plan` in debug mode with project-context
budgets of 60,000 chars and 12 modules. Bootstrap receives the same project
budgets plus 48,000 chars for assembled skill context and a 64,000-character
response envelope. Route and bootstrap project-context receipts remain
separate. Required gates are included core with positive size, both Jev
project modules selected, Jev loaded with `contextSatisfied=true`,
`feedback-learning-benchmarks` loaded, and a completed bootstrap lifecycle.

## Inputs and commands

`inputs/` contains only the frozen query/corpus bytes and inventories. Labels
and target-index are absent; the project staging and external Git metadata stay
outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is written separately. This
run cannot start a provider phase.
