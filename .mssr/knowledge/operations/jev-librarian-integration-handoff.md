# Jev Librarian integration and Git handoff

## Repository snapshot and preservation

Read-only audit on 2026-10-02 found the MSSR snapshot branch
`codex/jev-confidence-merge-evaluation` at
`ad25a9a158c289e0a1dae5674a1e77df42be752d`, equal to its origin tracking ref and
clean (no modified, staged, or untracked files). It descends from
`main`/`origin/main` `dfb295653b2e3f0f2a6f0d25bb2bc5cbe9634962` with 29 commits
ahead and none behind. Its 255-path diff contains 1,183,808 insertions and 56
deletions. The 206 versioned paths under
`experiments/jev-mssr-live/runs/` total 53,079,986 bytes; two
`predictions.json` files are 21,106,890 bytes each. They are immutable run
evidence, not untracked debris. The separate `codex/benchmark-archive` branch at
`05ccb68` does not include these Jev runs (`git ls-tree -r codex/benchmark-archive
-- experiments/jev-mssr-live/runs` returned no paths). Preserve the full snapshot
and every run id, manifest, output, label/review and hash without rewriting or
pruning.

Do not merge the 29-commit evaluation branch wholesale into `main`: that would
couple product code/releases to all 206 run paths and make benchmark evidence
part of the product integration. A clean main-rooted integration branch now
exists and contains the reviewed cumulative product source/docs/tests without
run payloads. Preserve the benchmark runs on their original snapshot branch
with exact paths/hashes and manifests. Clean installation, full verification,
release gating, artifact readback, and the commit-bound real-document smoke
pass. The product commit is pushed on the clean feature branch, and a direct
remote readback matched the full commit SHA.

## Product lineage audit

The Luna review confirmed `origin/main` (`dfb2956`) is the merge-base/ancestor
of candidate `ad25a9a`, which is 29 commits ahead and zero behind. The
sidecar's release cannot be extracted by itself: MSSR `main` has the reusable
Zod, Document Surface, EvidenceAtom and project-context foundations, but it
does not yet have `src/librarian-retrieval.ts`, the Jev selector, or exact
search-handle plumbing required by the sidecar's projected records. The
product dependency chain includes semantic-evidence foundation `1420e88`,
Jev selection `4c1cd24`, handle selection `b0821bb`, bounded/normalized
selection `b080317`, EvidenceAtom projection `6dfe603`, dense excerpt handling
`7a8027f`, oversized-fetch handling `bec66ad`, and the 0.2.101 sidecar.

The clean product branch was made by source-level transplant of the reviewed
cumulative product diff onto `origin/main`, not a sidecar-only cherry-pick.
The patch was based on the local sidecar recovery commit and excluded all 206
`experiments/jev-mssr-live/runs/**` paths and large predictions while retaining
`experiments/CONTROLLED_RUN_PROTOCOL.md`. Its SHA-256 and exact path count are
recorded below. Preserve `codex/jev-confidence-merge-evaluation` as-is; no run
result was rewritten or pruned.

## MSSR contract work

The original branch is preserved as the rollback snapshot. Local recovery
commit `ba1599b` is on `codex/project-context-librarian-sidecar-0.2.101`, forked
from the exact `ad25a9a` snapshot. The current product worktree is
`D:\Dev\mssr-product-0.2.101` on
`codex/mssr-0.2.101-product-integration`, rooted at verified `origin/main`
`dfb295653b2e3f0f2a6f0d25bb2bc5cbe9634962`. A 65-path, 6,351-insertion source
patch is applied; it contains zero paths under
`experiments/jev-mssr-live/runs/**` and retains the controlled-run protocol.
The patch backup is `D:\Dev\mssr-snapshots\mssr-0.2.101-product-extraction-ba1599b.patch`,
SHA-256 `c9fd0be0cf20548f9cc73d782e7502875457cb9777353634929eb49889245073`.

The 0.2.101 sidecar binds project-declared selectors to one direct
manifest-owned heading and its current fingerprint; it does not inherit module
selectors, reuse delivery segments, or rewrite old benchmark runs. The
candidate source tree passed full `npm run verify` and `npm run release:gate`
on 2026-10-02. The exact local artifact is
`mauroprime-mssr-0.2.101.tgz`, 1,094,370 bytes, SHA-256
`868c5180783776a7f6dc55bab736a6f38fd84fe647cdb26b0b8b34892ebc5499`
(`pkg:0.2.101#868c5180`); independent file readback matched the final release
receipt. The tarball contains `dist/project-context-librarian.js`, its
declaration file, and the dedicated smoke/test scripts. It has not been
published. A clean `npm ci`, full `npm run verify`, and `npm run release:gate`
all passed in the integration worktree; independent tarball readback matched
the same SHA-256. Product commit
`cd7c834df2f91d581b8f84db9d89a9d425dd1c6f` has 65 product/docs/test paths and
zero benchmark run payloads. The commit-bound real-document smoke passed 4/4
declared projections, 4/4 metadata searches, and 4/4 exact fetches. Its ignored
receipt is `.mssr/runtime/project-context-librarian-real-doc-smoke-latest.json`.
The branch was pushed with `git push --set-upstream`; direct
`git ls-remote` returned the same full commit SHA. No npm publication or live
Bridge restart occurred; candidate adoption is documented below.

The 0.2.100 package receipt remains
`pkg:0.2.100#849b067d5f1578b3c32c73fc4e2bafcedaa8a5e01231ac1108fa92313a103d32`.
The 0.2.101 package has not been published to npm. Its isolated Bridge
candidate adoption is recorded below; live Bridge remains unchanged pending
transport verification and a separate adoption decision.

## Bridge candidate

Bridge 0.6.147 is preserved and remote-synced on
`codex/bridge-mssr-0.2.101-librarian-sidecar-20261002` at
`0570bd27c4d9f4d9db68c6978a09dcb075920517`, based on clean candidate
`2298b558598e427cdc6058983616315e08078a30`. It vendors exact MSSR 0.2.101
artifact bytes (SHA-256
`868c5180783776a7f6dc55bab736a6f38fd84fe647cdb26b0b8b34892ebc5499`) and adds
opt-in `project-context-librarian-sidecar` metadata to the existing
`mssr_librarian_search`; lexical default and the 0.6.146 metadata mode remain.
The bridge reads only canonical bounded `.mssr/` manifests and caller-selected
Markdown refs, projects exact heading/fingerprint-bound metadata, and leaves
Jev as a separately invoked exact-handle selector/fetch path. No duplicate MCP
tool is added.

Candidate checks passed: install, typecheck, build, semantic-evidence
regression, skill routing (271 effective cases), generated docs and one
real-project/real-Jev exact-fetch integration smoke. Jev selected an exact
783-character source range and its fingerprint matched; provider verification
is unverified and confidence uncalibrated. Release readiness is blocked:
`test:mcp-dual-era` fails parsing the first legacy SSE initialize response
(`Invalid character in chunk size`, with `event: message` interpreted as a
chunk header), and `test:regressions` closes during its first initialize. The
cause is unresolved; stripped headers, forced close and JSON response
experiments did not fix it and were discarded. `verify:all` was not run because
it targets the active Bridge endpoint on port 3001, unavailable in this
session. See Bridge `docs/INCIDENTS.md` on the candidate branch. Live Bridge
remains 0.6.144; no restart, deployment, PR or main merge occurred. The dirty
primary Bridge checkout, clean base worktree, MSSR feature branch and benchmark
runs remain untouched.

## 0.2.101 candidate receipts

The real-document smoke used the built 0.2.101 projection over four exact
headings in the current MSSR repository: 4 declarations projected, 4 metadata
searches returned the intended exact handles, and all 4 exact fetches passed.
Receipts are under ignored `.mssr/runtime/` as
`project-context-librarian-real-doc-smoke-20261002T223744Z.json`,
`project-context-librarian-real-doc-smoke-20261002T223846Z.json`, and the final
post-state-update receipt `project-context-librarian-real-doc-smoke-20261002T230440Z.json` (the earlier post-compaction check was `project-context-librarian-real-doc-smoke-20261002T224536Z.json`). Build id was
`mssr-build:sha256:ecf594115342fa3c`; sidecar SHA-256 was
`40cc2dc59afbf87a10db098c9ac96bb49e571fb90204e4f4a1efb3772b03c1af`.
This is integration evidence, not a retrieval-quality benchmark.

One actual Jev provider call used two metadata-filtered exact handles. Jev
selected “100 hipótesis de uso” (providerConfidence 0.82; evidence sufficiency
0.75, both explicitly uncalibrated/unverified); the returned exact handle then
fetched 7,728 UTF-16/code units with matching source fingerprint. The call used
828 input and 67 output tokens and took about 494 ms. Its bounded receipt is
`.mssr/runtime/project-context-librarian-jev-smoke-20261002T223846Z.json`; it
stores hashes and outcome metadata, not the raw query. The active MSSR MCP
server still advertises the old build `86070e2a0e734090`, so this proves the
current tool chain accepts a sidecar-derived handle; it does not prove host
adoption of package 0.2.101.

## Resolved verification friction

The first release-gate attempt stopped because root `CHANGELOG.md` still
identified 0.2.100. Updating its current-release pointer to 0.2.101 allowed
the full gate to pass. The first verify-stage route also rejected
`PROJECT_STATE.md`: its `## Current release` section had grown to 2,895
characters against the 2,500-character core budget. The summary was compacted
to 1,079 characters; receipts and details remain here, and routing plus the
real-document smoke passed afterward. These were documentation/state
maintenance issues, not sidecar runtime defects.

## Evaluation gates

1. **Complete:** `npm run verify` and `npm run release:gate` passed. The exact
   local package hash and ignored release receipt are recorded above; no npm
   publication occurred.
2. Freeze corpus bytes, manifest/sidecar revisions, query set, candidate limits,
   acceptable ranges, and independent labels before comparing retrieval.
3. Compare lexical search with metadata search using identical sources and
   limits. Split by document, not paraphrased queries. Adjudicate relevance and
   sufficiency independently of the sidecar selectors or model output.
4. Only after the lexical-vs-metadata baseline is interpretable, run Jev over
   identical exact handles and evaluate selection, abstention, contradiction,
   fetch integrity, utility, and citation fidelity separately.

Historical 48/51, 45/51, 31/52, 35/52, 34/52 and smoke scores remain immutable
exploratory artifacts; repeated ranges, author labels and incomplete holdouts do
not calibrate confidence or establish a production threshold. Keep the
confidence threshold unset and all decisions advisory.

The specific 48/51 EvidenceAtom-versus-parent-metadata rubric run is outside
this repository at
`D:\Dev\mssr-snapshots\benchmark-real-evidence-atom-20260930-rubricmatch-8f2c3a17`.
Its `manifest.json` SHA-256 is
`1ac3ce726999ff8a9934b5e43b799701a285a32d6a334d0a6a507921658030cf`.
It covered 17 sections from four source modules with three repeated variants;
labels were author-created, and the holdout had already been opened and used
for tuning. Treat it as exploratory evidence only; the external directory and
its other hashes are preserved at that location, not versioned in this checkout.

The 2026-10-01 21-document / 200-heading bilingual comparison is recorded in
`experiments/jev-mssr-live/runs/MSSR-LIBRARIAN-JEV-COMPARISON-20261001.md`:
direct Choice runs scored 35/52 and 34/52; the hierarchical run scored 31/52.
Labels were Luna-reviewed exact headings, not owner-adjudicated acceptable
ranges. Fetch success measured handle integrity, not semantic quality. The
offline Spanish lexical rewrite reused an opened holdout and worsened English
recall; it stays out of product. The earlier October 2 confidence smoke did
not include the new sidecar's records or EvidenceAtoms, so it proves neither
metadata retrieval benefit nor sidecar-to-fetch integration. The later 22:38
sidecar-derived Jev smoke does exercise the new handle path, but remains
plumbing evidence, not quality evidence.

## Next gates

- **Complete:** MSSR 0.2.101 product commit `cd7c834df2f91d581b8f84db9d89a9d425dd1c6f`
  and Bridge candidate commit `0570bd27c4d9f4d9db68c6978a09dcb075920517` are
  on separate pushed feature branches with remote readback verified. MSSR's
  release gate passed; its package is not published. Bridge's candidate is
  preserved, but its HTTP release gates fail as described above.
- **Next:** diagnose the isolated MCP SSE/chunk-framing failure in Bridge and
  compare against a functioning clean baseline with the same extended startup
  readiness. Re-run dual-era and regression HTTP checks, then the complete safe
  candidate gate; do not merge or adopt live until these pass. Keep the live
  Bridge at 0.6.144 and the original dirty primary checkout untouched.
- Keep all 206 `experiments/jev-mssr-live/runs/` paths, manifests, outputs,
  labels/reviews and hashes on their original evaluation branch. Do not
  cherry-pick the mixed evaluation snapshot or rewrite benchmark evidence.
- After Bridge integration passes, freeze bytes, sidecar/source revisions,
  query set, candidate limits, owner-adjudicated acceptable ranges, and an
  untouched document-level holdout. Compare lexical and metadata search with
  identical source/limit sets; then evaluate Jev exact selection, abstention,
  contradictions, fetch integrity, utility and citation fidelity separately.
  Existing scores remain exploratory; do not set a confidence cutoff.
- No main merge, npm publication, live Bridge restart, or deployment is part of
  the current handoff.
