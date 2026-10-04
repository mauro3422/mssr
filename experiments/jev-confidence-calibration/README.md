# Jev top-label confidence diagnostic

This offline evaluator adds a derived, exploratory view over immutable Jev 80k
single-pass runs. It does not make provider calls, edit the run folders, claim
production calibration, or recommend a threshold.

Run it from this directory:

```powershell
node .\evaluate.mjs
node --test .\evaluate.test.mjs
```

The evaluator validates the run SHA256SUMS inventory, frozen input hashes, manifest/run identity, 26
bilingual cases, all 52 response IDs, single-pass mode, and the final Choice
option count in every response. The selected records in these runs have both
`candidateCount` and `finalistCount` equal to 200, which agrees with the
manifest's 200-heading full-catalog single-pass mode. It derives top-option
mass from the documented TypeSafe normalized Choice confidence formula only
after those checks. That mass is a top-choice concentration value, not a
probability that the selected evidence is correct.

The JSON output includes exploratory top-label binary Brier/log-loss, fixed
support-counted reliability bins, and a clearly marked risk-coverage sweep.
Multiclass Brier/log-loss are reported as unavailable because the saved
responses do not include a complete probability vector for all alternatives.
Abstentions stay in coverage denominators and are excluded from selected-answer
scores because no independent abstention-quality labels exist.

The report intentionally calls out that labels were Luna-reviewed but not
adjudicated by the document owner, each query has only one strict expected
heading, equivalent ranges are not adjudicated, language variants share cases,
and grouped query splits still use the same 21 source documents. These results
are a scorer-development diagnostic only. Any future calibration or threshold
claim needs a new frozen, independently adjudicated, grouped document/project
holdout with complete per-option probabilities.

Output paths use exclusive file creation and fail if either target already
exists, so rerunning cannot overwrite a previous report. Pass a new `--out`
stem to write a separate report. Historical run artifacts remain untouched.
