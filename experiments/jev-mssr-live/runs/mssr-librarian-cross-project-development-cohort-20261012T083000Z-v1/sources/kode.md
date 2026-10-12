# Kode ↔ OpenCode Provider Contract

Last reviewed against upstream docs: **2026-09-13**

This document separates three kinds of truth that must not be mixed:

1. **OpenCode upstream facts** — current public provider/model/endpoints/privacy documentation.
2. **Kode integration policy** — rules implemented in this repository.
3. **Empirical evidence** — behavior reproduced against the live OpenCode API / real Kode UI.

Model catalogs, pricing, free availability and provider behavior can change. Never turn an observed model list into a permanent product assumption.

## 1. Official upstream sources

Primary sources used for this integration:

- OpenCode Providers: <https://opencode.ai/docs/providers/>
- OpenCode Models: <https://opencode.ai/docs/models/>
- OpenCode Zen: <https://opencode.ai/docs/zen/>
- OpenCode Go: <https://opencode.ai/docs/go/>
- OpenCode v2 models reference: <https://opencode.ai/v2/docs/models>
- OpenCode v2 provider reference: <https://opencode.ai/v2/docs/providers>
- Models.dev: <https://models.dev/>
- Models.dev registry API consumed by Kode: <https://models.dev/api.json>
- OpenCode repository: <https://github.com/sst/opencode>

When upstream docs and Kode code disagree, treat that as a compatibility investigation, not as permission to guess.

### Current upstream facts relevant to Kode

As of this review:

- OpenCode uses AI SDK/provider integrations and Models.dev metadata to expose many providers/models.
- OpenCode model identities use provider + model IDs; provider/model availability is dynamic.
- Zen model discovery endpoint: `https://opencode.ai/zen/v1/models`.
- Go model discovery endpoint: `https://opencode.ai/zen/go/v1/models`.
- Current Zen endpoint tables explicitly mix transports by model. Examples in the official table include:
  - `mimo-v2.5-free` → `https://opencode.ai/zen/v1/chat/completions` → `@ai-sdk/openai-compatible`;
  - `muse-spark-1.3-contributor-free` → `https://opencode.ai/zen/v1/responses` → `@ai-sdk/openai`.
- Current Go tables likewise mix Responses, Chat Completions and models backed by other AI SDK packages.

That upstream table is the clearest reason for Kode's most important routing law: **tier is not transport**.

## 2. Privacy warning for free models

Do not equate `FREE` with a uniform privacy contract.

OpenCode's current Zen privacy documentation says its general providers follow zero-retention/no-training policies with named exceptions. The exceptions currently include multiple free endpoints, and OpenCode specifically warns that some free-model data may be used for model/product improvement. Its current documentation also states that Muse Spark 1.3 Contributor Free exchanges discounted/free access for permission to use prompts/completions to train future Meta models.

Implications for Kode:

- `FREE` is a price/tier presentation label, not a privacy guarantee.
- Do not add UI copy such as “private because free” or “zero retention” globally.
- If Kode later displays privacy badges, they must come from current provider/model policy metadata or a separately maintained audited policy layer.
- Sensitive/confidential code should not be assumed safe to send merely because the model appears in OpenCode Zen.
- The current read-only tool boundary reduces mutation risk, **not provider-retention risk**.

Upstream privacy/pricing statements are volatile; review the official Zen page before shipping any permanent privacy promise.

## 3. Kode credential resolution

Kode does **not** require `opencode serve`. The Rust runtime talks to OpenCode endpoints directly.

### Kode-owned key priority

`configured_kode_key()` resolves a shared Kode OpenCode API key in this order:

1. Kode native credential store (`credentials::load_api_key()`) — source label `kode-config`.
2. `KODE_OPENCODE_API_KEY` environment variable.
3. `OPENCODE_ZEN_API_KEY` environment variable.

Environment keys are reported only as source `environment`; the secret is not returned to the frontend.

If none of those exist, provider-specific resolution falls back to OpenCode's `auth.json`:

4. selected provider entry (`opencode` or `opencode-go`) from OpenCode auth — source label `opencode-auth`.
5. For `opencode-go`, if its own key is absent, Kode also tries the `opencode` Zen key because current OpenCode Go/Zen access can share the same account/API-key flow.

### OpenCode auth path

Kode resolves OpenCode auth in this order:

1. `KODE_OPENCODE_AUTH_PATH` override;
2. `$XDG_DATA_HOME/opencode/auth.json`;
3. `$HOME/.local/share/opencode/auth.json` or `%USERPROFILE%\.local\share\opencode\auth.json`.

Only `type: "api"` credentials are currently accepted from this file.

### Native Kode credential storage

Windows:

- Windows Credential Manager;
- generic credential target: `Kode/OpenCodeZenApiKey`;
- username: `Kode`;
- persisted with Windows credential APIs;
- secret buffers are zeroized where practical in Rust.

Unix:

- `${XDG_CONFIG_HOME:-~/.config}/kode/opencode-api-key`;
- created with `0600` permissions.

Other platforms currently do not have a Kode-owned persistent secret store.

### Credential laws

- API keys must never be written to project files, checkpoint localStorage, model preference localStorage, logs or visible provider status.
- Saving a key first validates it against OpenCode before native persistence.
- Clearing/replacing the key clears the cached model route catalog.
- Frontend status receives only metadata such as configured/source/provider, never the key value.
- Never “sync” a Kode-owned key into OpenCode's auth file as a side effect.

## 4. Providers currently implemented by Kode

Kode currently has explicit native transport configuration for:

| Kode provider id | Display name | Responses base | Chat Completions base | Models |
| --- | --- | --- | --- | --- |
| `opencode` | OpenCode Zen | `https://opencode.ai/zen/v1/responses` | `https://opencode.ai/zen/v1/chat/completions` | `https://opencode.ai/zen/v1/models` |
| `opencode-go` | OpenCode Go | `https://opencode.ai/zen/go/v1/responses` | `https://opencode.ai/zen/go/v1/chat/completions` | `https://opencode.ai/zen/go/v1/models` |

Environment overrides exist for development/QA:

- `KODE_OPENCODE_PROVIDER`
- `KODE_OPENCODE_MODEL`
- `KODE_OPENCODE_RESPONSES_URL`
- `KODE_OPENCODE_CHAT_COMPLETIONS_URL`
- `KODE_OPENCODE_MODELS_URL`
- `KODE_OPENCODE_AUTH_PATH`
- `KODE_OPENCODE_API_KEY`
- `KODE_AI_MOCK` (debug builds only)

Do not expose arbitrary provider URLs as a casual UI setting without a separate trust/security design.

## 5. Catalog discovery

Kode does not maintain a permanent hard-coded OpenCode model catalog.

The current flow is:

1. Resolve configured provider ids.
2. Fetch live model ids from each provider's `/models` endpoint.
3. Fetch Models.dev metadata from `https://models.dev/api.json`.
4. Enrich each live model with label, cost/tier, limits, reasoning/tool capability and provider SDK metadata.
5. Determine a supported transport.
6. Omit models Kode cannot route safely.
7. Sort the remaining options for the Kode UI.
8. Cache explicit `modelKey → provider/model/transport` routes in the native `AiState`.

The route key is `provider_id:model_id`, for example `opencode:mimo-v2.5-free`. This avoids ambiguity when the same model id exists under more than one provider.

### Capability filter

Models explicitly marked `tool_call: false` are not offered by Kode's current agent/chat catalog because the runtime contract assumes the model can participate in the bounded tool loop.

Do not silently reinterpret an unsupported capability as supported.

## 6. The transport laws

These are durable integration rules and should be treated as regression invariants.

### Law 1 — FREE/Go/Zen does not choose the wire protocol

Never write logic equivalent to:

`if free => chat/completions`

That rule caused the Muse Spark 1.3 failure.

Tier describes grouping/cost/access. Transport comes from model/provider metadata.

### Law 2 — model-level package metadata wins

If Models.dev/provider metadata includes an SDK package for the individual model, use it before a provider-level default.

This matters because one OpenCode provider exposes models through multiple protocols.

### Law 3 — known package mapping is explicit

Current Kode mapping:

| AI SDK package | Kode transport |
| --- | --- |
| `@ai-sdk/openai` | Responses |
| `@ai-sdk/openai-compatible` | Chat Completions |
| other explicit package | unsupported → omit model |

Kode does not currently implement Anthropic Messages transport in this provider boundary. If upstream metadata says `@ai-sdk/anthropic`, omit it rather than sending it to a superficially similar endpoint.

### Law 4 — unknown explicit metadata is safer than guessing

If upstream explicitly identifies a package Kode does not support, that is stronger evidence than a model-name heuristic. Omit the model.

### Law 5 — fallback heuristics are narrow and secondary

For incomplete metadata only, current compatibility fallback recognizes a small set of known shapes (for example GPT/Grok/Muse-like Responses ids and Big Pickle/`-free` compatible ids). This is a fallback for missing metadata, **not the primary routing authority**.

If fallback behavior starts growing into a large model-name database, stop and improve metadata discovery instead.

### Law 6 — provider availability is live

A model that worked yesterday can disappear, change package/endpoint, move tier or change limits. Always prefer live `/models` + current metadata over stale documentation or chat memory.

### Law 7 — unsupported beats misrouted

A model omitted from Kode is better than a model exposed with the wrong protocol and returning opaque provider 500s.

## 7. FREE grouping and picker order

Kode's UI currently sorts:

1. FREE
2. OpenCode Go
3. OpenCode Zen

Within FREE, `mimo-v2.5-free` is deliberately preferred first, then entries are sorted by label/provider/id.

Current FREE detection can come from zero input/output cost metadata plus compatibility recognition for known free ids such as a `-free` suffix / Big Pickle.

This is presentation logic only. It must never affect transport selection.

`mimo-v2.5-free` being preferred is a Kode UX default, not a claim that it is always OpenCode's best model or permanently available.

## 8. Known model examples — evidence, not permanent routing tables

### MiMo-V2.5 Free

Current official OpenCode Zen docs list:

- model id: `mimo-v2.5-free`;
- endpoint: Chat Completions;
- AI SDK package: `@ai-sdk/openai-compatible`.

Kode real direct smoke previously returned HTTP 200 and streamed `KODE_FREE_DIRECT_OK`.

### Muse Spark 1.3 Contributor Free

Current official OpenCode Zen docs list:

- model id: `muse-spark-1.3-contributor-free`;
- endpoint: Responses;
- AI SDK package: `@ai-sdk/openai`.

Observed failure that produced the transport fix:

- same key/model sent to `/chat/completions` → HTTP 500;
- same key/model/session sent to `/responses` → HTTP 200.

After Kode switched to model metadata routing, the real Kode UI selected Muse and streamed `KODE_MUSE_UI_OK` successfully.

The lesson is the transport law, not “hardcode Muse forever.” Re-check upstream metadata whenever behavior changes.

## 9. Sessions and request identity

Every live contextual/global thread has a stable Kode-generated provider session id.

Direct requests carry:

- unique request id;
- stable per-thread `x-opencode-session`;
- Kode-owned User-Agent identity.

Follow-ups in the same live thread reuse the session id. A new live thread gets a new session id.

Persistent contextual checkpoints store the local conversation/anchor but not the provider session identity. Reopening one starts a new provider session.

Session ids are not credentials and must remain separate from API-key storage.

## 10. Errors and recovery behavior

Kode contextualizes provider failures instead of exposing only raw HTTP codes.

Important classes:

- HTTP 500: model/provider path may be temporarily failing; historically this also exposed wrong transport selection, so inspect route metadata before assuming provider outage.
- HTTP 429 / `FreeUsageLimitError`: free quota/rate limit; user should retry later or select another model/tier.
- unsupported transport: model should be absent from catalog rather than attempted.
- stale catalog route: refresh model catalog after credential/provider changes.

### Debug order when one model fails but official OpenCode works

1. Confirm the exact provider + model id.
2. Fetch the live provider `/models` entry.
3. Inspect current Models.dev/provider package metadata.
4. Compare Kode's cached route transport with upstream endpoint/package.
5. Test the provider endpoint directly with the same credential/session without exposing the key.
6. Verify whether only one model fails or the provider itself fails.
7. Fix routing/metadata authority first; do not special-case a model unless upstream metadata genuinely cannot express the distinction.
8. Add a regression test for the discovered rule.
9. Re-run a real Kode UI smoke after native rebuild.

## 11. Request/tool safety rules

The provider boundary is intentionally read-only today.

- Model output cannot directly mutate source.
- Only `workspace_list_directory`, `workspace_read_text` and `workspace_search_text` are exposed.
- Tool paths are workspace-relative and guarded.
- Sensitive paths are hidden/rejected.
- Tool rounds/results/context are bounded.
- Private model reasoning is not surfaced; Kode emits safe activity summaries and streamed answer text only.

If write/edit tools are added later, they require a separate product/approval/diff contract. Do not quietly expand the current read-only tools.

See [`AI_RUNTIME.md`](./AI_RUNTIME.md) for exact bounds and persistence/context behavior.

## 12. Upstream drift checklist

Before changing provider/model logic, verify all of these against current sources:

- Zen and Go endpoint paths;
- `/models` response availability;
- model id and provider id;
- AI SDK package / protocol;
- tool-call capability;
- context/output limits;
- free/pricing state;
- model deprecation/removal;
- privacy/retention/training policy.

Record the date when changing durable docs. Prices and free status should be treated as snapshots, not constants.

## 13. Implementation source map

- `src-tauri/src/ai/opencode.rs` — provider metadata, credential fallback, live catalog enrichment, model route keys, sorting and transport resolution;
- `src-tauri/src/ai/credentials.rs` — secret normalization and platform persistence;
- `src-tauri/src/ai/commands.rs` — native commands, cached routes, request dispatch, provider error contextualization and bounded tool loop;
- `src-tauri/src/ai/responses.rs` — Responses request/stream adapter;
- `src-tauri/src/ai/chat_completions.rs` — Chat Completions request/stream adapter;
- `src-tauri/src/ai/models.rs` — provider/model/request/event contracts and hard runtime bounds;
- `src/lib/ide/ai-runtime.ts` — frontend AI port/Tauri adapter;
- `src/lib/ide/ai-shared-state.svelte.ts` — shared catalog/model preference in the UI.

If a model behaves differently from this document, inspect the current upstream metadata and these source files before adding an exception.

## 14. Kode verification baseline

Current native model/runtime evidence:

- Rust native full gate: **64/64**; multimodal provider regressions remain separately covered by `ai::commands::tests` **9/9** and `ai::opencode::tests` **8/8**;
- direct MiMo free smoke: HTTP 200 + streamed `KODE_FREE_DIRECT_OK`;
- real Muse UI smoke: `KODE_MUSE_UI_OK` via Responses;
- current hidden UI/filesystem/AI-surface QA passed at `D:\Dev\kode-qa-artifacts\2026-09-15T01-48-20-168Z\qa-result.json` (**101/101**, 0 console errors, 0 page errors), including sanitized Markdown/tool rendering, multimodal chat attachments and native external image drop into the docked chat;
- P4 LSP runtime smoke is separate from provider verification and passes through `tools/qa/lsp-typescript-smoke.mjs` with a real TypeScript `2322` diagnostic.

A later state file may supersede these counts/artifact paths; treat `.mssr/PROJECT_STATE.md` as the current verification authority.

## 15. Rules to preserve in future provider refactors

- Kode owns UX; provider owns inference.
- One shared model preference across AI surfaces.
- Provider/model route keys remain explicit and unambiguous.
- Live provider model availability beats hard-coded lists.
- Model metadata chooses transport; tier never does.
- Unknown explicit transport is omitted, not guessed.
- Secrets remain native; frontend sees status, not key material.
- Live provider sessions are stable per thread but are not durable checkpoint identity.
- Ordinary AI questions remain read-only with respect to source.
- Privacy policy is provider/model-specific and must not be inferred from cost tier.
