# Codex handoff — TypeSafe / Jev experiment for MSSR

## Repo and safety
- Canonical repo: `D:\Dev\mssr`
- Branch: `main`
- Do not commit or push unless Mauro explicitly asks.
- Current repo change from this exploration is only the untracked `experiments/` tree.
- Respect `AGENTS.md` and `.mssr/PROJECT_*` as project authority.
- Do not turn Jev into a permission system or replace deterministic safety/policy checks.

## What is already installed
- Official TypeSafe skill source: `C:\Users\mauro\.agents\skills\typesafe-ai`.
- Codex mount: `C:\Users\mauro\.codex\skills\typesafe-ai` -> junction to the global source.
- MSSR `FilesystemSkillProvider` was tested and discovers `typesafe-ai` as `codex-local` from provider `filesystem-skills`.
- Official JS SDK installed only inside this experiment: `@typesafe-ai/sdk` 0.6.0.

## Lab
- Path: `D:\Dev\mssr\experiments\typesafe-jev-lab`
- UI: `http://127.0.0.1:8788`
- `server.mjs` sends one `systemOne` request containing Noul + Choice + Score.
- `public/index.html` is intentionally simple and exposes raw typed results, tokens and round-trip latency.
- `start.ps1` now reads the API key from Windows Credential Manager.
## Credential handling
- Windows Credential Manager target: `TypeSafe:MSSR:JevLab`.
- Helper: `windows-credential.ps1` uses the Win32 Credential Manager API (`CredWriteW` / `CredReadW`).
- `save-credential.ps1` stores the key with hidden input.
- `start.ps1` loads it automatically into `TYPESAFE_API_KEY` only for the process that launches the lab.
- The key is not stored in `.env`, source files, git, or browser storage.
- Credential presence was verified without printing the secret.

## First real Jev call already succeeded
Scenario: coding agent about to change routing rules; relevant config read; tests not yet run; two reversible files; no destructive command.

Observed single-call result:
- round trip: `929.3 ms`
- tokens: `426 input / 87 output`
- `needsMoreContext` Noul: `0.46`
- `nextAction`: `run_tests`, confidence `0.77`, distribution: run_tests `0.83`, ask_user `0.09`, inspect_context `0.07`, stop `0.01`
- `actionRisk`: score `1.49` on 0..4 (`negligible`..`critical`), confidence `0.59`; low `0.53`, medium `0.46`, high `0.01`

Treat this as one observed sample, not a benchmark or calibration result.
## TypeSafe facts to preserve
- Jev is TypeSafe's first System One model: state + typed questions -> structured answers and probabilities, not generated prose.
- Current primitives: `Noul` (yes probability), `Choice` (one fixed option + distribution + confidence), `Score` (ordered levels + interpolated score + distribution + confidence).
- Noul has no separate confidence. A Noul near 0.5 means yes/no uncertainty, not medium intensity.
- Questions in one request share the same state but are evaluated independently and in parallel.
- Use one narrow judgment per question; compose independent factors in normal code.
- Choice/Score confidence is derived from distribution concentration; it is not permission to act or proof the answer is correct.
- Thresholds should vary with consequence/risk and must be evaluated on target data.
- Keep exact facts, calculations, lookups, hard rules and execution in deterministic code.
- System One currently accepts textual content (including JSON/arrays of text), not images/audio/video.

## Proposed mental model
`deterministic facts/rules -> Jev bounded semantic judgments -> reasoning LLM/person only when needed`

Jev should be treated as a fast semantic judgment layer, not as the owner of MSSR policy, lifecycle, permissions, or truth.
## What Codex should do next
1. Read `AGENTS.md`, `.mssr/PROJECT_CONTEXT.md`, `.mssr/PROJECT_MEMORY.md`, `.mssr/PROJECT_STATE.md`, the installed TypeSafe `SKILL.md`, and the live official docs below.
2. Inspect this lab and verify secret handling before changing anything.
3. Run repeated Jev experiments and record p50/p95 latency, input/output tokens, distribution stability, failures, and actual cost where available.
4. Build representative MSSR shadow-mode cases: skill/context relevance, needs-more-context, next-action routing, risk, contradiction importance, and relation/supersession hints.
5. Compare Jev judgments against current deterministic heuristics/fixtures without letting Jev influence production routing yet.
6. Prefer batching independent questions over the same state; use a second call only when later evidence/options genuinely depend on an earlier answer.
7. Propose the smallest optional integration seam only after measurements. Preserve MSSR portability/provider independence.
8. Do not replace current R4 deterministic semantic-consistency truth machinery. Jev may supply evidence/judgments in shadow mode, not canonical truth.
9. Add tests/docs for any durable change and follow MSSR changelog/project-knowledge rules if semantics change.

## Candidate first benchmark
For 20-50 curated routing states, ask in one call:
- Noul: is more context needed before the next bounded step?
- Choice: next bounded action among inspect_context/run_tests/ask_user/continue/stop.
- Score: automation risk on concretely described ordered levels.
Then add independent Noul judgments per candidate skill/context item when multi-label relevance is allowed.
## Official sources
- Docs index: https://docs.typesafe.ai/llms.txt
- Introduction: https://docs.typesafe.ai/introduction
- Quick start: https://docs.typesafe.ai/introduction/quickstart
- System One: https://docs.typesafe.ai/concepts/system-one
- How to build: https://docs.typesafe.ai/concepts/how-to-build-with-system-one
- State: https://docs.typesafe.ai/concepts/state
- Primitives: https://docs.typesafe.ai/primitives
- Confidence: https://docs.typesafe.ai/confidence
- JavaScript SDK: https://docs.typesafe.ai/sdk/javascript
- HTTP API: https://docs.typesafe.ai/api
- Official agent skill: https://github.com/typesafe-ai/skills/blob/main/skills/typesafe-ai/SKILL.md
- Official JS SDK repo: https://github.com/typesafe-ai/typesafe-sdk-js
## Credential verification result
A fresh PowerShell process loaded `TypeSafe:MSSR:JevLab` from Windows Credential Manager, exported it only to that child process, authenticated through the official SDK, and listed models successfully:
`jev-latest`, `jev-preview`.

This confirms the saved credential is usable independently of the already-running lab server.
