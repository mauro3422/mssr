# Run procedure erratum

The intended pre-call checksum command failed before writing
`PRECALL-SHA256SUMS`: it attempted to hash `dry-run-report.json`, but the custom
runner prints its dry-run summary to stdout and does not persist that file.
The PowerShell commands were separated so the later `--allow-network` process
still ran after the checksum command failed. This was an orchestration error.

Before the provider calls, `run-study.mjs` did verify the frozen hashes in
`run-identity.json`, including the runner, plan, source snapshot, expected
rubric, MSSR selector/retrieval/evidence-pack dist, Bridge adapter source/dist,
and build receipt. It also checked both Git commit identities and the isolated
Bridge worktree cleanliness. However, no pre-call checksum manifest was
written, so post-run `SHA256SUMS` is integrity evidence for the preserved files,
not proof that those files were hashed before execution. The completion record
binds the manifest hash after execution; it does not repair this procedural
gap.

The run directory/id uses the planned suffix `162500Z`, while the actual
manifest was frozen at `2026-10-11T16:21:26.712Z` and the calls finished at
`2026-10-11T16:21:37.676Z`. The suffix was assigned in advance and is not the
execution timestamp; use the manifest and completion timestamps as authority.

The two provider responses and exact fetches completed and passed their
fingerprint checks. The composed receipt replay subsequently validated those
records with zero additional Jev calls. No production Bridge process or
catalog was touched. Treat this run as useful exploratory evidence with weaker
pre-call archival controls; do not silently relabel it as fully pre-call
checksummed. Future commands must stop on checksum failure before any live
provider invocation, and the dry-run report should be persisted before freeze.
