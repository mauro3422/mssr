# Jev Librarian live-ready seed — run16

## Current run state

Run16 is a new immutable live-ready seed, parented to v15. It pins Bridge
.156 / MSSR .104 and the exact 21-document corpus from source commit
`c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The 26 concepts / 52 paired
language requests are repeatedly used; any future provider run is exploratory
regression evidence, not independent calibration. This run's executed phase
is bootstrap-only: zero Jev/provider calls, no labels or target-index read, and
no scoring.

The bootstrap receipt intentionally preserves both Project Context observations:
the route returned its core with `coreIncluded=true` and 6,453 characters; the
separate bootstrap Project Context page reported `coreIncluded=false` and zero
core characters. These fields refer to distinct response phases and are not
collapsed into one value.

The isolated candidate ran over local MCP stdio and exited after bootstrap.
Inherited `TYPESAFE_API_KEY` is removed. Active Bridge .153 is not contacted or
restarted. The credential-target receipt is configuration metadata; it does
not read or display a credential value.

## Live-run gate

The runner's future `--live` mode requires both the exact pinned candidate
confirmation and `--pause-after-bootstrap`. It performs preflight verification,
connects to the isolated candidate, plans the route, completes bootstrap, and
checks core, Jev host selection/loading, feedback-learning context,
benchmark-history selection/delivery, and lifecycle. It writes a
`provider-gate-receipt.json` and pauses before the first Librarian search or
provider request. Only the exact line `START_JEV` continues; leading/trailing
spaces or any other input leave the provider phase unstarted. Raw confirmation
input is not persisted.

The already executed v16 run is frozen as bootstrap-only and cannot be reused
for provider calls. After human review, a future live attempt must use a fresh
run directory containing only this seed's `inputs/`, `runner.mjs`, and
`README.md`. Give it a new v17 run ID, change the runner's context and
`parentRunId` from v15 to this v16 run, then run these commands from that fresh
directory:

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --live --confirmation "0.6.156:0.2.104:714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca" --pause-after-bootstrap
```

At the interactive prompt, wait for the human gate and enter exactly `START_JEV`
to authorize the provider phase. Do not send it during bootstrap-only review.

## Inputs and commands used for run16

`inputs/` contains only the frozen query/corpus bytes and inventories. Labels,
target-index, project staging, and external Git metadata are absent from this
run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The manifest remains `prepared`; terminal state is recorded separately. Do not
run `--live` from this already-used v16 directory.
