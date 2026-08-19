# ADR 0005 — Architecture Impact / Drift Links

Status: accepted through C2f-E (0.2.43): touch-time reverse mapping, non-widening structural refinement, sparse Markdown architecture anchors, host-neutral symbol analysis, reviewed structural baseline refinement, non-authoritative derived graph candidates, repository-declared executable architecture invariants, bounded architecture-context feedback, and metadata-only reviewed-current receipt semantics are implemented and focused-tested. Host persistence remains reconstructable runtime state and explicit maintenance remains the only writer of canonical architecture truth.

## Context

MSSR can already prove that delivered project knowledge is stale by comparing explicit revisions, but that does not answer a different question: when implementation changes, which architecture authority may deserve review?

Inferring architecture directly from arbitrary diffs, import graphs or model output would give heuristics too much authority. Conversely, loading every ADR on every change would be noisy and defeat selective context.

## Decision

Introduce an opt-in, repository-owned architecture relationship manifest at `.mssr/architecture-impact.json`, separate from `.mssr/project-context.json`.

Each v1 entry declares:

- `architectureId`: stable architecture identity;
- `authorityRef`: one canonical architecture authority file;
- `contextRef`: optional id already indexed by `.mssr/project-context.json`;
- `impactRefs`: bounded implementation files whose change may invalidate assumptions in that architecture.

The manifest itself is a **declared** relationship source. It does not contain an `inferred`/`learned` authority switch: graph/model candidates must remain outside this manifest until a deliberate reviewed write promotes them to a declared relation.

### Exact-only v1

C2f-A v1 accepts only normalized exact project-relative file paths using forward slashes. Absolute paths, traversal, backslashes, fragments and glob/pattern syntax are rejected.

This is deliberate. Glob semantics can be introduced only by a later explicit bounded contract with deterministic expansion rules and verification. They are not inferred from v1 strings.

### Meaning of a relation
<!-- mssr-arch-anchor: impact-relation-meaning -->

```text
declared impactRef changed
        ↓
possible architecture impact
        ↓
review may be warranted
```

A source revision change is **not** proof that architecture changed. It never authorizes MSSR, a host, or an agent to rewrite an ADR, project context, routing, skills, or source code.

### Project-context connection

`contextRef` is optional. When present it must resolve to an existing core/module id in `.mssr/project-context.json`. This gives later C2f-D a proven bounded context target without merging the two manifests or rerunning semantic retrieval.

`authorityRef` remains the architecture owner even when no `contextRef` exists.

## Ownership
<!-- mssr-arch-anchor: impact-ownership -->

- repository owners declare `architectureId -> authorityRef/contextRef/impactRefs`;
- hosts own filesystem/runtime observation of declared refs;
- portable MSSR owns normalization and later possible-impact projection;
- Operational Notice Plane remains the attention owner;
- Context Plane remains the context selection/loading owner;
- agents/humans explicitly review and maintain canonical architecture truth.

## C2f-A boundary

C2f-A provides only:

1. a strict versioned schema;
2. canonical `.mssr` manifest resolution;
3. duplicate/path bounds;
4. validation that optional `contextRef` is actually indexed;
5. portable read/parse helpers.

C2f-A does **not** read/hash `authorityRef` or `impactRefs`, compare revisions, generate source-set fingerprints, create review receipts, emit Situation observations/notices, load architecture context, or add another queue/watcher.

Those capabilities belong to C2f-B through C2f-E.

## C2f-B boundary

C2f-B adds a host-neutral observation contract without moving filesystem ownership into portable MSSR:

1. MSSR deterministically plans the exact `authorityRef` and `impactRefs` a host should inspect for each declared architecture.
2. The host returns one explicit metadata observation per planned ref: `available` with an opaque bounded `revision`, positively observed `missing`, or `unavailable` with an optional bounded reason code.
3. `available` requires a revision; `missing`/`unavailable` reject revisions. A host must return `unavailable` rather than omit a ref it could not inspect.
4. MSSR validates architecture/ref identity against the declared manifest, rejects extras/duplicates/omissions, and normalizes impact evidence back into manifest order so host iteration order cannot change semantics.
5. Portable evidence keeps `relationshipClass: declared` separate from `evidenceClass: observed`.
6. The normalized file states can be projected into bounded Situation observations per architecture: available -> `observed`, positively missing -> `unavailable`, inspection failure -> `unknown`. No architecture batch exceeds one authority plus its bounded impact refs.
7. Portable MSSR does not retry a failed host observer or synthesize evidence from exceptions.

C2f-B still does **not** compare current revisions to a reviewed baseline, compute a declared source-set fingerprint, classify `possible-impact`, emit an Operational Notice, request context, persist review receipts, or mutate architecture truth. Those semantics start in C2f-C. Host implementations may use SHA-256, Git object identities or another stable opaque revision, but the portable contract does not prescribe filesystem/hash I/O.

## C2f-C boundary

C2f-C adds a pure reviewed-baseline comparison contract over normalized C2f-B evidence:

1. A reviewed baseline can be created only after an explicit `reviewed=true` confirmation over fully comparable evidence. The canonical architecture authority must be `available`; implementation refs may be `available` or positively `missing`, but `unavailable` evidence cannot become a reviewed baseline.
2. The baseline is portable evidence only. C2f-C does not write it to disk, attach timestamps/identity claims, or make it canonical truth; host-local reviewed-current persistence remains C2f-E.
3. `declarationFingerprint` identifies the declared architecture relation. `sourceSetFingerprint` covers the ordered declared `impactRefs` and their comparable states/revisions. Architecture-authority revision stays a separate field so later C2f-E receipts can be keyed by authority revision plus source-set fingerprint without conflating the two.
4. Current evidence projects to exactly one status: `aligned`, `possible-impact`, or `unresolved`.
5. `aligned` requires the same declared relation, an available architecture authority at the reviewed revision, and the same comparable implementation source-set fingerprint.
6. A verified authority revision change, implementation revision change, or comparable availability transition yields `possible-impact` at operational level `review`. This means review may be warranted; it is never an `architectureChanged` claim.
7. A changed declared relationship, missing/unavailable architecture authority, or unavailable implementation evidence yields `unresolved` at operational level `review`. Uncertainty never fabricates a source change: unresolved implementation evidence receives no comparable current source-set fingerprint and no synthetic change record.
8. Every projection has a deterministic bounded SHA-256 semantic fingerprint suitable for later use with the existing Operational Notice transition evaluator. C2f-C itself emits no notice, owns no queue/watcher, requests no context, and persists no receipt.

C2f-D remains the owner of bounded `contextRef`/`authorityRef` feedback after review-worthy impact. C2f-E remains the owner of host-local reviewed-current receipts and explicit review correction. Only explicit maintenance may update an ADR, project context, source relation, or implementation.

## C2f-C.5 boundary — Architecture Impact Map / Structural Fingerprints
<!-- mssr-arch-anchor: impact-structural-map -->

C2f-C.5 refines the declared file-level relation before bounded context feedback. It does not replace `.mssr/architecture-impact.json`; that file remains the coarse reviewed authority for `architectureId -> authorityRef/contextRef/impactRefs`.

1. **Touch-time reverse lookup is pre-change awareness.** Given one or more exact project-relative refs an agent/host intends to edit, portable MSSR returns every declared architecture whose `authorityRef` or `impactRefs` match, including the exact `authorityRef` and optional `contextRef`. A shared file may return multiple architectures. No hash change is required to know what decisions surround an edit.
2. **Structural refinement is optional and cannot widen authority.** A separate optional `.mssr/architecture-structure.json` may name important Markdown anchors or implementation selectors for an already-declared architecture. It may only refine the existing `authorityRef`/`impactRefs`; it cannot introduce a new architecture or undeclared implementation file.
3. **Markdown anchors are sparse deliberate landmarks, not paragraph links.** Stable markers such as `<!-- mssr-arch-anchor: ownership -->` attach to selected headings. MSSR fingerprints the bounded section body, so unrelated sections and heading renames do not invalidate the anchored section while body changes do.
4. **Code-symbol analysis is split into portable declaration, host observation and comparison.** C2f-C.5-C1 (0.2.37) plans only selectors already reviewed into `.mssr/architecture-structure.json` and normalizes one explicit `observed`, `missing`, or `unavailable` result per selector. Evidence is bound to the host-observed `sourceRevision`; `analyzerId` names the implementation while `fingerprintScheme` separately names the canonicalization scheme, so outputs from different schemes are never assumed comparable. C2f-C.5-C2 (0.2.38) adds `analyzeArchitectureTypeScriptSource`: the host supplies source text/revision, while a dynamically loaded or injected TypeScript Compiler API performs no filesystem I/O. The reference scheme is conservatively keyed by the exact compiler version (`mssr-ts-symbol-v1:ts<version>`); scanner canonicalization ignores whitespace/comments and independently fingerprints callable signatures, executable bodies/initializers and structural shape. Missing symbols remain `missing`; parser absence, syntax failure and unsupported/ambiguous aspects remain explicit `unavailable`. TypeScript stays a dev/optional analyzer dependency rather than a mandatory MSSR runtime dependency. C2f-C.5-C3 (0.2.39) adds the reviewed structural baseline and refinement policy: the baseline is explicitly bound to the same coarse reviewed baseline, structure declaration and source revisions; only landmarks attached to refs that C2f-C already observed as changed are compared. Compatible unchanged fingerprints produce `noise-candidate`/WATCH while preserving coarse `possible-impact`; changed landmarks produce `structural-possible-impact`/REVIEW; changed structure declarations, stale/missing/unavailable evidence, availability transitions, refs without declared landmarks and fingerprint-scheme mismatch remain `unresolved`/REVIEW. C3 itself emits no notice, requests no context, persists no receipt and never claims architecture changed. Bridge-only AST/import/call tools may implement a host callback but never become portable authority.
5. **Derived graph links stay non-authoritative.** C2f-C.5-D (0.2.41) accepts bounded host-observed import/call/dependency edges only when the source is already a declared architecture ref. The target may be a nearby undeclared ref, but normalized output remains `relationshipClass=derived`, `promotionState=candidate`, and `canonicalReviewEligible=false`; it is navigation/review evidence only and cannot widen `.mssr/architecture-impact.json` or trigger canonical architecture review without a deliberate repository promotion.
6. **Executable invariants are a separate stronger declared signal.** Optional `.mssr/architecture-invariants.json` owns explicit `require-edge` / `forbid-edge` rules for an existing `architectureId`. Host graph evidence declares `complete` or `partial` coverage: an observed matching edge can prove presence immediately, but partial evidence never proves absence. Satisfied rules are OK, incomplete absence stays WATCH/unresolved, and verified violations become REVIEW/`invariant-violation`; every evaluation fixes `canonicalRewriteAllowed=false`, so even a proven violation cannot auto-rewrite architecture truth.

C2f-D therefore consumes a more precise map: it should load the smallest architecture note/ADR/context related to the touched or review-worthy structural surface, not merely react to an arbitrary whole-file hash difference.
## Consequences

- architecture impact becomes explicit and reviewable rather than reconstructed from prose;
- one implementation file may legitimately affect multiple architectures;
- absent `.mssr/architecture-impact.json` means the feature is not declared for that project;
- an empty manifest is valid but declares no relationships;
- inferred/import/call-graph relationships remain suggestions until deliberately reviewed into the manifest;
- later host observation can stay metadata-only because the semantic relationship is already declared by the repository.

## Verification gates

1. unknown fields fail strict parsing;
2. duplicate `architectureId` values fail;
3. duplicate `impactRefs` inside one architecture fail;
4. absolute/traversing/backslash/glob/fragment refs fail;
5. a shared implementation ref across different architectures is allowed;
6. declared `contextRef` must exist in `.mssr/project-context.json`;
7. missing architecture-impact manifest is a normal opt-out state;
8. C2f-A causes no source observation, drift classification, notice delivery or canonical mutation.
