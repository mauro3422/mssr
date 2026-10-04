# Jev Librarian bootstrap diagnostic — run13

## Scope and safety

Run13 is a new immutable bootstrap-only attempt, parented to v12. It pins
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

The truthful phase intent is domain `coding`, actions
`analyze/review/test/verify`, artifact `document`, needs
`integrity-verification/cross-agent`, and signals `uncertainty/tool-chain-needed`.
The retrieval chain under review is deterministic search → Jev selection →
exact fetch. The uncertainty signal matches the benchmark-history selector;
tool-chain-needed matches the semantic-evidence-plane selector. Conflict
adjudication and capability discovery are not part of this phase, so those
signals are omitted. The document artifact excludes project-control cutover
modules unrelated to this retrieval benchmark.

The host's canonical Project Context limit is 20,000 characters. Run13 requests
that exact limit and leaves the v12 module cap unchanged; it does not raise a
budget to force selection. Gates require positive-size project core,
semantic-evidence-plane and Jev benchmark-history selected, Jev loaded with
`contextSatisfied=true`, `feedback-learning-benchmarks` loaded, and a completed
bootstrap lifecycle. Merge-evaluation selection is recorded for diagnosis but
is not an obligation for this non-calibration retrieval phase.

## Inputs and commands

`inputs/` contains only the frozen query/corpus bytes and inventories. Labels
and target-index are absent; project staging and external Git metadata remain
outside this run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is written separately. This
run cannot start a provider phase.
