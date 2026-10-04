# Run7 terminal diagnosis addendum

Run7 is closed as `bootstrap-diagnostic-complete-provider-phase-not-started`. Bridge candidate MCP exited successfully after bootstrap-only. The runner removed inherited `TYPESAFE_API_KEY` and did not configure a credential target or model; this describes runner environment construction and does not inspect Windows Credential Manager. Provider calls, labels, target-index, and scoring are all zero/false. The immutable manifest remains `prepared` and points to run6.

Preflight passed for Bridge .156 / MSSR .104 and tarball SHA-256 `714e9d0997e4bc92c2981e1aeb3e5b8a98beef91efc04f82e92d001748a7e4ca`, with source commit `c4c93fb20faeb4bba81fc771718cd2f26c9c3c2a`, 21 corpus documents and 26 bilingual concepts / 52 request rows. Labels and target-index are absent. Run directory contains no `.git` path.

## Route and loaded context

The single structured intent describes verification of an exploratory Jev Librarian MCP tool chain and capability discovery. Jev appeared as an active optional root (`selectedAsRoot=true`); host-gated selection explicitly accepted it with reason `useful`. Actual `loaded[]` confirms `jev-decision-systems` core (10,662 chars) and `experimental-evidence` module (6,699 chars). Its `contextSatisfied` is false. `feedback-learning-benchmarks` was not loaded. Candidate skill telemetry gives its exact decision reason as `optional-budget-omitted`; the delivered skill context used 22,696/24,000 chars. No skill-context limits were raised in v7.

The project benchmark-history module `mssr-jev-confidence-benchmark-history` was selected. The merge-evaluation module was `intent-mismatch` because this diagnostic used only the truthful `verify` action; it was not framed as a calibration or threshold-tuning trial. The project-context page reports three selected modules and 8,235 module chars, with `coreIncluded=false` because bootstrap does not duplicate route-loaded core.

The route receipt has `projectContext:null` and the core gate is consequently false. Static candidate source shows that route project context is nested at `contextPlane.projectContext`; this runner read the wrong field. Therefore this run does not prove `coreIncluded=true` or positive route-core chars, although bootstrap did return normally. Do not treat core loading as verified until a corrected runner captures the nested route field.

The candidate telemetry supplied 26 project-module decisions and the run records every ID/selection/reason. The telemetry did not include decision scores, byte counts, matched selectors, or required fields; the receipt leaves those unsupported fields null/empty rather than deriving them from content. The candidate log's trace-filtered snapshot SHA-256 is recorded in `bootstrap-receipt.json`.

## Gate outcome

Provider gate remains closed: both `feedback-learning-benchmarks` and the route-level core proof failed their review gates. No Jev/provider request occurred. `SHA256SUMS` covers all run files except itself and was recomputed after this addendum.
