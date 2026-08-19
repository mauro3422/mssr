# Operational pattern automation

- **Type:** maintenance recipe
- **Owner:** skill-maintenance-loop
- **Read when:** the same deterministic multi-step operational sequence, verification ceremony, or manual bookkeeping appears repeatedly across traces/releases.
- **Signals:** `repeated-friction`, `manual-workaround`, `reusable-pattern`
- **Status:** active

## Goal

Turn repeated mechanical orchestration into the smallest deterministic script/tool/workflow primitive instead of teaching every agent to replay the ceremony manually. Automate mechanics; never automate authority, approval, semantic truth, or irreversible publication merely because a pattern repeated.

## Promotion gate

Treat a sequence as an automation candidate when evidence shows at least two materially equivalent repetitions, or one high-impact repeated correction with a stable cause, and all of the following are explicit:

1. stable inputs and outputs;
2. deterministic ordering or dependency constraints;
3. objective success/failure evidence;
4. a bounded safety/authority boundary;
5. rollback or fail-closed behavior for partial completion;
6. an existing owner for the resulting script/tool/guide.

If the sequence still depends on architectural judgment, human approval, ambiguous intent, or project truth interpretation, automate only the mechanical substeps and leave the decision as an explicit reviewed gate.

## Decision rule

Prefer, in order:

1. extend an existing owner script/tool when the primitive already exists;
2. add a small deterministic script when the repeated work is repository-local mechanics;
3. add a host-neutral contract plus host adapters when multiple hosts need the same semantics but different I/O;
4. add a workflow guide only when orchestration remains procedural and cannot be encoded safely as a deterministic primitive;
5. create a new skill only when the objective itself is independently reusable.

Do not create a duplicate skill or guide when `skill-maintenance-loop` already owns the maintenance decision.

## Evidence receipt

The automation should emit one bounded machine-readable receipt rather than forcing the agent to copy evidence between steps. Keep canonical values complete in the receipt and allow compact display aliases for conversation/UI.

For artifact hashes, persist the complete digest, for example:

```json
{
  "artifact": "mauroprime-mssr-0.2.39.tgz",
  "bytes": 530000,
  "sha256": "<full-64-hex-digest>",
  "verify": "pass"
}
```

An agent/UI may display `pkg:0.2.39#<first-8>` as a convenience alias, but the alias is never integrity evidence and must resolve back to the full receipt when verification matters.

## First proving case: MSSR release ceremony

Observed repeated sequence:

```text
verify
→ package candidate
→ read bytes/hash
→ update release authorities/changelog
→ package final
→ read bytes/hash again
→ Project Context Health / consistency
→ trace persist
→ close replan
→ maintenance
→ outcome
```

Target simplification:

```text
verify source
→ close reviewed release metadata
→ generate one final package
→ emit release receipt (full hash/bytes/version/tests)
→ PROJECT_STATE records receipt identity
→ consistency/trace close consumes the receipt
```

`PROJECT_STATE` is outside the npm package, so recording the final package digest there must not force another package cycle. MSSR 0.2.40 implements this proving case as `npm run release:gate`: the script validates already-reviewed release metadata, runs full verification, creates one final package, independently reads bytes/SHA-256, and writes a bounded runtime receipt. It does not decide that PROJECT_CONTEXT/MEMORY/STATE are `updated` vs `reviewed-none`; those remain reviewed authority decisions supplied before the gate.

## Learning boundary

Trace/digest analysis may propose an automation candidate and point to repeated step signatures. It may not auto-create, auto-install, or auto-promote the script/tool/skill. Promotion requires normal source review, regression tests, and persistence gates.
