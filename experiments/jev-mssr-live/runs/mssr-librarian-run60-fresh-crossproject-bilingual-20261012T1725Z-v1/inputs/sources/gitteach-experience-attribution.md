# Experience attribution in an AI-assisted software world

GitTeach must distinguish what exists in a repository from what a project appears to do and from what can reasonably be attributed to a person.

## The four evidence layers

### 1. Repository facts — deterministic

Examples:

- languages and file counts;
- manifests and dependency/framework signals;
- tests, docs and tooling files;
- Git branch/head/recency facts;
- exact hashes, paths and bounded excerpts;
- build/lint/typecheck/test results when captured as verification evidence.

These facts do not require Jev. `RepoEvidenceBundle v1` is the authority for them.

A repository containing Rust proves that the repository contains Rust. It does not prove that a particular developer wrote the Rust, designed the Rust subsystem, or has a particular proficiency level.

### 2. Project semantics — bounded semantic interpretation

Examples:

- a component implements selective invalidation;
- the project contains an editor-kernel architecture;
- a subsystem is acting as a provider boundary;
- a workflow is a migration, cache, audit, benchmark, or recovery mechanism.

Jev may judge these only against bounded evidence and explicit candidate semantics. Jev is not needed to rediscover deterministic language/manifests facts and it must not infer developer authorship, seniority or expertise.

Jev confidence means support for a bounded semantic statement from supplied evidence. It is not a skill score or quality score.

### 3. Actor linkage — who is connected to the work

Actor linkage is separate from project semantics.

Current attribution classes:

- `repository-only`: no evidence connects the observation to the developer;
- `identity-linked`: Git/review identity is associated with the change, but manual authorship is not established;
- `agency-supported`: evidence shows a decision, direction, review, debug/test/maintenance action or other observable agency;
- `user-confirmed`: the developer explicitly confirms involvement; useful as declared evidence but weaker than observable agency when both exist.

Known actor relations:

- identity: `authored-change`, `coauthored-change`;
- agency: `reviewed-change`, `decision-record`, `design-session`, `debug-session`, `test-session`, `maintenance-session`, `agent-direction`;
- declaration: `manual-confirmation`.

A Git-authored commit is deliberately only `identity-linked`. It must never silently become “the developer manually wrote this implementation.”

### 4. Experience claims — facts/semantics plus actor evidence

A professional claim is personal only after project evidence is combined with actor evidence.

Examples of safer output:

- repository only: “The project uses Rust and Tauri.”
- identity linked: “Contributed to a project using Rust and Tauri.”
- agency supported: “Directed AI-assisted work on the Rust/Tauri integration.”
- debug evidence: “Debugged the editor-kernel scrolling path and validated the regression fix.”
- design evidence: “Made or recorded design decisions for selective cache invalidation.”
- review evidence: “Reviewed generated changes and required corrections before validation passed.”

The system should prefer verbs that describe observable activity instead of generic “knows X” language.

## Implementation origin

Personal attribution and implementation origin are orthogonal.

Supported origin labels:

- `human`;
- `ai-assisted`;
- `mixed`;
- `unknown`.

AI assistance is not a negative signal and should not be hidden. The relevant question is what agency the developer exercised: defining intent, setting constraints, evaluating alternatives, finding failures, correcting the agent, reviewing output, validating behavior and maintaining the result.

`authored-change` without stronger evidence defaults to origin `unknown` rather than `human`.

## What GitTeach can audit about engineering quality

GitTeach should avoid unsupported global labels such as “high-quality developer” or “excellent architecture.” Instead it can preserve concrete quality evidence.

Deterministic or directly observed quality signals include:

- tests added and tests passing;
- typecheck/lint/clippy/static-analysis gates;
- before/after benchmark evidence;
- regressions reproduced and closed;
- crash/error reductions when a comparable measurement exists;
- dependency/security findings and their remediation;
- review cycles and requested corrections;
- migration completion with compatibility tests;
- repeated maintenance of the same subsystem over time.

Semantic interpretation may describe the engineering pattern that evidence supports, but it does not transform those signals into an opaque quality score.

Examples:

- valid: “Introduced selective invalidation and verified that an unrelated change does not invalidate the existing capability.”
- invalid without more evidence: “Designed a superior cache architecture.”
- valid with before/after measurements: “Reduced the bounded Jev context from 24 to 12 evidence records while preserving the tested positive/negative behavior.”

## What should count as experience when AI writes much of the code

GitTeach should treat experience as an evidence graph, not as lines typed.

Useful dimensions are:

1. **Exposure** — the person was linked to work involving a technology/domain.
2. **Agency** — the person directed, decided, reviewed, debugged, tested, maintained or corrected work.
3. **Persistence** — the person returned to the subsystem across time and changing states.
4. **Breadth of evidence** — design, tests, source, docs, review and runtime evidence converge on the same experience claim.
5. **Outcomes** — observable gates or before/after results exist.
6. **Explanation lineage** — GitTeach can answer why it believes the claim and resolve the exact evidence.

These dimensions should remain descriptive. They must not be collapsed into a seniority or “skill percentage” score.

## What GitTeach can still learn without agent telemetry

A normal GitTeach user may have no Bridge/MSSR/agent receipts at all. The product must still build a useful profile from repositories and GitHub behavior.

Useful observable patterns include:

- repeated test/regression coverage after feature work;
- bug-fix, revert and rework loops;
- CI/typecheck/lint/static-analysis gates appearing across projects;
- migrations paired with compatibility checks;
- benchmark/performance work with before/after evidence;
- releases followed by fixes/maintenance;
- repeated automation scripts replacing manual steps;
- documentation/changelog/ADR habits;
- long-running maintenance of the same projects;
- PR/review/issue participation and collaboration patterns;
- recurring project domains and tool-building behavior.

These patterns describe **how projects are carried forward**, not who typed the implementation. They are therefore useful in AI-heavy development without requiring GitTeach to guess a `human-written percentage`.

GitTeach may summarize repeated cross-project patterns as development tendencies, for example `automation-oriented`, `testing/verification-oriented`, `tool-building`, `documentation-oriented`, `observability-oriented`, `maintenance-oriented` or `rapid experimentation`. A tendency needs repeated support across independent evidence/projects and remains descriptive rather than a quality or seniority score.

See `AI_ERA_PROFILE_MODEL.md` for the broader profile model and WidgetForge-facing statistics.
## Evidence-source status

### Git identity adapter — implemented

Configured local Git identities can establish `identity-linked` contribution. They never infer manual code authorship.

### GitHub PR / review facts — implemented

`giteach-github-repository-facts-v1` keeps Releases, PRs, reviews and issues as deterministic source facts with exact refs. An authored PR for the connected login may become identity-linked `authored-change`; only a submitted non-PENDING review may become `reviewed-change` agency. Pending reviews, authored issues and Releases remain facts and do not fabricate engineering agency.

### Design/ADR adapter

Can produce `decision-record` or `design-session` evidence when a decision artifact is attributable to the developer.

### Test/debug/maintenance sessions

Can produce agency evidence when a trace proves that the developer drove reproduction, diagnosis, validation or maintenance work.

### Optional agent workflow adapter

External agent systems may eventually emit privacy-bounded receipts when a user chooses to connect them. Bridge/MSSR-like systems are examples, not product requirements:

- task intent supplied by the user;
- constraints/corrections supplied by the user;
- generated change sets;
- rejected/retried attempts;
- verification gates requested and passed;
- accepted final outcome.

GitTeach should import bounded receipts, not raw private prompts by default. A receipt can prove orchestration/decision/review activity without pretending that the user manually typed the resulting code.

### Manual confirmation

Useful for filling gaps, but must remain visibly self-reported and must not override contradictory repository/runtime evidence.

## Publication rules

Personal surfaces (`github-profile-readme`, `portfolio-card`, `linkedin-project`, `linkedin-skills`, `cv-evidence`) omit `repository-only` claims.

Project surfaces may include repository-only facts/semantics, but wording must explicitly remain project-scoped.

`identity-linked` claims may be presented as contribution, never manual authorship.

`agency-supported` claims may use the specific supported action verb: directed, designed/decided, reviewed, debugged, tested/validated or maintained.

AI-assisted/mixed provenance remains visible when present.

## Current architectural direction

```text
Repo/Git/filesystem
  -> RepoEvidenceBundle v1
     -> deterministic repository facts -------------------+
     -> bounded evidence -> Jev project semantics --------+--> attribution/experience aggregation
                                                            |
Actor evidence sources ------------------------------------+
  -> identity links
  -> decisions/direction
  -> reviews
  -> debug/test/maintenance
  -> user confirmations

attribution/experience aggregation
  -> DeveloperProfile v1
  -> DocumentInput v1 publication firewall
  -> personal/project renderers with different wording rules
```

The long-term differentiator is not “GitHub language statistics with AI labels.” It is an auditable explanation of what the project contains, what the work meant, and what the developer actually did around it.
