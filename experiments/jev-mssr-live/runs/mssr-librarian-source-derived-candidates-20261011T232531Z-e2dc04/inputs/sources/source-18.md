# ADR 0004 — Situation Model for project knowledge

Status: accepted through MSSR 0.2.28 C2e-E; Bridge 0.6.105 completed the C2e-C consuming-host watcher adoption, while later MSSR package adoption remains a separate host gate.

## Context

MSSR already had several correct but separate views of project reality:

- Context Plane selects PROJECT_CONTEXT, PROJECT_MEMORY, PROJECT_STATE, ADRs, incidents, changelogs and bounded receipts;
- Context freshness tells whether a referenced source is still available/current by its own observation contract;
- C2c compares explicit semantic values/revisions across canonical, replica and historical observers;
- C2d orders advisory recovery actions from that diagnosis;
- the Operational Notice Plane decides when a state transition deserves agent attention.

The missing contract was the bridge between project knowledge and C2c/C2d. A host could collect a memory or changelog and could separately run a consistency comparison, but there was no portable Situation Model saying which bounded pieces of project knowledge were delivered, which owner is current, and how to compare them without interpreting arbitrary prose.

## Decision

Introduce a portable **Situation Model** as an evidence/claim normalization layer upstream of C2c.

```text
repository/docs/runtime/test evidence
             ↓
       Situation Model
 bounded observations + provenance
             ↓
            C2c
     consistency diagnosis
             ↓
            C2d
 evidence-first recommendation plan
             ↓
 Operational Notice Plane
 classified advisory attention
             ↓
 ChatGPT Web / Codex / OpenCode / other host
```

### Evidence classes

Situation observations explicitly distinguish:

1. `observed` — directly measured machine evidence such as file revision/hash, test/runtime state;
2. `declared` — bounded claims/receipts intentionally declared by a repository or host;
3. `inferred` — a derived hypothesis, never a canonical authority;
4. `learned` — historical/calibrated evidence, never a canonical authority.

The ordering `OBSERVED > DECLARED > INFERRED > LEARNED` is a reliability prior, **not an ownership override**. A canonical repository declaration can remain the semantic owner even when a runtime observer is mechanically stronger evidence about runtime state. Evidence class and authority are orthogonal.

`inferred` and `learned` observations are forbidden from declaring `authority=canonical`.

### Revision-first project knowledge

C2e does not parse arbitrary free-form PROJECT_MEMORY/ADR prose into truth claims.

The first reliable project-knowledge contract compares source revisions:

- current repository observation: canonical owner at revision/hash `Y`;
- selected Context Message or delivery receipt: evidence previously delivered at revision/hash `X`.

If `X != Y`, MSSR can prove that the delivered context is stale without guessing what the prose means. It may recommend revalidation/reload through C2d; it never rewrites the document.
For each canonical owner/ref, historical operating context is reduced to the newest delivered receipt; evidence selected in the current context load supersedes older receipts immediately. This preserves audit history in the inbox while preventing obsolete receipts from keeping a resolved mismatch open forever.

Semantic value claims may be added later only through bounded explicit contracts or contract-defined extractors. Free-form model interpretation cannot silently become canonical project truth.

### Explicit semantic claim producers

C2e-D adds a separate strict producer contract for selected facts that are already structured by a repository or host. It does **not** parse document prose. The initial claim kinds are `release-version`, `state-value`, `ownership`, and `decision-revision`; each claim names a bounded semantic `subject`, a closed source kind, source reference, authority, observation state, and exactly one comparable scalar `value` or `revision` according to the claim kind.

Source kind deterministically maps to the existing C2c `role`, Situation `category`, and `observed` versus `declared` evidence class. PROJECT_CONTEXT/MEMORY/STATE, changelog, and ADR sources are declarations; source/generated/installed/manifest/Git/runtime/test/verification/provider sources are machine observations. Authority remains explicit and orthogonal: the producer cannot decide that a source is canonical merely because its evidence is mechanically observed.

The producer emits ordinary `MssrSituationObservation` objects and stops there. C2c remains the sole consistency owner, C2d remains the recommendation owner, and the Operational Notice Plane remains the attention owner. A host may therefore compare structured runtime release state against structured PROJECT_STATE, or an ADR ownership declaration against a bounded memory declaration, without creating another contradiction engine or allowing arbitrary text extraction to become truth.

### Situation-to-context feedback

C2e-E converts only **already active** Situation attention into bounded advisory context requests. It does not rerun semantic retrieval, load files, mutate an authority, or promote a C2d recommendation into execution. The projection consumes C2c/C2d mismatch keys plus ready context-oriented actions (`load-canonical-authority`, `inspect-canonical-authorities`, `revalidate-context-evidence`), finds the canonical Situation observation for each key, and uses that observation's explicit `sourceRef` as the only authority locator.

When `.mssr/project-context.json` maps that canonical source to exactly one core/module entry, the request may name that exact entry together with its existing source sections/topic/area and bounded `maxChars`; the normal Context Plane remains responsible for whether/how it is loaded. A `sourceRef` selector such as `.mssr/PROJECT_STATE.md#current-release` may disambiguate entries sharing one authority file by matching the manifest section heading. Without an explicit selector, multiple entries for the same file remain `ambiguous-authority` and MSSR requests only the canonical authority rather than guessing a module. Unindexed sources likewise remain authority-only, while missing canonical source identity yields an explicit unresolved/abstention result.

This preserves the intended small-agent/large-agent handoff: a watcher or maintenance agent can say which bounded authority is stale and which exact indexed module is sufficient when that mapping is proven, but the consuming host still chooses whether to load it under existing Context Plane budgets and permissions.

### Notice classification

C2e reuses existing Operational Notice levels (`ok < watch < review < error`). It does not add a competing severity ladder.

Situation metadata adds orthogonal routing fields:

- category such as `project-context`, `project-memory`, `project-state`, `changelog`, `architecture`, `runtime`, `provider`, `verification`;
- notice class such as `context-refresh`, `release-integrity`, `runtime-integrity`, `consistency`;
- bounded priority for ordering within the existing attention model.

Bridge/other hosts may map those fields to their existing notice transport, but cannot create a second MSSR queue or promote a deferred C2d action to immediate execution.

## Ownership

- repository/project owners own canonical project facts and documents;
- MSSR owns portable evidence/claim normalization, C2c diagnosis, C2d recommendation semantics and host-neutral attention classification;
- hosts/providers own observation I/O and delivery;
- agents/humans decide whether to execute recommendations;
- telemetry/learned evidence cannot authorize or silently mutate project truth.

## Consequences

- a smaller maintenance agent can leave bounded delivery receipts and current project metadata that a later larger agent can validate/reuse;
- stale context can be detected cross-host without storing raw conversations;
- project knowledge and runtime evidence become queryable through one situation vocabulary while retaining distinct authorities;
- future learned recommendation calibration can use explicit evidence classes rather than treating all metadata equally;
- context-budget pressure can trigger targeted evidence reload instead of wholesale document loading.

## Verification gates

1. inferred/learned evidence cannot be canonical;
2. historical PROJECT_MEMORY revision differing from current canonical revision yields REVIEW and evidence revalidation first;
3. matching revision remains OK;
4. missing canonical baseline produces investigation/abstention semantics rather than invented truth;
5. Situation Model preserves C2c/C2d no-authority/no-auto-execution guarantees;
6. Context Plane host returns Situation Model output without changing existing context selection semantics;
7. consuming-host watcher adoption reuses the existing Notice Plane and proves stable-state suppression/resolution separately; Bridge 0.6.105 satisfies this gate.
8. semantic claim producers accept only closed claim/source kinds plus bounded identifiers/scalars; they never receive or interpret arbitrary prose blocks.
9. `release-version`, `state-value`, and `ownership` require an explicit scalar `value`; `decision-revision` requires an explicit `revision`; unknown/unavailable evidence cannot carry an invented comparable payload.
10. producer output is ordinary Situation evidence, so existing C2c/C2d mismatch, lifecycle escalation, abstention, advisory-only and no-auto-execution invariants remain authoritative.
11. Situation-to-context feedback consumes only mismatch keys and ready context actions already produced by C2c/C2d; it does not rerun semantic retrieval or execute a load.
12. an exact project-context entry is returned only when the canonical `sourceRef` maps uniquely, optionally through an explicit section selector; otherwise the request remains authority-only or unresolved.
13. multiple manifest modules sharing an authority file are never guessed from filename alone.
14. the Context Plane host may expose feedback alongside Situation output, but its existing selection/budget/permission semantics remain unchanged and the suggested module is not automatically loaded.
