# MSSR routing incident log

This file records confirmed routing failures and the regression that prevents each one from returning. It contains only observable inputs, outputs, causes, changes, and test evidence. It must not contain hidden chain-of-thought.

## MSSR-001 — Roblox project migration opened gameplay branches

**Date:** 2026-07-21

### Trigger

A task asked to move a local Roblox project folder, preserve the `.rbxl`, backups, assets and documentation, compare hashes, update stale absolute paths, initialize Git, create a repository, and push it.

### Observed failures

1. A structured call using natural concepts such as `git`, `filesystem`, `move`, `verify`, `version`, `project`, `repository`, `place-file`, `integrity-verification`, and `version-control` was rejected because the intent vocabulary did not include those values.
2. The lexical fallback reduced the task to broad tags such as `roblox`, `create`, and `game`.
3. That broad classification selected unrelated gameplay skills, including network authoring, placement authoring, technique animation, UI review, locomotion review, resource-network tests, Play Mode QA, and Roblox official-doc lookup.

### Root causes

- The structured vocabulary covered gameplay and content editing better than project administration, filesystem migration, and local Git.
- `game` was used as the default Roblox artifact when no specialized artifact was recognized.
- Generic local `documentación` was incorrectly interpreted as a need for official Roblox documentation.
- The `roblox-development` workflow matched every Roblox-domain task, even when the operation only changed project files and repository state outside Studio.
- Several specialized Roblox skills shared the broad anchors `roblox + game + create`, so they scored without evidence that their specific subsystem was involved.

### Correction

- Added explicit intent vocabulary for `git`, `filesystem`, `move`, `verify`, `version`, `project`, `repository`, `place-file`, `backup`, `integrity-verification`, and `version-control`.
- Taught lexical fallback to recognize project moves, repository bootstrap, hashes, stale paths, `.rbxl` files, backups, local documentation, commits, tags, and Git publication.
- Narrowed `official-docs` detection to explicit official/API-reference wording instead of generic documentation work.
- Narrowed the `roblox-development` workflow so it requires a Studio/gameplay artifact and does not match repository-only migration work.
- Extended `mauroprime-bridge-collaboration` and `roblox-save-backup-recovery` routing metadata and procedures for safe project-root migration.
- Added structured and lexical regression fixtures that require the collaboration/persistence path and explicitly exclude unrelated gameplay branches.
- Added `coversPhases` so one coherent procedure can cover multiple workflow phases without creating artificial skills. The merge rule prefers explicit `coversPhases`, then explicit `phase`, and only then inferred phase metadata.
- Added fixture assertions for `missingRequiredPhases` so a plan cannot appear correct while silently leaving required phases uncovered.

### Regression fixtures

- `roblox-project-repository-migration-structured`
- `roblox-project-repository-migration-fallback`

### Verification

Completed successfully on 2026-07-21:

- `npm run test:skill-routing`: 17/17 expanded cases passed;
- both migration fixtures select only `mauroprime-bridge-collaboration` in the active phase and defer `roblox-save-backup-recovery`;
- unrelated Roblox routing, official-doc lookup, gameplay authoring, UI, animation, Play Mode QA, Studio QA, and resource-network testing are explicitly excluded;
- `verify-skills.ps1`: 24/24 source skills have valid junctions and frontmatter;
- `test-codex-discovery.ps1`: 24/24 custom skills appear in the real Codex prompt;
- `skill_route_audit`: clean, with no cycles, broken references, stale entries, or maintenance pending;
- `npm run verify:all`: all required checks passed, including TypeScript, build, HTTP smoke, regressions, routing, documentation, watchdog, metrics, and tool-catalog sanity.
- after restarting the live Bridge, both structured and lexical migration calls returned only `mauroprime-bridge-collaboration` as active, `roblox-save-backup-recovery` as deferred, no matched gameplay workflow, no warnings, and `missingRequiredPhases = []`.

## MSSR-002 — Plugin skills were invisible to the live Bridge

**Date:** 2026-07-23

### Trigger

The filesystem contained managed `SKILL.md` files under `~/.codex/plugins/cache`, and Codex exposed those plugin skills, while `skill_catalog` and `skill_route_audit` reported only local/system/Roblox entries.

### Observed failure

The plugin crawler called the general Bridge path policy. Safe defaults allowed `~/.codex/skills` but not `~/.codex/plugins/cache`; the root exception was caught and converted into an empty result without a warning. The audit appeared clean because the missing source never entered the registry.

### Correction

- Added an internal read-only discovery boundary for the resolved plugin cache root without broadening normal filesystem permissions.
- Reject plugin directories that resolve outside that exact root.
- Return an observable warning when an entire skill root cannot be read.
- Added an isolated regression with a temporary `CODEX_HOME` whose general allowed roots deliberately exclude `plugins/cache`.

### Regression

`scripts/test-v060-tools.mjs` requires `fixture-plugin-skill` to be discovered as `codex-plugin` while the general Bridge path policy still excludes the cache.

## MSSR-003 — Specific repository tags suppressed OpenCode and Blender crossed into Roblox

**Date:** 2026-07-23

### Triggers

1. A structured OpenCode swarm request added the accurate artifact `repository` alongside `code`.
2. A Blender-only object review used `model-3d`, `visual-qa`, `review`, and `optimize`.

### Observed failures

- `opencode-agent-swarm` disappeared because the specific-artifact gate had no `repository` metadata, leaving only the general Bridge collaboration skill.
- A short swarm continuation lost `cross-agent` because lexical fallback did not recognize `swarm` or `subagent` as orchestration needs.
- `roblox-model-turnaround-review` matched a Blender-only domain and pulled its Roblox router dependency.
- `blender-reference-pipeline` matched review work by artifact despite having no matching action.

### Correction

- Added `project` and `repository` to the OpenCode swarm/audit metadata.
- Taught fallback that `swarm`, `subagent`, and `subagente` imply `cross-agent`.
- Restricted the Roblox turnaround skill to the Roblox domain.
- Added the reusable `requireActionMatch` gate and applied it to Blender reference creation.
- Restricted Roblox save/recovery to Roblox and let Bridge collaboration coherently cover persistence for general project migration.

### Regression fixtures

- `opencode-swarm-positive`
- `opencode-existing-repository-audit-does-not-create-swarm`
- `opencode-swarm-continuation`
- `blender-review-does-not-open-roblox-branch`
- `generic-coding-uses-explicit-agent-fallback`
- `generic-project-migration-stays-outside-roblox`

## MSSR-004 — Roblox tools/list returned zero without degrading source health

**Date:** 2026-07-23

### Trigger

Roblox Studio MCP completed its MCP handshake and exposed a Studio instance in Edit mode, while `tools/list` waited about ten seconds and returned no tools.

### Observed failure

- `roblox_mcp_status` reported `connected: true` with `toolCount: 0`.
- `roblox_mcp_tool_list` returned `{ count: 0, tools: [] }` without a warning.
- `skill_catalog` filtered to `source=roblox` returned an empty catalog with no source-health explanation.
- `skill_route_audit` remained clean because a successful empty list was not an exception.
- After a Bridge restart there was no durable last-known schema catalog, so the proxy could not safely classify or invoke dynamic Roblox tools.

### Cause

The immediate live cause was an orphaned `StudioMCP.exe` process from 2026-07-21 whose parent no longer existed. The current Bridge child and the intended direct MCP process were both still present; removing only the verified orphan restored 27 live tools in 6 ms without closing Studio.

The Bridge amplified the incident because it only retried closed-connection errors. It treated any successful `tools/list` response as healthy, including an empty response, and the skill catalog only converted thrown errors into warnings.

### Correction

- Classify the remote catalog as `healthy`, `degraded`, or `unavailable`.
- Retry an empty or failed `tools/list` once after resetting only the Bridge-owned StudioMCP child connection.
- Persist non-empty tool schemas under ignored runtime data and use them as explicitly marked last-known schemas during a live outage.
- Return source health and warnings from Roblox tool listing, skill discovery, routing, and audit calls.
- Mark a requested degraded Roblox source as maintenance-required instead of silently passing the audit.
- Add `refresh` to the Roblox status and tool-list tools for an explicit bounded reprobe.
- Diagnose process ownership before cleanup. Never kill every StudioMCP process: preserve the direct MCP and the current Bridge-owned child, and remove a process only after proving its parent is gone.

### Regression

`scripts/test-v060-tools.mjs` checks healthy, degraded-with-cache, and unavailable-without-cache classifications. Live verification must additionally confirm that an empty remote list is never presented as healthy.

The repaired live verification returned 27 tools, six `rbx-*` skills, `status=healthy`, `usingCachedTools=false`, and persisted a 27-tool last-known catalog under ignored runtime data.

## MSSR-005 — Dashboard treated complements and prose as dependency cycles

**Date:** 2026-07-23

### Trigger and failure

The Python dashboard audit scanned every skill-name mention in `SKILL.md` as a dependency edge. Legitimate two-way complements among Roblox visual-review skills appeared as three cycles, while the runtime router correctly reported no mandatory dependency cycles.

### Correction and regression

The dashboard keeps textual mentions for reference/inbound visualization, but computes cycles only from explicit Git-tracked `requires` edges. Regenerating the dashboard now reports `cycles: []`, matching `skill_route_audit`.

## MSSR-006 — Concurrent clients could race reconnect and active-Studio selection

### Symptom

The HTTP Bridge supported multiple MCP sessions, but all sessions shared one persistent StudioMCP client without an explicit operation gate. Concurrent catalog probes could both reset the child, and a proxied mutation only instructed the caller to verify the active Studio without enforcing the target.

### Cause

Connection creation was single-flight, while inspection/reconnect and multi-call target selection were not one serialized transaction. Cached annotations were also accepted by generic proxy dispatch.

### Correction and regression

- Serialize operations over the Bridge-owned StudioMCP connection and coalesce catalog inspections.
- Report exact child ownership, reconnect, and queue diagnostics.
- Add `roblox_mcp_studio_list`.
- Atomically validate/select `studioId` and execute the call.
- Require explicit targeting for mutations when multiple Studios exist.
- Require a healthy live catalog before proxy dispatch or Roblox skill loading.
- Close the owned child during HTTP and stdio shutdown.

`scripts/test-v060-tools.mjs` validates health classification, Studio-list parsing, the new registry entry, and risk classification. HTTP/regression and live verification cover the shared transport.

## MSSR-007 — Incident semantics were implicit and could not route recovery

### Symptom

The intent contract represented domain, action, artifact, need, risk, and ambiguity, but could not distinguish ordinary Roblox MCP work from a connected-but-degraded catalog, contradictory evidence, recurring friction, or a reusable workaround. Maintenance depended mostly on `stage=close`.

### Correction and regression

- Add mandatory semantic `signals`, with `nominal` as the clean-state value.
- Normalize high ambiguity to `uncertainty` and never retain `nominal` beside an incident signal.
- Route incident signals to verification and friction/pattern signals to maintenance.
- Add `roblox-mcp-incident-recovery` as an explicit routed skill.
- Cover structured positive, nominal negative, bounded-context continuation, and close/maintenance cases in fixtures.

## Incident policy

For every confirmed false positive, false negative, schema rejection, phase error, or dependency error:

1. preserve the smallest reproducible task and context;
2. record the observable wrong selection;
3. identify whether the fault is vocabulary, fallback classification, metadata, workflow matching, scoring, dependency expansion, or phase activation;
4. make the smallest general correction rather than special-casing one sentence;
5. add a positive and nearby negative fixture;
6. run the complete routing suite and audit;
7. update this file with final verification evidence.

MSSR's own recovery verification also exposed a nearby false positive:
`roblox-mcp-incident-recovery` declared the broad `agent-orchestration` domain,
so a generic MSSR recovery/tool-chain intent could select a Roblox-only
procedure. Its durable routing domain is now `roblox`, and both generic MSSR
fixtures explicitly exclude that skill.

## MSSR-008 — Removing a verification worktree traversed a local package junction

**Date:** 2026-07-23

### Trigger and impact

A temporary Bridge worktree ran `npm install` while Bridge depended on MSSR
through `file:../mssr`. On Windows, npm represented that dependency inside
`node_modules` as a junction to the canonical `C:\Dev\mssr` directory. Forced
recursive removal of the temporary worktree traversed the reparse point and
emptied the canonical MSSR tree, including its local `.git` directory.

The already-pushed Bridge and shared-skills repositories were unaffected. MSSR
had no remote yet, so it was reconstructed from the Bridge migration commit,
the canonical routing contract, generated build evidence, and parallel recovery
of the registry, MCP facade, tests, and documentation.

### Correction

- Treat dependency links and reparse points as explicit cleanup boundaries.
- Before recursively removing a temporary install or worktree, enumerate links
  below it and unlink each link itself without traversing its target.
- Prefer `git archive` or another disposable plain export for clean verification
  of a repository that has sibling `file:` dependencies.
- Never remove the disposable directory until the canonical dependency target
  has been resolved and verified outside that directory.
- Keep a remote for MSSR once the desired repository name and visibility are
  chosen; local Git alone is not a disaster-recovery boundary.

### Regression evidence

Recovery is accepted only after `npm run verify` passes in `C:\Dev\mssr`, the
Bridge resolves `@mauroprime/mssr` from that canonical path, and both Git
repositories retain their expected independent roots.

## MSSR-009 — Reference-driven asset work advanced without a fidelity gate

**Date:** 2026-07-23

### Symptom

Several Roblox soil/mycelium revisions advanced after successful generation and
camera capture even though direct inspection still read as balls in a wire cage,
a stacked coil, or overlapping disks. Changing the carrier soil geography also
left the dependent mycelium buried or floating because its placement contract
was not tied to the rendered carrier surface.

### Cause

The routed capture and forge skills strongly specified technical evidence but
did not require a transversal reference-replication contract before authoring
or an explicit `accepted`, `degraded`, or `rejected` result after every capture.
Technique assumptions were expanded across the asset before a representative
primitive proof.

### Correction and regression

- Add `visual-reference-replication` with dominant-read, silhouette/mass,
  topology, surface/style, layer-relationship, detail, and multi-view gates.
- Require risky primitive/technique proofs before full authoring.
- Treat surface-bound networks as dependents of current carrier geography and
  rebuild them when that geography changes.
- Support estimated masks, depth/height, normals, slope, texture-frequency, and
  network skeletons as auxiliary evidence without calling them ground truth.
- Add structured positive, bounded continuation, and nearby text-only negative
  routing fixtures.

## MSSR-010 — Procedural Roblox QA excluded a supported CSG property

**Date:** 2026-07-24

### Trigger

A distance-dependent blue/cyan render regression in MyceliumFront required separating Atmosphere, Sky, environment reflection, built-in material behavior, z-fighting and CSG/mesh LOD. Live Studio inspection showed that the affected `UnionOperation` instances expose `RenderFidelity` through `PartOperation`.

### Observed failure

The canonical `roblox-studio-qa` and `roblox-safe-editing` procedures stated that `RenderFidelity` was only a `MeshPart` concern and explicitly excluded `UnionOperation`. That instruction could create a false negative during future diagnosis, even though the current incident was ultimately solved by `Atmosphere.Density` rather than a CSG fidelity mutation.

The same maintenance pass also exposed a weaker attribution gap: Blender/import work could be blamed chronologically without first proving that Lighting, Atmosphere, Sky and post effects changed.

### Cause

A class-applicability rule was generalized from `MeshPart` without checking the inheritance contract of `PartOperation`. The visual workflow also had strong one-variable capture guidance but no durable pre-import render-profile diff gate.

### Correction

- Correct both canonical skills: `RenderFidelity` applies to `MeshPart` and `PartOperation` descendants such as `UnionOperation`, but not to plain `Part` or `WedgePart`.
- Require live property inspection, actual camera-distance calculation and a treated/control comparison before any CSG fidelity change, especially in bulk.
- Add pre-import versus post-import render-profile comparison for Lighting, Atmosphere, all six Skybox IDs, fog and post effects.
- Add a distinct fixed-camera Atmosphere `Density` ladder for whole groups that converge toward the Sky hue with distance, separate from material-local and environment-specular trials.
- Update Photo Rig and Visual Asset Forge procedures so Sky removal remains diagnostic unless a new art direction is explicitly approved.

### Regression evidence

This was a procedural-content correction, not a change to skill purpose, activation, dependencies or routing phase, so no routing fixture change was required. Acceptance requires:

- the obsolete `RenderFidelity` exclusion to be absent from both canonical skill files;
- runtime Codex junctions to resolve to the corrected Git-tracked sources;
- `verify-skills.ps1` and Codex discovery checks to pass;
- the full MSSR routing suite and skill audit to remain green;
- the project-specific `roblox-distance-render-regression` guide to be selected for a positive distance-color task and not for an unrelated static writing task.

## MSSR-011 — Transversal debugging was domain-gated and capability gaps lacked an owner

**Date:** 2026-07-24

### Trigger

A real Roblox regression required `systematic-debugging` to work simultaneously with Roblox QA. The procedure itself was domain-neutral, but a structured intent containing only `domains=["roblox"]` did not select it. During the same maintenance pass, branch integration, stale generated docs, a test process that printed success but did not exit, a source/live version mismatch, and a product-context access boundary showed that no single skill owned recovery of missing tools, providers, permissions, verification paths or context handoffs.

### Observed failures

- `systematic-debugging` could be manually loaded and contained the correct procedure, yet MSSR excluded it outside its enumerated domains or when an explicit integrity/history need was absent.
- Extending domains alone risked opening debugging during nominal review and feature work because routing had action and need gates but no reusable anomaly-signal gate.
- Capability-chain continuations could re-plan, but there was no dedicated procedure for choosing between repairing routing, improving an existing skill, adding a script/tool/guide, creating a new skill, or changing product context.
- Maintenance knowledge about sibling branches, generated outputs, process lifecycle, release drift and context handoff was scattered across task transcripts rather than preserved as a reusable system.

### Root causes

- Transversal intent was represented as a finite domain allowlist instead of broad domain coverage plus observable anomaly gates.
- The routing contract lacked `requireSignalMatch`.
- Skill maintenance focused on procedural learning but did not map canonical repositories, execution support, generated artifacts, live-service gates or context adequacy.
- Capability discovery and provider refresh existed in MSSR, but recovery ownership and handoff format were implicit.

### Correction

- Added `requireSignalMatch` to the TypeScript metadata schema, JSON schema, audit output and deterministic scorer.
- Generalized `systematic-debugging` to every supported domain and to discovery, implementation and verification; it now requires both a matching debugging/recovery action and a matching non-nominal signal.
- Added `capability-gap-recovery` with explicit routing across domains and procedures for routing-gap, skill-gap, tool-gap, provider-gap, permission-gap, verification-gap and context-gap recovery.
- Expanded `skill-maintenance-loop` with a canonical system map, a catalog of generalized friction patterns and a cross-repository verification script that separates source checks from post-restart live checks.
- Updated governance and agent-routing procedures so debugging composes with narrow domain skills, capability gaps re-plan rather than retry blindly, and context switches carry a bounded verifiable handoff.

### Regression fixtures

- `systematic-debugging-any-domain-figma-anomaly`
- `systematic-debugging-any-domain-git-release-drift`
- `systematic-debugging-signal-gate-negative`
- `capability-gap-recovery-context-switch`
- `capability-gap-recovery-skill-route-repair`
- `capability-gap-recovery-continuation`
- `capability-gap-recovery-negative-nominal`

### Verification

The regression requires anomalous Figma, Git/release and Roblox cases to compose `systematic-debugging` with their domain routes; nominal Figma and coding work must exclude debugging and recovery. Capability/context and skill-routing gaps must activate `capability-gap-recovery`, while short continuation variants preserve the accepted handoff through bounded context.
## MSSR-012 — Git publication lacked a dedicated owner and ambiguous push results were unsafe

**Date:** 2026-07-24

### Trigger

A real cross-repository closure had to separate source and durable visual evidence, validate hundreds of staged files, publish focused commits and prove the remote state. The automatic all-file commit helper hit Windows `ENAMETOOLONG`; `git diff --cached --check` then found whitespace inside an archived source file; finally a normal push returned `cannot lock ref` while the remote branch had already advanced to the same local hash.

### Observed failures

- Git appeared only as a detail of Bridge collaboration or generic debugging; no owned skill governed mixed-worktree classification, commit partitioning, staged-index verification and remote publication as one reusable objective.
- A path-per-argument commit helper expanded hundreds of files and exceeded the process command-line limit even though staging the coherent directory was valid.
- A tool-level push error did not determine the final repository state: local `HEAD`, the tracking ref and the direct remote ref had to be inspected separately.
- The first routing draft used literal Git nouns such as `commit`, `stage` and `secret-scan` as public semantic tags, violating the intentionally small MSSR vocabulary.

### Root causes

- No general persistence owner existed between domain verification and skill maintenance.
- Publication success was implicitly inferred from command output instead of requiring readback from the direct remote ref.
- Large path sets lacked a durable recommendation to stage by semantic root, pathspec or manifest rather than expanding every filename.
- The route design initially mirrored command vocabulary instead of mapping onto MSSR capabilities.

### Correction

- Added `git-change-publication`, covering worktree classification, focused/reversible commit planning, bounded staging, staged gates, commit readback, multi-repository ordering, normal push and three-ref remote verification.
- Added a persistence/verification route and workflow gated by the existing `version-control` need.
- Required ambiguous push recovery to compare `git rev-parse HEAD`, the tracking ref and `git ls-remote` before retrying, forcing or declaring failure.
- Reused the existing semantic actions and needs (`coordinate`, `save`, `version`, `publish`, `verify`, `recover`, `version-control`, `integrity-verification`, `history-recovery`) rather than expanding the protocol with shell-command names.

### Regression fixtures

- `git-change-publication-focused-commits`
- `git-change-publication-push-race`
- `git-change-publication-continuation`
- `git-change-publication-negative-explanation`
- `git-change-publication-negative-unverified-implementation`

### Verification

The regression requires nominal commit/publication work to select `git-change-publication`; an ambiguous remote race must compose it with `systematic-debugging`; a short accepted continuation must preserve the route through bounded context; read-only conceptual Git questions and implementation explicitly not ready for commit must exclude the skill. Publication procedures must never infer remote success from `push` output alone or authorize blind force.

## MSSR-013 — Tool authoring lacked an owner and routing maintenance missed closed-vocabulary and deferred pollution

**Date:** 2026-07-24

### Trigger

A maintenance pass created a general Git publication skill, updated visual evidence rules, integrated MSSR fixtures and published multiple repositories. During the work, invalid command-shaped intent values were discovered only by the full Zod suite, a route passed its initial expectations while appearing as an irrelevant deferred skill elsewhere, and no skill owned the complete lifecycle for adding reusable MauroPrime Bridge tools. Bridge telemetry also confirmed repeated `ENAMETOOLONG` failures in Git helpers and synthetic test errors contaminating operational metrics.

### Observed failures

- Routing drafts used values such as `commit`, `stage`, `organize`, `explain`, `generated-output`, `evidence`, `secret-scan` and `conceptual-explanation`, none of which belong to the closed MSSR vocabulary.
- Positive and negative fixtures could pass while a new skill still polluted unrelated `activeSkills` or `deferredSkills`.
- A first Bridge-tool-authoring route used the broad `coding` domain and accidentally satisfied generic coding verification coverage.
- Shared needs such as `integrity-verification` and `cross-agent` could select Bridge-tool or visual-reference skills even when the actual artifact was a skill, repository or incident rather than an MCP tool or visual asset.
- A persistence workflow made `git-change-publication` active during verification because required skills can cover multiple phases.
- Short continuations inferred `cross-agent` rather than authoring-specific needs, so the accepted tool-authoring route was lost until the workflow matched action, MCP artifact and cross-agent context together.
- Tool creation knowledge was split between Bridge collaboration, skill maintenance and project rules; no owned skill covered schema, risk, handler, regression, generated docs, version, restart and live catalog verification as one objective.

### Root causes

- The canonical enums were present in TypeScript and tool schemas but lacked a small read-only preflight intended for routing authors.
- Regression expectations focused on named active selection more often than full active/deferred composition.
- Broad domains and common needs were treated as harmless, and the contract lacked an explicit gate requiring the target artifact itself to match.
- Phase-covering skills were added to workflows without checking how required persistence rules interact with verification or how broad start-stage continuations infer context.
- Repeated executable friction had not been separated from procedural guidance: Git argument-vector limits and metrics filtering required code, while tool-authoring decisions required a skill.

### Correction

- Added `skill_route_vocabulary`, exposing the canonical closed domains, actions, artifacts, needs, signals, risks, stages, phases and callers before routing edits.
- Added `mauroprime-bridge-tool-authoring` as the owner of Bridge tool design, schema, risk, implementation, regression, documentation, release and live verification.
- Added `requireArtifactMatch` to the TypeScript metadata contract, JSON schema, audit output and deterministic scorer, then applied it to Bridge tool authoring and visual-reference replication.
- Scoped the tool-authoring workflow to MCP artifacts, authoring actions, safe-editing/unit-test/cross-agent needs, active lifecycle stages and nominal signals.
- Added active and deferred negative expectations for existing-tool use, one-off commands, ordinary skill maintenance, OpenCode continuations and Roblox/MSSR incident recovery.
- Removed the broad `coding` route and premature Git requirement after regression runs exposed real overactivation.
- Updated maintenance guidance to inspect full active/deferred plans, validate vocabulary first and distinguish executable tool fixes from procedural skill fixes.

### Regression fixtures

- `bridge-tool-authoring-positive`
- `bridge-tool-authoring-verification`
- `bridge-tool-authoring-continuation`
- `bridge-tool-authoring-negative-existing-tool-use`
- `bridge-tool-authoring-negative-one-off-command`

### Verification

The routing suite must retain generic coding and skill-maintenance behavior, activate the new skill only for explicit MCP tool authoring and verification, preserve it through bounded short continuations, and exclude it from both active and deferred plans for existing-tool queries, one-off Git commands, OpenCode swarms and Roblox/MSSR incidents. `visual-reference-replication` must also stay out of nominal non-visual verification despite sharing `integrity-verification`. The live audit must report no unconfigured owned skills, missing descriptions, missing workflow references or cycles.

## MSSR-014 — Recommendation bypassed the structured router and activation had no outcome trace

**Date:** 2026-07-25

### Trigger

A review of the previous four days showed that formal `skill_route_plan` calls stopped after 2026-07-23 while `skill_recommend` and `skill_load` continued. A direct recommendation for mixed visual evidence ranked the exact `visual-evidence-cataloging` skill below broad maintenance/UI skills, and no durable record connected recommendation, load, verification and persisted outcome.

### Observed failures

- `skill_recommend` used a separate token-overlap scorer instead of the deterministic MSSR metadata, gates, dependencies and phases.
- A successful `skill_load` could not be correlated with the route that requested it.
- Existing Bridge tool telemetry showed tool names, timing and success, but not which skill was recommended or whether a result was verified/persisted.
- The broad `project/document + integrity-verification` metadata of `visual-evidence-cataloging` polluted a non-visual MSSR observability task.
- Reviewing prior chats lacked a reusable source-availability/provenance procedure.

### Correction

- Made `skill_recommend` a compatibility facade over `planSkillRoute`, accepting structured intent, context, caller, stage, completed phases and trace id.
- Added a privacy-preserving MSSR Observatory in Bridge with route, load and bounded checkpoint events; prompts/transcripts are excluded and tasks are stored only as SHA-256 fingerprints.
- Added `mssr_observatory_query` and `mssr_trace_record` plus trace-aware `skill_load`/`skill_bootstrap`.
- Added `conversation-history-review` and routing fixtures for positive, bounded continuation and current-only negative cases.
- Required a true visual artifact for `visual-evidence-cataloging`.
- Documented meaningful replan boundaries instead of routing between every low-level tool call.
- Added an explicit reviewed-oversize acknowledgement so size remains observable without blocking every suite after human review.

### Regression

- MSSR routing suite: 103 effective cases, including history-review positive/continuation/negative and visual-catalog exclusion.
- Bridge `test-v060-tools.mjs`: structured `skill_recommend`, stable trace id, traced skill load, verification checkpoint, trace query, privacy status and 122-tool registry.
- Full MSSR and Bridge verification remain required before publication and live restart.
