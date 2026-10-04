# Bridge MCP Jev benchmark — v6 bootstrap-only diagnostic

## Status and gate

This is a fresh bootstrap diagnostic run, parented to v5, using the isolated
Bridge .156 / MSSR .104 candidate and the exact 21-document corpus pinned to
MSSR source commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The paired query
set has 26 concepts in English and Spanish (52 cases). This is exploratory
build-regression evidence, not a confirmatory evaluation, threshold trial, or
calibration study. Do not pool repeated requests as independent concepts or
tune thresholds from this set.

**Provider gate: closed.** This attempt runs frozen-input preflight and an
isolated candidate MCP route/bootstrap only. `--bootstrap-only` does not set a
credential target or model, and the runner terminates immediately after writing
the bootstrap receipt. It cannot enter search, Jev selection, fetch, scoring, or
label loading in this mode. Review its manifest, route plan, bootstrap receipt,
completion receipt, and checksums before authorizing any new live attempt.

The runner captures bounded per-context diagnostics without context contents:
name, obligation, loaded state, skip reason, core/module character counts,
context satisfaction, accepted overflow when exposed by the contract, blocked,
omitted, retained, and remaining units. It also captures the bootstrap
selection and loaded order, plus project-context module decisions and reasons.
If the installed contract does not expose accepted overflow, the receipt marks
that field unsupported instead of inferring a value. Existing attempts are
never modified.

The project-context intent uses the selectors declared by the frozen
`.mssr/project-context.json` Jev modules: domains `coding`,
`agent-orchestration`, `skill-system`; actions `analyze`, `review`, `verify`,
`optimize`; artifacts `project`, `repository`, `document`; needs
`integrity-verification`, `cross-agent`; signals `uncertainty`,
`conflicting-evidence`. Context limits remain at 16,000 project-context chars,
6 project modules, and 8 skills, matching the prior runner.

## Frozen inputs and staging

- `inputs/cases.json`: 26 bilingual concepts, 52 query rows, no expected answers.
- `inputs/corpus.json`: exact frozen 21-document corpus payload.
- `inputs/source-inventory.json`: per-document hashes and source refs.
- `inputs/control-support-inventory.json`: exact versioned project-control
  support from the source commit, separate from the 21 search refs.
- `inputs/staged-project-identity.json`: external staged project and separate
  Git metadata identity.

Staging remains outside the benchmark repository. The run contains no `.git`
pointer or embedded Git metadata. The runner verifies source and staged Git
blobs before starting MCP. Labels and target-index are absent from `inputs/`.

## Commands

Run offline preflight:

```powershell
node .\runner.mjs --preflight
```

Then run the bootstrap-only diagnostic:

```powershell
node .\runner.mjs --bootstrap-only
```

The runner starts `dist/index.js` directly from
`D:\Dev\bridge-mcp-jev-mssr-0.2.103` over MCP stdio. It does not contact or
restart the active Bridge `.153` service. The candidate process is closed after
bootstrap. No Jev/provider call is permitted by this run.
