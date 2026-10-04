# Run8 bootstrap diagnostic classification

Run8 is terminal and immutable. Its manifest remains `prepared`; the terminal
receipt is `run-completion.json`. Preflight passed against Bridge .156 / MSSR
.104, the pinned artifact hash, staged source commit, and exact 21-document
corpus. The query set is 26 paired concepts / 52 language rows and remains an
exploratory regression comparison only.

Bootstrap completed in one page with lifecycle `contextChain=complete` and
`nextRequiredAction=execute-active-phase-then-record-phase-and-replan`. Jev's
provider phase did not start: `providerCalls=0`; no labels or target-index were
read, and no scoring occurred. The runner did not configure a credential target
or Jev model and removed inherited `TYPESAFE_API_KEY`; that configuration fact
does not inspect Windows Credential Manager.

Host-gated selection had one required root (`mssr-agent-routing`) and six
optional roots. The runner accepted only optional Jev (`jev-decision-systems`)
with reason `useful`; the actual loaded list confirms Jev core (10,662 chars),
`experimental-evidence` (6,699 chars), and `feedback-learning-benchmarks`
(9,010 chars). Skill context used 31,706 / 32,000 chars, reported no omitted or
blocked units, and left Jev `contextSatisfied=false` despite the requested
modules being present. This resolves v7's `optional-budget-omitted` result for
the feedback module.

Project-context telemetry confirms `mssr-jev-confidence-merge-evaluation`
selected. It reports `mssr-jev-confidence-benchmark-history` as
`budget-exceeded`, so that project-history gate failed. Other selected project
modules were `mssr-change-history-contract`,
`mssr-architecture-impact-decision`, `mssr-canonical-ownership`,
`mssr-project-context-plane-architecture`, and `mssr-semantic-evidence-plane`.
Telemetry intentionally did not expose scores or character allocations, so
those values remain unavailable rather than inferred.

The route receipt's Project Context core gate is **unproven**: it records
`manifestStatus=loaded` but `coreIncluded` and `coreCharsLoaded` are null. Static
inspection of the pinned Bridge .156 response builder shows debug diagnostics
are nested under `diagnostic`; the next diagnostic should inspect the actual
`diagnostic.contextPlane.projectContext` path and summarize only its bounded
metadata. Run8 did not persist the raw tool response, and its receipt must not
be rewritten to claim core inclusion. This is a runner capture-path gap, not
evidence that the core was absent.

No Jev search, selection, fetch, trace outcome, or scoring call was made. A
later attempt requires a new unique run ID and fresh bootstrap-only gate review.
