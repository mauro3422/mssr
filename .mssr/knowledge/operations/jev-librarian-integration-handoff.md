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
part of the product integration. For eventual publication, create a clean
main-rooted integration branch and extract reviewed product source/tests/docs
with explicit paths and reconciled release history. Preserve benchmark runs on
an independent archive branch with exact paths/hashes and manifests. Audit
commit dependencies before selecting changes; do not cherry-pick the proposed
product cluster mechanically because several commits mix code, docs, changelogs
and project state. Neither integration step has been executed.

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

The clean product branch therefore needs a source-level transplant of the
reviewed cumulative product diff onto `origin/main`, not a sidecar-only
cherry-pick. Preserve `codex/jev-confidence-merge-evaluation` as-is and exclude
all 206 `experiments/jev-mssr-live/runs/**` paths and large predictions from the
product branch. Keep research protocol/comparison artifacts with the evidence
line unless explicitly reviewed for inclusion. Before transplant, freeze the
current candidate in a local commit and preserve a recovery ref; then build a
separate worktree from `origin/main`, apply an explicit allowlist, inspect
added/excluded paths, and run full verify/release gates there. No branch has
been extracted or pushed yet.

## MSSR contract work

The original branch is preserved as the rollback snapshot. Current work is on
`codex/project-context-librarian-sidecar-0.2.101`, forked from the exact
`ad25a9a` snapshot. The 0.2.101 sidecar binds project-declared selectors to one
direct manifest-owned heading and its current fingerprint; it does not inherit
module selectors, reuse delivery segments, or rewrite old benchmark runs. The
adapter, health/init integration, focused tests and real-document smoke are
local candidate work. Full `npm run verify` and `npm run release:gate` both
passed on 2026-10-02. The current branch has no upstream; its working changes
are uncommitted and have not been pushed. The exact local artifact is
`mauroprime-mssr-0.2.101.tgz`, 1,094,370 bytes, SHA-256
`868c5180783776a7f6dc55bab736a6f38fd84fe647cdb26b0b8b34892ebc5499`
(`pkg:0.2.101#868c5180`); independent file readback matched the final release
receipt. The tarball contains `dist/project-context-librarian.js`, its
declaration file, and the dedicated smoke/test scripts. It has not been
published.

The 0.2.100 package receipt remains
`pkg:0.2.100#849b067d5f1578b3c32c73fc4e2bafcedaa8a5e01231ac1108fa92313a103d32`.
The new work has not been published to npm. The verified 0.2.101 artifact is
ready for isolated Bridge candidate adoption; preserve one-section-per-call
exact-handle/fetch semantics, add a separate sidecar mode, run the new
real-document smoke, and verify its exact package hash. Live Bridge remains
unchanged until a separate restart/adoption decision.

## Bridge candidate

Bridge branch `codex/bridge-mssr-0.2.100-adoption-20261002` is clean and remote
synced at `2298b558598e427cdc6058983616315e08078a30`; it is 31 commits ahead of
`origin/main` and zero behind. Feature commit
`0497ce3f36363d383a78f695d8a569f1b3d3b72c` adds opt-in 0.6.146 per-single-section
metadata. A real Jev smoke covered two eligible Bridge state sections and
proved exact-fetch plumbing only. The read-only adoption review confirmed this
candidate reads only `.mssr/project-context.json`: it does not consume
`.mssr/project-context-librarian.json` or produce the sidecar's per-heading
EvidenceAtoms. Adoption requires a new explicit mode and the exact verified
MSSR 0.2.101 package; preserve 0.6.146 and keep the existing mode compatible.
Live Bridge is still 0.6.144; no merge, PR, deployment, or restart was
performed. Bridge's earlier dirty primary checkout remains untouched.

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

- **Complete:** full verification and release gate passed. Retain the exact
  package hash above and ignored receipt under
  `.mssr/runtime/releases/0.2.101.json`; keep the evaluation snapshot intact.
- **Next:** extract reviewed product/source/docs/tests into a clean integration
  branch rooted at `origin/main`, using the audited dependency chain. Keep all
  206 `experiments/jev-mssr-live/runs/` files and large prediction outputs out
  of the product branch. Preserve the original evaluation branch and current
  candidate until extraction verifies; do not cherry-pick mixed commits blindly.
- After the exact 0.2.101 package is verified, create a separate Bridge
  adoption branch from the clean 0.6.146 candidate. Add a new opt-in
  `project-context-librarian-sidecar` mode; read only explicitly supplied
  `sourceRefs`, validate sidecar/optional segment/ref presence and byte/path
  bounds, and preserve current single-section behavior. Add adversarial and
  exact-fetch regressions, then run the Bridge release checks. Keep live Bridge
  unchanged until its host is available and adoption is verified.
- Only after the product branches pass their gates, publish normal feature
  branch refs and verify local `HEAD`, tracking refs and direct remote refs.
  No main merge, npm publication, or live restart is part of the current work.
- Freeze owner-adjudicated acceptable ranges and an untouched document-level
  holdout before quality comparisons. Existing historical scores and current
  plumbing smokes remain exploratory; confidence stays uncalibrated.
