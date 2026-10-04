# Jev top-label confidence diagnostic

**Current report:** [`reports/2026-10-04-80k-singlepass-exploratory-source-conditional.md`](reports/2026-10-04-80k-singlepass-exploratory-source-conditional.md) supersedes both earlier reports. The runs record 200 heading candidates, but their final Choice cardinality is not verified: both run trees were dirty, v1 preserved no selector hash, and v2 preserved a selector hash without the exact matching source file. The committed run HEAD cannot stand in for dirty run-time source. Frozen benchmark run folders remain unchanged.

This offline evaluator adds a derived, exploratory view over immutable Jev 80k
single-pass runs. It does not make provider calls, edit the run folders, claim
production calibration, or recommend a threshold.

Run it from this directory:

```powershell
node .\evaluate.mjs
node --test .\evaluate.test.mjs
```

The evaluator validates the run SHA256SUMS inventory, frozen input hashes, manifest/run identity, 26 bilingual cases, all 52 response IDs, and single-pass mode. It records the 200 heading-candidate count separately from final Choice option cardinality. The runner's `finalistCount` falls back to `candidateCount`, so neither response field independently proves the option count. The prior reports inferred final `n` from a committed source blob even though the runs came from dirty trees; that inference has been withdrawn.

The current report therefore compares two conditional scenarios: `n=200` if the final Choice contained only the headings, and `n=201` if it contained those headings plus exactly one `none` option. These are sensitivity cases, not a verified or exhaustive count of the dirty run source. For each assumed `n`, the evaluator reconstructs selected-option mass with TypeSafe's documented normalized Choice confidence formula. It does not prove evidence sufficiency or empirical calibration.

The JSON output marks probability-derived values as conditional on the assumed
option count and includes sensitivity results for both `n=200` and `n=201`,
fixed support-counted reliability bins, and an exploratory risk-coverage sweep.
Multiclass Brier/log-loss are reported as unavailable because the saved
responses do not include a complete probability vector for all alternatives.
Abstentions stay in coverage denominators and are excluded from selected-answer
scores because no independent abstention-quality labels exist.

The report intentionally calls out that labels were Luna-reviewed but not
adjudicated by the document owner, each query has only one strict expected
heading, equivalent ranges are not adjudicated, language variants share cases,
and grouped query splits still use the same 21 source documents. These results
are a scorer-development diagnostic only. The runner did not persist full
per-option probabilities or the SDK version. Any future calibration or
threshold claim needs a new frozen, independently adjudicated, grouped
document/project holdout with the full probability vector, offered option IDs,
native option count, exact selector source artifact/hash, and SDK version.

Output paths use exclusive file creation and fail if either target already
exists, so rerunning cannot overwrite a previous report. Pass a new `--out`
stem to write a separate report. Historical run artifacts remain untouched.

## Live-provider smoke status

On 2026-10-04, one bounded Jev selector smoke through the active MauroPrime
Bridge 0.6.153 returned a generic provider failure before yielding a selection;
there was no exact-fetch result and no benchmark row was produced. The default
Windows Credential Manager target name was present when checked without
reading its value. A separate Bridge 0.6.154 candidate contains a managed-Node
TLS trust fix, matching a previously reproduced certificate-chain failure, but
the generic 0.6.153 response does not prove that TLS was the cause of this
specific request. The candidate has not been adopted by the active runtime.

This is a provider/runtime gate, not a Jev quality result. Retry the bounded
smoke only after a controlled 0.6.154 adoption and a live version/health
readback; preserve its source revision, model, offered option IDs/count,
complete probability vector, selection, exact fetched ranges, and independent
outcome labels before treating it as benchmark data. The 0.6.154 candidate's
focused `test:mssr-semantic-evidence` and `test:http-watchdog-lifecycle` gates
passed in an isolated worktree on this date; the watchdog test reports
`liveProductionProcessesTouched=false`. These tests validate the candidate but
do not adopt or activate it.
