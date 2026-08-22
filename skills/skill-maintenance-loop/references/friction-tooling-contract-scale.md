# Tooling, contract and scale friction

Read when code, MCP or skill maintenance fails at a wrapper, schema, vocabulary, process boundary, high-cardinality input, telemetry filter or exact patch.

## Tooling and evidence

### Policy or wrapper blocks a harmless command

A command wrapper can reject a safe query because of an overly broad pattern. Rephrase using dedicated tools or simpler commands, record the false positive and fix the policy only when the rule itself is wrong. Never weaken the boundary just to make one command pass.

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
