# Paired excerpt-cap study — planning record

Status: **planned, not preregistered and not run** (2026-10-11).

## Question and scope

Test whether giving Jev a larger query-centered excerpt improves exact-range
selection over the current 260-character cap, while measuring added token and
latency cost. The code sets the cap in
`src/librarian-jev-selection.ts` (`maxExcerptChars`) and builds the excerpt in
`queryCenteredExcerpt`; the full revision-bound range is fetched only after
selection. The experiment therefore measures selection quality, not exact-fetch
integrity or downstream synthesis.

The prior five linked requests against `docs/AGENT_PROTOCOL.md` are one exposed
source-document cluster. They suggest a question worth testing but provide no
paired cap comparison or causal evidence. Keep their raw Choice/Noul values
descriptive and uncalibrated.

## Exposure audit and candidate pool

The first path-based scan found 30 frozen run directories (28 with manifests)
and 22 explicit source refs, but that count was incomplete. A second scan found
full Markdown bodies for 21 documents embedded in bilingual experiment corpus
snapshots, including content not named by an individual request. Treat every
body in a provider-visible corpus/search pool as exposed, even when Jev may not
have selected it. Do not reuse exposed refs, experiment snapshots, previous
diagnostic ranges, or related revisions as clean holdout cases.

Provisional body-unexposed candidates include `docs/decisions/0006-deterministic-semantic-consistency.md`,
`docs/OPENCODE.md`, `docs/ROUTING_EVIDENCE_OBSERVATORY.md`, and
`docs/HANDOFF_EVENT_TRIGGER_WEBHOOKS.md`. Their conceptual overlap differs;
ADR 0006 overlaps semantic-consistency work, and the handoff files are a
historical stratum rather than pristine generalization data. This list is not
the frozen sample. Before any provider call, rescan every frozen input and
candidate index, choose one source per cluster, record exact Git blob hashes,
and document related-topic contamination. If too few defensible clusters
remain, report a small pilot and do not present it as a reliability estimate.

## Paired protocol to freeze before calls

1. Use the same source bytes/revision, query, candidate handles/order, Jev
   provider/model, runtime/build, and request settings in both arms. The only
   independent variable is excerpt cap: 260 versus a preselected bounded
   larger cap (candidate: 780 characters).
2. Randomize A/B request order per case. Do not include target labels, expected
   range IDs, or arm identity in the provider input. Keep one case per source
   cluster for the primary comparison; linked facets and repeats stay within
   that cluster.
3. Freeze the sources, source hashes, queries, offered candidates, labels,
   rubric, runner/build hashes, and analysis plan before live calls. Preserve
   raw requests/responses and checksums in an immutable run packet.
4. Have two reviewers independently grade exact fetched ranges while blind to
   arm, Jev score, and each other's labels. Label direct/full, partial,
   incorrect, appropriate abstention, or inappropriate abstention; separately
   score requested-facet coverage and overbreadth. Adjudicate disagreements
   against the exact source text before calculating results.
5. Primary outcome: per-source-cluster paired difference in fully sufficient,
   focused selection. Secondary outcomes: target-range recall/precision,
   facet coverage, wrong selections, appropriate/inappropriate abstention,
   exact-fetch/fingerprint integrity, and per-cluster win/tie/loss. Report raw
   Jev scores only as uncalibrated descriptors.
6. Record provider input/output tokens, elapsed time, candidate counts, excerpt
   lengths actually sent, fetch/pack checks, and requests per arm. Report the
   added cost alongside the quality delta; repeats measure stability, not
   sample size. Do not calibrate thresholds from this experiment.

## Execution gate

The current public selection interface uses the compiled 260-character cap and
does not expose a per-request experiment override. The live Bridge is recorded
at MSSR 0.2.121 while source 0.2.122 is not adopted. Before running the pair,
design and verify an isolated experiment path that can vary the cap without
changing production defaults or misreporting which package/build handled each
arm. No runtime change, provider call, score threshold, or rollout is authorized
by this plan alone.

## Next decision

Complete the corpus-exposure and source-hash freeze, then select a safe
experiment-only cap override path. If the resulting source-cluster count is too
small for more than a directional pilot, stop at that claim boundary and keep
confidence calibration deferred.
