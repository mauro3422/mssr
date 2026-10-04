# Jev Librarian bootstrap context diagnostic — run7

## Status and limits

This is a new, immutable bootstrap-only diagnostic, parented to v6. It uses
Bridge candidate .156 / MSSR .104 and the exact frozen 21-document corpus from
source commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`. The paired set has 26
concepts and 52 bilingual requests. This is exploratory evidence only; repeated
runs do not establish calibration and must not be pooled as independent
concepts.

**Provider gate: closed.** The runner launches only the isolated candidate
MCP stdio process, calls route/bootstrap, writes bounded receipts, and exits.
It never calls Librarian search, Jev selection, fetch, scoring, labels, or the
target index. It removes inherited `TYPESAFE_API_KEY` and does not set a
credential target or Jev model for this mode. The recorded
`runnerConfiguredCredentialLookupTarget=false` reports what this runner set; it
does not inspect Windows Credential Manager or establish whether a credential
exists there.

## Structured intent and context selection

The intent represents this benchmark's actual capability chain: verify the
MCP route, discover the Jev capability after v6 surfaced it only as a near
match, and load benchmark history for an exploratory deterministic-search →
bounded-selection → exact-fetch evaluation. It uses domains
`coding/agent-orchestration/skill-system`, action `verify`, artifacts
`project/repository/document/mcp`, needs `integrity-verification/cross-agent`,
and signals `uncertainty/tool-chain-needed/capability-discovery-needed`.
Host selection stays `host-gated`; the runner accepts Jev only if it appears
as an active optional root. Deferred or near-match suggestions are never
accepted directly.

The frozen manifest tags make `mssr-jev-confidence-benchmark-history` eligible
for this verify phase. The separate merge-evaluation module does not declare
`verify`, so it is not a target of this narrow phase. The route must first show
`coreIncluded=true` and positive core characters; bootstrap's later context
page may report that core again as excluded because route already loaded it.

Run6 passed `responseMode=compact` to bootstrap. Candidate source shows that
compact mode caps project context at 22% of the 32,000-character envelope
(7,040 chars) and at four modules, regardless of the requested 16,000/six
limits. Run7 uses `responseMode=debug` with bounded project context limits of
20,000 chars and eight modules so those requested values apply. The skills
context budget remains 24,000 chars and maxSkills remains eight. Project
context decisions are copied from the candidate's append-only event log by
exact trace ID and reduced to module id, selection, reason, score, byte count,
matched selectors, and requirement fields; no project text or unrelated events
are written to the run.

## Frozen inputs and commands

`inputs/` is copied from v6 and contains only the 26 query concepts, 21-document
corpus, source/control inventories, and external staging identity. Labels and
target-index are absent. The project root and separate Git metadata remain
outside the benchmark repository; no `.git` pointer is stored in the run.

```powershell
node .\runner.mjs --preflight
node .\runner.mjs --bootstrap-only
```

The candidate is launched directly from
`D:\Dev\bridge-mcp-jev-mssr-0.2.103\dist\index.js` over MCP stdio. The runner
does not contact or restart active Bridge `.153`. The immutable manifest stays
`prepared`; `run-completion.json` stores the terminal state. Review the route,
bootstrap, project-context decision, completion, and checksum receipts before
considering any separate provider run.
