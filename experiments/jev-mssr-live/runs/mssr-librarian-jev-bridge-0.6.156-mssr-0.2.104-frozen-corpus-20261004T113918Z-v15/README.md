# Jev Librarian bootstrap diagnostic — run15

## Scope and safety

Run15 is a new immutable bootstrap-only attempt, parented to v13. It pins
Bridge .156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The 26 concepts / 52 paired
language rows are repeatedly used; this is exploratory regression evidence,
not independent calibration. This run makes zero Jev/provider calls, reads no
labels or target-index, and performs no scoring.

The isolated candidate starts over local MCP stdio. Inherited
`TYPESAFE_API_KEY` is removed. Provider mode is disabled in this runner; do not
pass `--live`. The credential-target receipt describes runner configuration
only and does not inspect Windows Credential Manager. Active Bridge .153 is
not contacted or restarted.

## Intent and gates

Run15 preserves v13's retrieval intent and signals: domain `coding`, actions
`analyze/review/test/verify`, needs `integrity-verification/cross-agent`, and
signals `uncertainty/tool-chain-needed`. Artifacts are `document/mcp`: the
benchmark queries and source corpus are documents, and the active retrieval
chain is invoked through MCP tools. The canonical Project Context cap remains
20,000 characters.

Host-gated Jev acceptance is allowed only if `jev-decision-systems` appears as
an active optional root. Required gates are route core with positive size,
Jev active/accepted/loaded with `contextSatisfied=true`,
`feedback-learning-benchmarks` loaded, Jev benchmark-history selected and
present in delivered Project Context documents, and a completed bootstrap
lifecycle. Provider mode is disabled in this runner.

## Inputs and commands

`inputs/` contains only the frozen query/corpus bytes and inventories. Labels
and target-index are absent; project staging and external Git metadata remain
outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is written separately.
