# Run17 paused-run closure

- Run ID: `mssr-librarian-jev-bridge-0.6.156-mssr-0.2.104-frozen-corpus-20261004T120232Z-v17`
- Parent: `mssr-librarian-jev-bridge-0.6.156-mssr-0.2.104-frozen-corpus-20261004T114651Z-v16`
- Candidate: isolated Bridge `0.6.156` / MSSR `0.2.104`; model pin `jev-1.13.0`; MSSR tarball SHA-256 `714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca`.
- Source commit: `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`; 21 source documents, 26 concepts, 52 paired language requests.
- Intent: `coding`; `analyze/review/test/verify`; artifacts `document/mcp`; needs `integrity-verification/cross-agent`; signals `uncertainty/tool-chain-needed`; risk `external-side-effect`.

## Preflight and bootstrap

`node --check` and `--preflight` passed. Query cases SHA-256 is
`70e4c30fa2473a73fd9c2626a92ecfc58addb548da132e2ee639614b94e384f4`; frozen
corpus JSON SHA-256 is
`40a4d6b1f936d71eea56e4feac4105a68b6db995d1b6b96e03d8570413fa5a4d`. Preflight
verified the frozen source refs against the exact source commit and candidate
package/lock/stdio hashes; its status is `preflight-passed-provider-gate-closed`.

Bootstrap completed in one page. `jev-decision-systems` was an active optional
root, accepted with `useful`, and loaded. Jev `contextSatisfied=true`; loaded
modules include `feedback-learning-benchmarks`. MSSR benchmark-history was
selected and delivered. Lifecycle `contextChain=complete`; next action is
`execute-active-phase-then-record-phase-and-replan`.

The core discrepancy remains explicit: route Project Context reports
`coreIncluded=true`, 6,453 characters; the separate bootstrap Project Context
page reports `coreIncluded=false`, 0 core characters, and 13,695 module
characters. The receipts preserve both values.

## Provider gate and shutdown

The live runner wrote `provider-gate-receipt.json` with status
`paused-awaiting-exact-START_JEV`, provider calls 0, and Jev phase not started.
After inspecting it, an empty line was sent only to close the interactive
readline wait; it was not `START_JEV`. The runner wrote a `not-approved`
provider-approval receipt and terminal status `provider-phase-not-started`.
Provider calls: 0; labels read: false; target-index read: false; scoring:
false. No value from the credential store or `TYPESAFE_API_KEY` was read or
displayed; no raw approval input was persisted. The candidate MCP process
exited. Active Bridge `.153` was not contacted or restarted. Run16 remains
unchanged.
