# Reusable maintenance friction patterns

These patterns came from real cross-repository maintenance and should be recognized without overfitting to one project.

## Branch and integration

### Superseded sibling branches

Two branches may solve the same issue from the same base. Do not merge both because both pass independently.

Gate:

1. compare merge-base, unique commits and direct branch diff;
2. identify which branch is the later/superset design;
3. rescue isolated useful changes from the older branch separately;
4. merge or cherry-pick only the selected implementation;
5. delete temporary worktrees only after the chosen commit is preserved.

### Generated counters conflict during cherry-pick

Tool counts, generated docs and registry assertions often conflict because the target branch evolved. Preserve current capabilities, apply the new semantic rule, regenerate outputs from the final registry and update counts from evidence rather than either side of the conflict.

## Generated and accidental artifacts

### Stale generated documentation

A runtime registry can be correct while `TOOLS.md`, lockfiles, dashboards or manifests are stale. Regenerate from the canonical source, then run the corresponding `--check` gate. Do not hand-edit generated counts.

### Invalid YAML passes a regex-only verifier

A `SKILL.md` can contain `name` and `description` yet still be omitted by Codex when a plain YAML scalar includes an unquoted `: ` sequence. Validate frontmatter semantics, quote descriptions containing colon-space, and confirm discovery through the real Codex prompt; file existence and regex extraction are insufficient.

### Cache accidentally staged

`__pycache__`, `*.pyc`, logs, temporary captures and prompt dumps can enter broad commits. Before commit:

- inspect untracked files;
- scan for secrets;
- add durable ignore rules;
- remove generated artifacts from the index;
- amend before push when the mistake is detected immediately.

## Process lifecycle

### Test prints success but never exits

Successful assertions do not prove process completion. An open MCP client, socket, child process, timer or watcher can keep the test alive.

Gate:

1. distinguish completed assertions from terminated process;
2. inspect the remaining process tree or handles;
3. expose and call an explicit close/dispose function;
4. test both success and failure exits;
5. keep timeouts as a safety net, not the primary cleanup mechanism.

### Live service older than source

Source verification and live verification are separate. A source release may be `0.6.10` while the watchdog still serves `0.6.9`.

Order:

1. make version constants, package files, docs and regression expectations consistent;
2. pass source tests;
3. commit/push;
4. request the controlled restart;
5. verify live health, version and catalog after restart.

Do not change regression expectations merely to match a stale live process.

## Routing and skills

### Source skill exists but runtime junction was not installed

Creating a skill in its Git source does not by itself make it discoverable by Codex. Reserved MSSR names live under `D:\Dev\mssr\skills`; non-reserved custom names live under `D:\Dev\mauroprime-skills\skills`. The runtime catalog reads `C:\Users\mauro\.codex\skills\<name>`, which must be a junction to the one owning Git source.

Observable pattern:

```text
source SKILL.md exists
skill_load → "Codex skill not found"
install-junctions.ps1 creates the missing junction
skill_load succeeds without changing SKILL.md
```

Gate:

1. after creating, renaming or moving a skill, run `scripts\install-junctions.ps1` before the first runtime load;
2. verify the runtime path resolves to the exact Git source rather than an independent copy;
3. run `verify-skills.ps1` and the real Codex discovery test;
4. only then diagnose routing, cache or frontmatter when the skill remains missing;
5. record source creation, runtime installation and MSSR stabilization as separate lifecycle states.

File existence is source evidence, not runtime discovery evidence.


### Skill exists but does not compose in a domain

A transversal skill can contain correct prose yet fail routing because domains, artifacts, needs or gates exclude the real intent. Always test `skill_route_plan` with a structured real-world case, not only catalog discovery.

### Positive route without a nearby nominal negative

Broad domain lists can fix a false negative and create silent overactivation. Require an anomaly signal/action gate and a nominal negative fixture before calling the route stable.

### Capability exists but current product cannot use it

Distinguish installation from context availability. A plugin may be installed for Codex but not loaded in ChatGPT; a local file may exist but not be connected; a live application may be reachable only through its MCP. Use `capability-gap-recovery` and produce a context handoff instead of pretending access.

## Version and release

### Partial version bump

Updating `package.json` alone is incomplete when source constants, lockfiles, generated docs or regression scripts encode the version. Search all version-bearing files, update from one release decision and run a consistency test.

### Verification command mixes source and live gates

A full verifier may intentionally fail before restart because it probes the old live service. Separate source checks from post-restart checks and report which phase failed. The maintenance script should expose both modes.

## Tooling and evidence

### Policy or wrapper blocks a harmless command

A command wrapper can reject a safe query because of an overly broad pattern. Rephrase using dedicated tools or simpler commands, record the false positive and fix the policy only when the rule itself is wrong. Never weaken the boundary just to make one command pass.

### Exit code or mutation report overclaimed

`code=0`, `changed=true`, `HTTP 200`, `saved`, or `committed` proves only that one operation reported success. Read back the exact target, verify hashes/counts/state and test the user-facing path.

### Tests pass but the live target metric does not move

A candidate algorithm may pass synthetic regressions yet leave the real layout, performance metric or visible defect unchanged. Before publishing, declare the intended live delta, recapture the same state and classify the hypothesis as `accepted`, `rejected` or `inconclusive`. A zero-delta or perceptually worse candidate is rejected and reverted; useful tests or instrumentation may be preserved separately. Never describe a green unit suite as proof that the user-facing hypothesis worked.

### Metrics-only output mistaken for visual evidence

A capture command may emit valid JSON, rects and a future PNG path while the renderer returned an empty image or no decodable file. Classify structural metrics separately from visual validity. For spatial surfaces larger than a viewport, require a decoded full-envelope panorama with bounded margins for global visual claims; use editor screenshots only as complementary evidence for chrome, focus and Debugger state. A declared path is not pixel readback.

### Skill verifier disagrees with Codex discovery

A regex can find `name` and `description` while the YAML is still invalid. Windows paths inside double-quoted YAML are a common example because backslashes become escape sequences; Codex may omit the skill even when a superficial verifier reports success.

Gate:

1. parse every frontmatter block with a real YAML parser;
2. validate allowed keys, kebab-case name, non-empty description and folder/name equality;
3. run the Codex prompt discovery test after junction installation;
4. treat `local verifier green + Codex missing skill` as a parser-parity defect, not a cache assumption.

### Closed routing vocabulary discovered too late

Structured MSSR intent uses closed enums. Inventing command-shaped labels such as `commit`, `stage`, `organize`, `explain`, or `secret-scan` can make an otherwise coherent fixture fail only when the full Zod suite runs.

Gate:

1. call `skill_route_vocabulary` before editing routing JSON or fixtures;
2. map concrete commands to existing semantic capabilities such as `save`, `version`, `publish`, `review` or `integrity-verification`;
3. add a new vocabulary value only when it represents a reusable distinction across domains;
4. validate the smallest changed fixture before the full suite.

### Route passes but pollutes unrelated deferred plans

A route can satisfy every positive/negative assertion and still appear as an irrelevant active or deferred skill in neighboring workflows. Inspect both `activeSkills` and `deferredSkills`, not only the named expectation. When common needs such as `integrity-verification` or `cross-agent` overpower the real target, require the matching artifact with `requireArtifactMatch`; then narrow actions, stages, signals and workflow match, and add `activeExcludes` plus `deferredExcludes` to close observed semantic negatives.

### Argument-vector explosion

Expanding hundreds of paths into a child-process argv can fail with `ENAMETOOLONG` before Git or the target command starts. Use stdin pathspecs, bounded manifests or semantic roots. Add a real high-cardinality Windows regression; a small fixture cannot prove the limit is fixed.

### Synthetic telemetry contaminates operational diagnosis

Tests that deliberately record errors or slow calls can dominate real incident queries. Prefix synthetic tools with `__test_`, keep legacy exclusions for old fixture names and filter operational summary/recent/errors/slowest views. Raw all-events access may remain a separate explicit diagnostic mode.

### Exact replacement patch is fragile

`apply_patch` can fail on mixed EOL, duplicate blocks or a file changed since inspection. Read exact lines first; use exact replacement for a unique stable block and `edit_lines` for repeated or line-oriented edits. Never broaden replacement scope simply because the first exact patch found zero or multiple matches.

### Verification amplification and unreadable output

A maintenance loop may rebuild the same repository several times and print every routing case, making real warnings difficult to see. Prefer one authoritative full gate per layer, focused checks before it, compact success summaries and verbose case output only on failure or explicit request. Long duration alone is not failure, but it should produce one grouped slow-call notice rather than burying the result.


### Declared visual metadata reused without byte readback

A manifest may claim a provider-requested size, keep `sha256=null`, or describe an old derivative while the saved file is smaller or different. Copying those fields into a downstream bundle creates false provenance and may turn a preview into a modeling master.

Observable pattern:

```text
manifest metadata exists or is partially null
bundle builder copies it unchanged
actual image is never opened
saved width/height/bytes/hash remain unproved or contradictory
```

Gate:

1. resolve every local image path relative to its owning manifest;
2. read the actual file signature, dimensions, byte count and SHA-256;
3. preserve declared metadata separately and record mismatches;
4. fail closed on missing referenced masters unless an explicit degraded mode is requested;
5. never promote requested dimensions, filenames or dashboard roles over measured bytes;
6. invalidate downstream modeling context when a source hash changes.

Metadata describes intent; byte readback proves the artifact.

### Final image payload available but a preview becomes the master

A generation surface may expose progressive/partial images, chat previews, library thumbnails, downloaded derivatives and one final completed payload. Saving the easiest visible surface can preserve only a small preview even though a better source existed.

Gate:

1. identify the provider's final/completed event or original-save path before persistence;
2. save that payload directly and preserve it before dashboard derivation;
3. reject partial streaming frames, screenshots, browser previews and contact sheets as masters;
4. classify `master`, `review`, `thumb` and `cover` as separate roles with parent lineage;
5. run `visual-reference-integrity` and require measured dimensions, bytes and SHA-256;
6. keep a low-resolution legacy file as `design-reference-only` instead of silently upgrading or deleting it;
7. add a provider compatibility module when event names, supported sizes or output formats can change.

### Integrity incident repeats but skills must not self-edit

Repeated errors justify maintenance, not unsupervised instruction mutation. Metrics and incident records can produce a bounded proposal, but source changes require a visible task with owner review, snapshot, diff, regression tests, routing verification and Git publication.

Use `skill-maintenance-loop/scripts/build_change_proposal.py` to choose the smallest candidate change. The report must state `automaticMutationPerformed=false`.

### Empty digest or observed friction bypasses a learning decision

A zero-finding audit can be silently discarded, while a workaround recorded outside the finding list can disappear before ownership is reviewed. The inverse failure is also unsafe: a measured candidate can be promoted from a digest alone without a holdout, calibration, shadow exposure, or a reversible release boundary.

Gate:

1. record `findings=0` explicitly with evidence, or declare the count unsupported; do not treat absence of a field as zero;
2. require every observed friction item to receive a proposal or `insufficient-evidence` decision;
3. when the host has evidence for an optional decision, require its explicit `reasonCode` and references; record unavailable or unknown evidence without inventing a reason;
4. keep the proposal `observe-only` and `routingInfluence=false` until dataset audit, replay/holdout, calibration, shadow, and feature-flag/rollback are each `passed` with durable references;
5. after all gates, allow only a visible human-review request with a bounded rollback; source, routing and runtime changes still require a separate approved maintenance task.



## Hierarchical target identity and bounded mutation

### Visible content expands scope to the wrong container

A request may identify an object by what is visible on it or where it appears: “the mushrooms”, “the cards under the camera”, “that row beside the platform”. Those clues locate candidates but do not authorize their parent, siblings, support surface, factory, archive, or runtime copies.

Gate:

1. convert the request into exact `targets`, `protected`, `expectedAbsent`, and `unknown` sets;
2. resolve targets by path, class, parent, purpose attributes, identity, bounds and owner;
3. inspect the nearest parent/child/sibling/spatial alternatives explicitly;
4. require `unknown` to be empty before a destructive mutation;
5. never broaden to a common ancestor merely because several visible descendants match.

### Protected list treated as commentary instead of a postcondition

A workflow can remove the requested candidate successfully while silently losing another required root. “Do not touch X” is not enforced until X is fingerprinted at baseline and asserted after every mutation and across relevant runtime/persistence layers.

Gate:

1. make protected entries required invariants with identity and structural fingerprints;
2. fail when a protected entry is missing at baseline, even if the current operation did not cause it;
3. compare the complete protected set after each write, not only at the end;
4. report intended protection separately from observed presence;
5. do not close on candidate absence alone.

### Broad rollback or stale reconstruction used for subtree recovery

Restoring a whole document, scene, database, or place from an older backup can recover one object while overwriting unrelated newer work. Rebuilding from an older generator can also preserve appearance while losing current metadata, children or behavior.

Gate:

1. prefer reparenting the exact archived object;
2. otherwise extract only the exact subtree or record from the matching last-known-good version;
3. compare version, identity, hierarchy, properties, bounds and dependent references before installation;
4. keep the current artifact as authority and apply the smallest recoverable delta;
5. verify no unrelated state changed and preserve a rollback of the current version.

### Auxiliary application becomes an accidental second authority

Opening a backup or comparison artifact in a second editor instance is useful for inspection but creates ambiguous ownership. A tool may inspect one instance and save or mutate another.

Gate:

1. identify every open instance by exact file/project path and role;
2. designate one canonical writable authority;
3. keep auxiliary instances read-only;
4. close auxiliaries before mutation or persistence;
5. verify the target identity again immediately before the write and save.


## Cross-project catalogs and approval evidence

### Derived catalog becomes an accidental source authority

A dashboard, index, library or normalized manifest can make many projects easier to browse without becoming the owner of their canonical source files. Copying source models/runtime artifacts into the catalog or editing a provider while still operating under the catalog's workflow creates split authority and ambiguous persistence.

Gate:

1. name the authoritative provider project before any mutation;
2. keep the catalog owner limited to adapters, normalized metadata, derived presentation evidence and navigation;
3. treat provider repositories as read-only while the catalog workflow is active;
4. hand actual source edits back to the provider's own context/workflow;
5. refresh the catalog only from durably persisted provider evidence after provider verification.

### Validated snapshot silently rewritten to match the current working source

A provider may have a previously validated hash while its live working source has since changed. Replacing the declared validated hash with the current hash makes drift disappear instead of representing it.

Gate:

1. preserve `validated/expected` and `current/measured` evidence as separate fields;
2. when bytes or hashes differ, report source drift explicitly and block claims that the current source is still the validated snapshot;
3. never rewrite expected evidence merely to make a verifier green;
4. clear drift only after the provider creates new durable validation for the current source;
5. keep permissions and historical approvals distinguishable from current-source integrity.

### Technical validation mistaken for human approval or downstream authorization

Automated checks can prove geometry, schema, hashes or import integrity without proving that a person accepted the visual result or authorized the next production phase.

Gate:

1. model technical validation, human approval and downstream authorization as separate states;
2. `PASS` never implies `approved` unless the provider contract explicitly says so;
3. preserve blocked export/runtime/integration flags even when all technical checks pass;
4. require durable provider evidence before promoting a human gate;
5. surface the distinction in dashboards and handoffs so agents do not infer permission from quality metrics.

### Provider schema guessed from neighboring examples

Adapters often fail when an agent assumes field names from another manifest or from an earlier revision instead of reading the actual durable provider schema/data. A close semantic guess such as `godotIntegration` versus `godot`, or `pass` versus `passed`, can silently weaken a gate when fallback logic is permissive.

Gate:

1. inspect the exact provider JSON/schema before implementing an adapter;
2. prefer structured fields over filename or lexical inference;
3. fail closed when a required approval/integrity field is absent or ambiguous;
4. add parser fixtures for the observed provider shape and one nearby incompatible shape;
5. treat schema mismatch as replan/debug evidence, not as permission to relax the contract.

## Close checklist

- original failure reproduced or historical limitation stated;
- root cause separated from contributor and tooling artifact;
- skill/tool/routing owner identified;
- generated outputs refreshed;
- positive, negative and continuation fixtures pass;
- process exits cleanly;
- source and live version gates are distinguished;
- no cache, secrets or temporary evidence staged;
- commits and pushes confirmed per repository;
- context handoff recorded when another product must continue.
