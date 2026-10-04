# Jev Librarian bootstrap context diagnostic — run8

## Status and limits

This is a fresh, immutable bootstrap-only diagnostic, parented to run7. It pins
Bridge .156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The paired set has 26 concepts and
52 bilingual requests. It has been used repeatedly, so this exploratory
comparison cannot establish calibration and reruns are not independent.

**Provider gate: closed.** The runner starts the isolated candidate MCP stdio
process and calls only `skill_route_plan`, `skill_bootstrap`, and exact
continuation tools if required. It makes zero Jev/provider calls, reads no
labels or target-index, and performs no scoring or threshold tuning. It removes
inherited `TYPESAFE_API_KEY` and does not set a credential lookup target or
model. The recorded credential-target flag describes runner configuration; it
does not inspect Windows Credential Manager.

## Intent and context gates

The structured intent describes exploratory paired benchmark analysis and
verification: `coding/skill-system/agent-orchestration`, actions
`analyze/test/verify`, artifacts `project/repository/document/mcp`, and the
truthful `uncertainty/tool-chain-needed/capability-discovery-needed` signals.
The repeated corpus makes this a regression comparison, not a calibration
claim. Host selection is `host-gated`; the runner accepts `jev-decision-systems`
only if it appears as an active optional root. It accepts no unrelated optional
roots.

Both route and bootstrap use `responseMode=debug`. The project-context request
is bounded at 24,000 chars and 10 modules; the skill assembly request is bounded
at 32,000 chars and eight skills. The route receipt reads the actual
`contextPlane.projectContext` object and requires `coreIncluded=true` with
positive core characters. Bootstrap output is separately captured; its
`coreIncluded=false` is expected because the route already supplied the core.
The receipts must show Jev core and `feedback-learning-benchmarks` loaded, plus
project `mssr-jev-confidence-benchmark-history` selected. The exploratory
analysis intent also makes the merge-evaluation module relevant if its
manifest selectors match. The runner does not force project modules outside
the selector/loader result.

Project-context selection telemetry is filtered by the explicit run trace ID
and reduced to IDs, selected flags, reasons, sizes, and matched selector names.
No project text or unrelated telemetry is persisted. The external project root
and separate Git metadata remain outside this benchmark repository; there is
no nested `.git` directory or host-local `.git` pointer in the run.

## Frozen inputs and commands

`inputs/` contains only the pinned 26 query concepts, 21-document corpus,
inventories, and external staging identity. Labels and target-index are absent.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The runner launches
`D:\Dev\bridge-mcp-jev-mssr-0.2.103\dist\index.js` directly over local MCP
stdio. It does not contact or restart active Bridge `.153`. The manifest stays
`prepared`; terminal state is written to `run-completion.json`. Bootstrap-only
results are diagnostic and must be reviewed before any separate live run.
