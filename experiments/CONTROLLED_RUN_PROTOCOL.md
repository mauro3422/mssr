# Controlled benchmark run protocol

This protocol governs new benchmark runs under `experiments/`. Existing
historical runs are evidence as recorded; do not rewrite them to make them fit
this format. This protocol does not authorize network access, provider calls,
or changes to production routing.

## Default execution mode

- A run is offline by default. Preparing inputs, validating a manifest, hashing
  files, and checking local outputs must not contact a provider.
- A credential being present in the environment or credential store does not
  enable network access. A live run requires an explicit command-line opt-in
  such as `--allow-network`, plus a configured provider adapter. Without both,
  the runner must stop before making a request.
- Dry-run and validation modes must never instantiate a provider client or make
  network requests. They should report the exact frozen inputs and request
  count they would use.
- When a run calls an MSSR/Bridge tool that enforces a managed lifecycle
  preflight, create or resume an explicit bounded `traceId` and call
  `skill_bootstrap` under the same compatible host/session owner before any
  dependent domain tool. For project-scoped operations, supply the matching
  `projectRoot` and keep the trace owner aligned to it; other operations need
  only their applicable owner scope. Complete required context through the
  exact returned continuation action until it reports complete, then honor any
  post-context action and lifecycle gate. Do not count bootstrap or a
  lifecycle-rejected tool call as a provider request. If the applicable
  lifecycle cannot be satisfied, stop before provider access and classify the
  run record as `lifecycle-preflight-blocked` (a benchmark classification, not
  a portable MSSR status). Record bounded trace/stage/status evidence only;
  never include raw prompts, transcripts, secrets, or private reasoning in run
  artifacts. MSSR guidance remains advisory and does not replace normal
  authorization.
- Live calls must record the requested and returned provider/model identifiers,
  endpoint identity without credentials, SDK/version, timeout, retry policy,
  concurrency, and the explicit opt-in used. Never write credentials, auth
  headers, or unredacted provider error bodies to run artifacts.

## Run directory and immutability

Create one new directory per execution, for example:

```text
experiments/<suite>/runs/<UTC-run-id>/
  manifest.json
  inputs/                 # exact frozen cases, prompts/questions, corpora, snapshots
  records.jsonl           # one record per attempted request; append during run
  summary.json            # derived after completion; never the source of truth
  review.json             # optional independent adjudication, separate from records
  run-completion.json     # final status receipt when the frozen manifest stays prepared
  SHA256SUMS
```

For the Jev Librarian harness, keep code and run data on separate roots. The
checked-in `runner.mjs` and `experiments/jev-mssr-live/runner-contracts.mjs`
are read from the MSSR benchmark repository. Every invocation must pass an
existing `--run-root` outside that repository and outside any `runs/` tree;
the runner rejects the repository itself and any ancestor directory. Stage the
five hash-pinned files (`cases.json`, `corpus.json`,
`control-support-inventory.json`, `source-inventory.json`, and
`staged-project-identity.json`) under `<run-root>/inputs/`. Keep the staged MCP
project at the separately declared path in `staged-project-identity.json`.
Do not copy labels or target indexes into the live input set.

Example PowerShell invocation (the run folder and inputs must already exist):

```powershell
node .\runner.mjs --preflight --run-root 'D:\MSSR-benchmark-runs\jev-v19'
node .\runner.mjs --live --run-root 'D:\MSSR-benchmark-runs\jev-v19' `
  --pause-after-bootstrap --confirmation '<exact coordinator-confirmed value>'
```

The pause and exact coordinator confirmation are validated before run-root
input reads, output creation, or MCP startup. Preflight reads only local files;
the live command still waits for the separate exact `START_JEV` stdin gate
after a successful MSSR bootstrap.

Use a UTC timestamp plus a collision-resistant suffix for the run ID. Never
overwrite a run directory or raw record. A retry after interruption gets a new
run ID and an explicit `parentRunId`; do not silently splice attempts together.
Record partial runs with `status: "partial"` and their completed/expected
request counts. A later report may derive a combined view, but must keep each
original run identifiable.
When repository line-ending filters could rewrite hashed evidence, place a
run-local `.gitattributes` rule such as `* -text` in the run directory and
include that file in the final hash inventory.

`latest` is only a small convenience pointer containing a run ID and manifest
hash. It must not embed a manifest, records, or summary. A pointer is not
authoritative evidence: readers resolve it to an immutable run directory and
verify its hashes.

## Manifest fields

Every new run begins with a frozen `manifest.json` before any provider request.
It must identify all inputs and the evaluation plan. A minimal shape is:

```json
{
  "schemaVersion": 1,
  "suite": "suite-name",
  "runId": "2026-09-30T12-00-00Z-a1b2c3",
  "createdAt": "2026-09-30T12:00:00Z",
  "status": "prepared",
  "parentRunId": null,
  "source": {
    "repository": "MSSR",
    "gitCommit": "<full commit or null>",
    "workingTreeClean": false,
    "changedPaths": ["src/example.ts"],
    "buildId": "<release/build identifier or null>",
    "buildArtifacts": [{"path": "dist/example.js", "sha256": "<64 hex>"}]
  },
  "instrument": {
    "runnerPath": "experiments/suite/runner.mjs",
    "runnerSha256": "<64 hex>",
    "casesPath": "experiments/suite/cases.json",
    "casesSha256": "<64 hex>",
    "lockfileSha256": "<64 hex or null>",
    "runtime": "node <version>",
    "requestSchemaVersion": 1
  },
  "corpus": {
    "snapshotPath": "inputs/corpus.jsonl",
    "sha256": "<64 hex>",
    "items": 0,
    "sourceRevision": "<commit, export ID, or documented source>",
    "redaction": "synthetic | reviewed | not-applicable"
  },
  "provider": {
    "mode": "offline | live",
    "provider": "<name>",
    "endpointIdentity": "<non-secret identifier or null>",
    "requestedModel": "<id or null>",
    "sdk": "<name/version or null>",
    "timeoutMs": 0,
    "maxRetries": 0,
    "concurrency": 1,
    "networkOptIn": false
  },
  "labels": {
    "source": "human | independent-review | author | model-assisted | synthetic-rule",
    "frozenAt": "<UTC timestamp>",
    "adjudication": "independent | none | partial",
    "labelFile": "inputs/labels.json",
    "labelFileSha256": "<64 hex>",
    "exposedToRequests": false
  },
  "split": {
    "method": "frozen-holdout | grouped-project | grouped-concept-source | temporal | none",
    "trainIdsSha256": "<64 hex or null>",
    "calibrationIdsSha256": "<64 hex or null>",
    "validationIdsSha256": "<64 hex or null>",
    "holdoutIdsSha256": "<64 hex or null>",
    "calibrationOpenedAt": null,
    "holdoutOpenedAt": null,
    "thresholdsFitOn": "calibration | pre-registered-fixed | none",
    "holdoutUsedForTuning": false
  },
  "plan": {
    "primaryMetric": "<predeclared metric>",
    "secondaryMetrics": [],
    "thresholds": {},
    "independentUnit": "<case, project, or other cluster>",
    "minimumSupport": {"overall": 30, "perClaimedSubgroup": 30},
    "uncertaintyMethod": "<predeclared interval/resampling method>"
  }
}
```

The schema above is a field contract, not permission to invent missing values.
Use `null` or an explicit `unknown` status where evidence is unavailable. Hash
the exact bytes of every frozen input; do not hash a parsed-and-reserialized
object in place of the source file hash. Include all evaluated source/build
artifacts, including the selected MSSR manifest and modules when the corpus is
read from the working tree. A hash proves identity, not that the input was
appropriate.

## Request records and summaries

Each `records.jsonl` line represents one attempted request, including failed or
timed-out attempts. Include stable case/item/repetition IDs, request fingerprint,
input artifact hashes, start time, latency, requested/returned model, provider
request ID if available, token usage if returned, a validated response or a
classified error, and whether any retry occurred. Do not include credentials,
unredacted exception bodies, or unrelated user/private content.

Summaries are derived artifacts. They must report attempted, successful,
failed, and excluded counts; the denominator and missing-data policy for every
metric; input/output usage; and the exact code/version that produced the
summary. A validator should check record counts and IDs against the frozen
manifest, response shape, file hashes, and status before marking a run complete.
Keep `summary.json` and human-readable reports separate from raw records.

The Jev live runner freezes eligible and excluded request IDs in the manifest.
Before closing a run it checks unique record IDs, eligibility, record statuses,
summary denominators, completion counts, and exact-byte manifest/records/summary
hashes. Summary fields use `attemptedRequests` for terminal records,
`completedRequests` for successful requests, and `failedRequests` for failed
requests. The final run-completion receipt is then written and `SHA256SUMS` is
generated over every regular run file except itself; symbolic links are
rejected. Verify that inventory before using the run.

The manifest is frozen before inference and must not be edited to change
`status: prepared` after calls begin. Record the terminal state in
`run-completion.json`, including `runId`, the exact-byte `manifestSha256`,
completion time, and request counts for expected, attempted, completed,
failed, excluded, and not-started work. `completed` counts successful requests;
`expected` means eligible requests after applying the frozen exclusions;
`excluded` counts planned requests omitted from that denominator and is reported
separately. `attempted` counts eligible requests with a terminal success or
failure record; the remaining eligible requests are `notStarted`. Report whether
labels were exposed to the provider.

Provider-call counts must distinguish `known` from `unknown`. If a selector
request may have reached the provider but no valid response arrived, report an
unknown total rather than zero. `providerCallsReported` is the sum reported by
observed valid selector responses; when the total is unknown, it is a possibly
partial lower bound, not a substitute for the total. A zero is valid only when
the runner can establish that no provider request was attempted. The
run-completion receipt's status is authoritative for execution completion; the
manifest remains authoritative for the frozen plan and input identities.
Include the completion receipt, summary, review, report, manifest,
records, and every input in `SHA256SUMS`; exclude only `SHA256SUMS` itself.
Recompute the inventory after writing the final receipt.

## Labels, holdouts, and claims

- Freeze labels, rubrics, candidate sets, questions, thresholds, and exclusions
  before inference. State whether labels were written by the experiment author,
  independently reviewed, or adjudicated; never call author-created labels
  independent ground truth.
- For retrieval or evidence-selection tasks, freeze a gold set of acceptable
  source ranges/handles per case when the corpus contains overlapping blocks
  and sections. Keep exact match to one author-preferred handle as a separate
  metric from whether the selected evidence answers the question. Declare
  direct, equivalent, partial, and insufficient evidence criteria before
  inference; do not treat a post-run blind adjudication as if it had been
  frozen gold.
- Do not place expected labels or rationales in provider request state. Keep
  labels in a separate frozen input file and set `exposedToRequests: false`.
- Group splits by the true independent unit (for example, project or source
  document), not by repeated request. Near-duplicates and repeated variants of
  one case stay in one split. Keep translations and language variants of the
  same concept together; count them as one concept-level unit, not independent
  samples. When concepts share source documents, group by the source/concept
  cluster chosen in the preregistered plan so related evidence cannot cross
  splits.
- Give `calibration` a distinct, frozen ID set and SHA-256 before inference.
  Define the threshold objective and candidate thresholds in the plan. Open
  calibration labels only after the instrument, rubric, metrics, exclusions,
  and analysis plan are frozen; fit or select thresholds on calibration data
  only. `validation` is an optional development split and must not silently
  substitute for calibration. Keep the holdout ID set and labels separate and
  unopened until the instrument, threshold, and analysis plan are frozen. Never
  tune on holdout results. Record calibration and holdout opening timestamps.
- Open holdout labels only after the instrument, thresholds, and analysis plan
  are frozen. If a holdout label/result prompts any post-hoc change to the
  instrument, threshold, or plan, mark that holdout exploratory and create a new
  untouched holdout for confirmatory claims.
- Repeated model calls on one case measure repeatability, not independent
  sample size. Report per-case/project variability and use an interval or
  resampling method that respects clustering. Do not use a narrow interval
  computed over calls as if each call were a distinct case.

## Minimum support and uncertainty

Unless a suite declares a stricter, justified policy before the run, fewer than
30 independent labeled units overall or fewer than 30 units in a claimed
subgroup are exploratory only. Report the numerator, denominator, interval, and
cluster unit; do not make a superiority, calibration, safety, or promotion claim
from a small point estimate. This floor is a reporting gate, not a sample-size
adequacy guarantee: 30 units may still be inadequate for threshold selection,
subgroup claims, or stable reliability bins. Preregister the interval/resampling
method at the independent-unit cluster level and show bin counts and uncertainty
on reliability plots; do not interpret noisy ECE bins as precise calibration.
For probabilistic outputs, report a proper score such as Brier score and/or log
loss alongside reliability diagrams and ECE, with the event/options, class
aggregation, binning rule, and empty-bin policy fixed in advance. For abstention
or thresholded operation, report risk/error against coverage (including the
threshold chosen on calibration data) on the untouched holdout. For zero
observed errors, report an uncertainty bound rather than claiming zero risk.
Abstentions, invalid outputs, and provider failures must remain visible and must
not disappear from denominators without a declared rule.

These support floors are reporting gates, not a guarantee of adequate power or
representativeness. Any automated behavior change needs a separate, reviewed
promotion policy and evidence on untouched, representative holdout data. A
benchmark result alone never authorizes a production change.

## Integrity check before sharing

Before publishing or using a run to support a decision:

1. Verify every `SHA256SUMS` entry and the latest pointer's manifest hash.
2. Confirm the source commit/build and corpus snapshots resolve to the recorded
   bytes; flag dirty working trees explicitly.
3. Confirm the manifest says whether network access occurred and matches the
   runner's explicit opt-in behavior.
4. Check labels were frozen before inference and were not sent to the provider.
5. Validate raw request/response counts, failures, retries, and derived metrics.
6. Confirm the claim is limited to the sampled corpus, label quality, model,
   prompt, and support actually measured.
