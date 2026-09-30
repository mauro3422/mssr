# Handoff — MSSR Semantic Experience Layer — 2026-09-29

## Goal

Continue the same MSSR work without reconstructing the conversation. Mauro wants Shef/Jev to teach MSSR not only from trace outcomes or cross-document relation labels, but from the broader semantic decisions it makes while assembling/reviewing project knowledge. The long-term goal is an auditable deterministic fallback that behaves approximately like verified Shef decisions when Shef is unavailable, while abstaining when experience is insufficient.

The governing rule is:

```text
Shef chose it                         = shadow observation
independent evidence confirmed it     = verified experience
independent evidence corrected it     = verified correction
repeated verified experience          = candidate distilled rule
safe distilled rule                   = deterministic advisory fallback
no safe rule                          = abstain / review
```

A successful MSSR trace is calibration/outcome evidence, not proof that an individual semantic decision was correct.

## Source/runtime status

- Repository: `D:\Dev\mssr`
- Branch: `main` ahead of `origin/main`; the working tree intentionally contains accumulated legitimate release work plus older unrelated dirty work.
- Current source version: `0.2.88` (`package.json` / lock bumped with `npm version 0.2.88 --no-git-tag-version`).
- `0.2.87` remains the completed Semantic Experience/R5 baseline; Bridge `0.6.141` now advances beyond it to exact `0.2.88` for routing repair.
- Current 0.2.88 routing-repair workflow uses MSSR trace `mssr-20260929041647-97cbc86b-01c`; Bridge adoption work uses project-owned trace `mssr-20260929043051-cb353f20-685`.
- Exact package/adoption is complete: `pkg:0.2.88#2c1d1968`, 921,836 bytes, SHA-256 `2c1d1968025692493ac45c941ab4caa567cf66a2822326867aac24b4b95d9b56`; Bridge `0.6.141` adopted it on live boot `d9be7be4-572d-45d8-b697-499fecc8b12f` after `verify:all` passed with `failedRequired=0`.
- 0.2.88 adds deterministic bounded `nearMatches` for strong structured routing candidates blocked by missing gates. Near-matches are advisory only and cannot enter `loadOrder`, bypass host-gating, rewrite intent or grant Jev/model authority.
- Live readback reproduced the original failure safely: with the required signal omitted, Jev stays out of `loadOrder` and the missing `tool-chain-needed` gate becomes visible; after validating and adding that signal, Jev routes normally. Health/ready remain green with 179 tools and zero new post-baseline transport failures.
- No Git commit/push or npm registry publish has been performed by this work.
- Never use reset/clean/global stash/`git add -A` to reconcile this tree. `.mssr/PROJECT_MEMORY.md` has pre-existing unrelated collaboration-routing changes; preserve them.

## Architecture

```text
                Shef / Jev
                    |
       +------------+-------------+
       |                          |
semantic/content decisions   context/maintenance decisions
       |                          |
       +------------+-------------+
                    v
       Semantic Experience shadow store
     features + provenance + proposal + trace id
                    |
                    v
          independent verification
        confirmed / corrected / rejected
                    |
                    v
             experience distiller
  dedupe + cross-project support + dominance +
        Wilson confidence lower bound
                    |
                    v
           deterministic fallback
             rule / abstain
                    |
                    v
                 MSSR
    remains canonical authority/write owner
```

The generalized plane is additive. The relation-specific distillation introduced in 0.2.85 remains for compatibility; 0.2.86 adds a generic experience model above it.

## Safety invariants

Every generic observation/fallback declares:

- `authorityInfluence=false`
- `routingInfluence=false`
- `canonicalRewriteAllowed=false`
- `autoApplyAllowed=false`
- provider proposal is not training truth
- trace outcome does not verify a semantic decision
- source text is not required in the experience store
- contradictions remain review-sensitive; `semantic-relation=contradicts` is never promoted to an automatic rule
- insufficient/unseen experience returns `abstain` rather than guessing

Only independent `confirmed` or `corrected` feedback is eligible for distillation. A correction teaches the corrected value, not the original Shef proposal.

## Implemented source files

### `src/semantic-experience.ts`

Defines generic schema/version 1 and the initial decision kinds:

- `semantic-relation`
- `context-selection`
- `document-role`
- `placement`
- `drift-interpretation`
- `maintenance-disposition`
- `abstention-policy`

An observation stores a normalized bounded feature signature, bounded provenance units (`sourceRef`, optional SHA-256/line range/role/reason), provider proposal/confidence/model identity, optional compact trace projection and verification state. It never needs copied source text.

Distillation defaults to repeated independently verified evidence, at least two projects, dominance and a Wilson lower-confidence bound. Same trace+feature retries do not inflate support. Provider agreement is measured so the system can learn from corrections rather than simply imitate Shef.

### `src/semantic-experience-store.ts`

Persistent MSSR operational store:

`<MSSR_STATE_ROOT>/semantic-experience/observations-v1.json`

Supports append/dedupe, independent feedback, compact trace-digest hydration, profile building, deterministic classification and bounded status summaries. Max observation count is bounded.

### `src/semantic-experience-contract.ts`

Adds five shared MCP tools:

1. `mssr_semantic_experience_observe`
2. `mssr_semantic_experience_status`
3. `mssr_semantic_experience_feedback`
4. `mssr_semantic_experience_fallback`
5. `mssr_semantic_experience_trace_link`

`observe` is intentionally generic so future Shef/MSSR producers can record semantic decisions without creating another learning subsystem.

### Registration

- `src/semantic-curation-contract.ts` registers the Semantic Experience tools after the existing semantic-curation tools.
- `src/mcp-server.ts` includes their names in the native tool catalog.
- `src/index.ts` exports experience schema/store/contract.

## Automatic producers implemented

### Cross-document evidence graph

`src/semantic-curation-evidence-graph.ts` now preserves the 0.2.85 relation-specific shadow and additionally writes a generic `semantic-relation` experience for every persisted Shef/Jev pair judgment.

The generic experience contains only bounded retrieval/structural features plus exact provenance for both blocks. It can carry the active compact trace identity. No source text is copied.

### Project Context semantic ref-split

`src/project-context-semantic-curation.ts` now writes two generic experiences for each actual persisted Shef/provider semantic decision:

- `document-role`: what the section appears to represent (`current-state`, `history`, etc.) using bounded structural context.
- `placement`: `keep-baseline`, `move-reference` or `review`, using parent kind/topic, section-size/pressure, protected/historical cues, lifecycle, parent relation, baseline-need/reference-value buckets and optional verifier presence.

The ref-split MCP plan accepts optional `traceId` / `workflowKey` so the host can associate decisions with the active MSSR lifecycle without loading the trace itself.

## Current automation and remaining learning gate

Do not broaden authority while continuing this handoff.

The 0.2.87 continuation already automated the previously pending producers: `learning-digest-v1` projects bounded `context-selection`, drift, `maintenance-disposition` and `abstention-policy` shadows, and Bridge closes traces into Semantic Experience automatically. The store is accumulating real cross-project shadows; these observations still have no routing or write authority.

The remaining learning gate is independent verification: convert later observable verifier/outcome evidence into `confirmed` / `corrected` / `rejected` feedback without self-confirming Shef/Jev. Only independently verified evidence may train distilled fallback rules, and the leave-one-project-out promotion thresholds remain unchanged.

0.2.88 is orthogonal to that learning plane. Its routing `nearMatches` diagnose an incomplete caller intent deterministically; they do not use or promote Semantic Experience and they do not invoke Jev.

## Tests already added / passing in focused gates

### `scripts/test-semantic-experience.mjs`

Covers:

- raw shadow cannot train;
- independently verified context-selection can promote after sufficient repeated evidence;
- unseen feature abstains;
- corrected placement learns the verified correction even when Shef proposed something else;
- same-trace retry dedupe;
- `semantic-relation=contradicts` non-promotion;
- trace hydration does not self-confirm;
- no raw source text requirement;
- bounded status/context capsule.

### Existing suites extended

- `scripts/test-project-context-semantic-curation.mjs`: verifies four semantic ref-split decisions create eight shadows (document-role + placement), all `verification=unknown`, no auto authority and no copied source phrase.
- `scripts/test-semantic-curation-evidence-graph.mjs`: verifies generic semantic-relation shadows alongside the old relation-specific store, including trace association and no copied source text.
- `scripts/test-semantic-curation-mcp.mjs`: verifies five new tools, generic shadow creation, bounded status, fallback abstention and independent correction.

Focused 0.2.88 routing gates currently pass:

```text
npm run build                        # PASS
node scripts/test-skill-routing.mjs # PASS; 271 fixture cases + near-match regression/audit
```

The near-match regression proves both sides of the safety boundary: a strongly matching Jev candidate with a missing required signal is not activated, but the missing gate becomes visible; after the host truthfully supplies that signal, normal structured routing selects the skill.

## 0.2.88 closure

`0.2.87` package/adoption is complete and live in Bridge 0.6.141. The current source is 0.2.88 and the active release work is the transversal routing-repair contract described above. Release metadata declares `PROJECT_CONTEXT: updated`, `PROJECT_MEMORY: reviewed-none` and `PROJECT_STATE: updated`; the existing Semantic Experience promotion decision is unchanged.

Preserve the legitimate accumulated dirty tree; never use reset/clean/global stash/add-A to isolate this work. Remaining closure sequence is: full 0.2.88 release gate -> one exact immutable package receipt -> Bridge exact-package adoption -> Bridge focused/full verification -> controlled watchdog restart -> live near-match/readback -> lifecycle persistence/maintenance close. Do not commit, push or publish npm unless explicitly requested.
