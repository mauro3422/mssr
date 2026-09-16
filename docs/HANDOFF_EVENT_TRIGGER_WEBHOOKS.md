# Handoff — Event-driven triggers / webhook-capable hosts

Date: 2026-08-28
Status: future MSSR/host patch candidate; no implementation in this handoff.

## Why this exists

Current scheduled/condition watches are useful when a source has no push channel, but they spend work checking even when nothing changed. The desired direction is to let a host react immediately when an authorized provider can emit an event, while preserving polling as an explicit fallback for sources that cannot.

Concrete motivating case: ChatGPT Web can run a periodic Smartwatch GPS Workshop watch, but Steam Workshop metrics do not currently provide us with a native event source through the active host. The same architecture should also work for connected apps that do expose real events, local Bridge providers, MCP notifications, GitHub/Slack/Gmail-style webhook sources, filesystem/runtime events, or future providers.

## Architectural boundary

MSSR must remain portable, deterministic/advisory and I/O-free. **MSSR should not become the webhook HTTP server, secrets vault, polling daemon, or execution proxy.**

Recommended ownership:

1. **Host/provider adapter (Bridge, Codex host, ChatGPT-connected app, other runtime)** receives or observes the external event and authenticates it.
2. Host normalizes only safe metadata into a portable `EventEnvelope`; secrets/raw bodies stay host-owned.
3. **Portable MSSR** evaluates the event against a bounded trigger/watch specification and returns advisory trigger intent/reasoning metadata.
4. Host performs the authorized action and records trace/evidence/outcome through the existing MSSR lifecycle.
5. If the provider has no event capability, the host may use a bounded polling adapter; this must be represented as fallback/degraded capability rather than pretending a webhook exists.

## Proposed portable contract

Illustrative shape; names are not frozen:

```ts
type EventEnvelope = {
  source: string;          // provider/adapter identity
  eventType: string;       // stable provider-independent or namespaced type
  eventId?: string;        // provider event id when available
  subject?: string;        // resource/watch target
  observedAt: string;
  occurredAt?: string;
  dedupeKey: string;
  cursor?: string;
  freshness?: "fresh" | "stale" | "unknown";
  authenticity?: "verified" | "host-verified" | "unknown";
  payloadRef?: string;     // opaque host-owned reference; no secret/raw payload
  metadata?: Record<string, string | number | boolean | null>;
};

type TriggerSpec = {
  id: string;
  acceptedSources?: string[];
  eventTypes?: string[];
  subject?: string;
  condition?: unknown;     // bounded portable condition representation
  cooldownMs?: number;
  dedupeWindowMs?: number;
};
```

Portable evaluation should be a pure function roughly equivalent to:

```text
evaluateTrigger(eventEnvelope, triggerSpec, priorReceipt)
→ matched | ignored | duplicate | stale | unsupported
→ normalized intent/signals/capability needs
→ bounded reason/evidence receipt
```

## Required invariants

- Event receipt does **not** grant permission to execute tools.
- Provider authentication/secrets remain host-owned.
- No raw email/message/webhook body, credentials, conversation transcript or hidden reasoning in MSSR telemetry.
- Idempotency is mandatory: duplicate delivery must not create duplicate tasks/actions.
- Preserve event provenance, source health, observed time and freshness.
- Distinguish `native-event`, `provider-notification`, `local-runtime-event`, and `poll-fallback` in evidence.
- A polling fallback must have bounded cadence/backoff and should be replaced by native events when the provider later exposes them.
- Re-plan/skill routing may be triggered by an accepted event, but the resulting route remains advisory and follows the normal trace contract.
- Event-triggered runs must still produce verification/persistence/outcome checkpoints when they mutate durable state.
- Hosts must be able to disable/unsubscribe a trigger without changing portable routing semantics.

## Bridge adoption candidate

Bridge is the natural first local host adapter because it already owns runtime/provider observation and the Notice/trace plumbing. A future Bridge patch could expose a small provider-event registry and normalize supported sources before calling MSSR. Do not hard-code ChatGPT-specific webhook schemas into portable MSSR.

Useful source classes to test:

- MCP `notifications/tools/list_changed` / provider catalog changes;
- filesystem/process/runtime events already observable locally;
- GitHub/connected-app events when an authorized connector supplies them;
- a synthetic deterministic event provider for fixtures;
- a negative provider that exposes no events, proving clean `poll-fallback` behavior.

## Steam Workshop note

Do not assume Steam Workshop can push subscriber/ranking changes. If no authenticated/native event source exists, Workshop metrics remain a polling/watch problem. MSSR can still normalize the resulting observation and avoid redundant downstream work through dedupe/change receipts, but it cannot manufacture a webhook that Steam does not expose.

A later adapter could reduce cost with lightweight conditional requests/change fingerprints before doing a full scrape, if Steam/public endpoints safely support that.

## Suggested implementation sequence

1. Add a portable event envelope + pure trigger evaluator with fixtures and cross-host conformance tests.
2. Add dedupe/receipt semantics and trace integration without execution authority.
3. Add one synthetic/native provider adapter in Bridge and prove end-to-end event → route → outcome.
4. Add a polling-fallback adapter and prove the evidence explicitly says fallback rather than native event.
5. Only then expose host UX/API for creating, listing, disabling and inspecting event-triggered watches.
6. Document security, privacy, retry/backoff and provider-health behavior.
7. Version the MSSR semantic change with a changelog and update PROJECT_CONTEXT/MEMORY/STATE as required by `AGENTS.md`.

## Acceptance matrix

- duplicate event delivered twice → one accepted trigger;
- stale event → ignored or marked stale by policy;
- bad/unverified source → no implicit action;
- native event → no periodic poll required;
- no-event provider → bounded polling fallback works and is labeled fallback;
- host restart → durable subscription/receipt state resumes without replay storm;
- event matches but required capability is unavailable → normal MSSR missing-capability/replan path;
- mutation caused by event → normal verification/persistence/outcome lifecycle;
- native/Codex/OpenCode/Bridge conformance uses the same portable evaluator even if transport differs.

## Non-goals for the first patch

- turning MSSR into a general automation scheduler;
- storing webhook secrets;
- replacing provider-specific authentication;
- executing arbitrary tools directly from event metadata;
- promising push semantics for providers such as Steam that do not expose a usable event channel.

## Resume instruction

When this work is picked up, load `docs/AGENT_PROTOCOL.md`, this handoff, current provider/Notice Plane architecture and the active release state. Re-plan as an MSSR semantic change, create the versioned changelog before persistence, and keep Bridge as an adapter rather than portable semantic owner.
