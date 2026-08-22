# Integration and release friction

Read when repository, project, document or MCP maintenance reaches integration, generated-output, lifecycle, version or publication failures.

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

## Version and release

### Partial version bump

Updating `package.json` alone is incomplete when source constants, lockfiles, generated docs or regression scripts encode the version. Search all version-bearing files, update from one release decision and run a consistency test.

### Verification command mixes source and live gates

A full verifier may intentionally fail before restart because it probes the old live service. Separate source checks from post-restart checks and report which phase failed. The maintenance script should expose both modes.
