# Run10 bootstrap gate result

Run10 is terminal and immutable. Preflight passed for the pinned Bridge .156 /
MSSR .104 candidate and exact frozen inputs. The corrected `skill_route_plan`
response exposed `contextPlane.projectContext` directly. Its core gate passed:
`coreIncluded=true`, 6,453 core characters, from `.mssr/PROJECT_CONTEXT.md`
and `.mssr/PROJECT_STATE.md`.

Project module evidence differs by route phase. The public route receipt selected
`mssr-jev-confidence-merge-evaluation` (7,193 chars) and reported
`mssr-jev-confidence-benchmark-history` (5,851 chars) as `budget-exceeded`.
The subsequent bootstrap's trace-matched `project_context_selection` receipt
marked both modules selected at stage `verify`; no module text was persisted.
The bootstrap selection event is retained as distinct evidence rather than
rewriting the route receipt.

The Jev skill gate failed. `jev-decision-systems` appeared in `nearMatches`,
not among the six active optional roots; host-gated selection therefore had no
accepted optional roots. Only required `mssr-agent-routing` loaded, so
`feedback-learning-benchmarks` was not loaded. This is the observed routing
result for the requested `analyze/review/verify` intent with
`uncertainty/conflicting-evidence`; no further attempt was made to force a
decision outside the active-root set.

Bootstrap itself completed in one page. Lifecycle reports
`contextChain=complete` and
`nextRequiredAction=execute-active-phase-then-record-phase-and-replan`. The
provider phase did not start: provider calls are zero, labels and target-index
were not read, and no scoring occurred. The isolated candidate process closed.
The runner removed inherited `TYPESAFE_API_KEY` and set no Jev credential
target/model; this does not inspect Windows Credential Manager.
