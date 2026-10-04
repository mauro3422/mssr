# Jev Librarian bootstrap diagnostic — run14

## Scope and safety

Run14 is a new immutable bootstrap-only attempt, parented to v13. It pins
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

The v13 retrieval intent is preserved: domain `coding`, actions
`analyze/review/test/verify`, artifact `document`, needs
`integrity-verification/cross-agent`, and signals `uncertainty` plus
`tool-chain-needed`. This phase also needs to activate the known Jev decision
capability for the benchmark's search → Jev selection → exact-fetch chain, so
the minimal additional signal is `capability-discovery-needed`. The router
may accept Jev only when it appears as an active optional root; no out-of-route
skill decisions are fabricated.

The host's canonical Project Context limit is 20,000 characters. Run14 requests
that exact limit and preserves v13's module cap. Gates require the route core
with positive size, Jev as active/accepted/loaded, Jev `contextSatisfied=true`,
`feedback-learning-benchmarks` loaded, and Jev benchmark-history both selected
and delivered in Project Context, plus completed bootstrap lifecycle. No
provider phase is available in this runner.

## Inputs and commands

`inputs/` contains only the frozen query/corpus bytes and inventories. Labels
and target-index are absent; project staging and external Git metadata remain
outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is written separately.
