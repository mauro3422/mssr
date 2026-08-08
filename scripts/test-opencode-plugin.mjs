import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createMssrOpenCodePlugin,
  MssrHostCallRetryQueue,
  mssrHostCallEnvelopeSchema,
} from "../dist/index.js";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
async function waitFor(predicate, timeout = 1_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail("timed out waiting for asynchronous host telemetry");
}

const events = [];
const hooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project" }, {
  salt: "fixture-salt",
  now: () => new Date("2026-08-08T19:00:00.000Z"),
  sink: { async emit(event) { events.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});

await hooks.event({ event: { type: "session.created", properties: { info: {
  id: "raw-session-secret", parentID: "raw-parent-session-secret",
} } } });
await hooks["chat.message"]({
  sessionID: "raw-session-secret",
  agent: "build",
  model: { providerID: "opencode", modelID: "deepseek-v4-flash-free" },
  messageID: "raw-user-message",
  variant: "high",
}, {});
await hooks["chat.params"]({
  sessionID: "raw-session-secret",
  agent: "build",
  model: { providerID: "opencode", id: "deepseek-v4-flash-free" },
  provider: { info: { id: "opencode" } },
}, { options: { reasoningEffort: "high" } });

const routeOutput = JSON.stringify({ traceId: "mssr-opencode-fixture-trace", private: "must-not-leak" });
const routePart = {
  type: "tool", sessionID: "raw-session-secret", messageID: "raw-assistant-message",
  callID: "raw-route-call", tool: "mssr_route_plan",
  state: { status: "completed", output: routeOutput, time: { start: 1000, end: 1250 } },
};
await hooks.event({ event: { type: "message.part.updated", properties: { part: routePart } } });
await hooks.event({ event: { type: "message.part.updated", properties: { part: routePart } } });
await hooks["tool.execute.after"]({ tool: "mssr_route_plan", sessionID: "raw-session-secret", callID: "raw-route-call" }, { output: routeOutput });
await hooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "raw-session-secret", messageID: "raw-assistant-message-2",
  callID: "raw-shell-call", tool: "bash",
  state: { status: "error", error: "token=secret must-not-leak", input: { command: "private" }, time: { start: 2000, end: 2600 } },
} } } });
await waitFor(() => events.length === 2);

assert.equal(events.length, 2, "terminal calls must be deduplicated by call ID");
assert.equal(events[0].traceId, "mssr-opencode-fixture-trace");
assert.equal(events[1].traceId, "mssr-opencode-fixture-trace");
assert.equal(events[1].host.agent, "build");
assert.equal(events[1].host.model, "opencode/deepseek-v4-flash-free");
assert.equal(events[1].host.reasoningEffort, "high");
assert.equal(events[1].host.variant, "high");
assert.equal(events[1].host.parentSessionKey?.length, 64, "parent session is captured only from the lifecycle event");
assert.equal(events[1].tool.status, "error");
assert.equal(events[1].tool.durationMs, 600);
const serialized = JSON.stringify(events);
for (const forbidden of ["raw-session-secret", "raw-parent-session-secret", "raw-user-message", "raw-shell-call", "must-not-leak", "token=secret", "private"]) {
  assert.equal(serialized.includes(forbidden), false, `private value leaked: ${forbidden}`);
}

// A lifecycle session without parentID is authoritative evidence that this is
// not an observed child. The plugin must not manufacture a relationship from
// the tool name, agent profile, or prior session activity.
const noInferenceEvents = [];
const noInferenceHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: { async get() { throw new Error("lifecycle should prevent a session lookup"); } },
} }, {
  salt: "fixture-salt",
  sink: { async emit(event) { noInferenceEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});
await noInferenceHooks.event({ event: { type: "session.created", properties: { info: { id: "root-without-parent" } } } });
await noInferenceHooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "root-without-parent", callID: "root-task-call", tool: "task",
  state: { status: "completed", output: "delegation is not a parentID", time: { start: 3000, end: 3010 } },
} } } });
await waitFor(() => noInferenceEvents.length === 1);
assert.equal(noInferenceEvents[0].host.parentSessionKey, undefined, "absent parentID must remain absent; task delegation is not parent evidence");

// A child tool event can arrive before a lifecycle event. The optional SDK
// session read supplies a parent only when the host returns that exact session
// and an explicit parentID; no sibling/session ordering is consulted.
const childEvents = [];
let sessionLookups = 0;
const childHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: {
    async get({ path: { id } }) {
      sessionLookups += 1;
      return { data: { id, parentID: "explicit-parent-from-host" } };
    },
  },
} }, {
  salt: "fixture-salt",
  sink: { async emit(event) { childEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});
await childHooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "child-before-lifecycle", callID: "child-read-call", tool: "read",
  state: { status: "completed", output: "not stored", time: { start: 4000, end: 4015 } },
} } } });
await childHooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "child-before-lifecycle", callID: "child-bash-call", tool: "bash",
  state: { status: "completed", output: "not stored", time: { start: 4020, end: 4030 } },
} } } });
await waitFor(() => childEvents.length === 2);
assert.equal(sessionLookups, 1, "one bounded read-only lookup enriches concurrent terminal calls from one otherwise unobserved session");
assert.equal(childEvents[0].host.parentSessionKey?.length, 64, "explicit SDK parentID is hashed before transport");
assert.equal(childEvents[1].host.parentSessionKey, childEvents[0].host.parentSessionKey, "two observed child calls retain one exact host-provided parent key");
assert.equal(new Set(childEvents.map((event) => event.host.callKey)).size, 2, "distinct exposed child calls retain physical-call cardinality");
assert.notEqual(childEvents[0].host.parentSessionKey, noInferenceEvents[0].host.sessionKey, "a parent key comes only from the host value, never another observed session");

// A mismatched SDK response is not evidence about the child session.
const mismatchedEvents = [];
const mismatchedHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: { async get() { return { data: { id: "some-other-session", parentID: "do-not-attach" } }; } },
} }, {
  salt: "fixture-salt",
  sink: { async emit(event) { mismatchedEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});
await mismatchedHooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "unmatched-child", callID: "unmatched-call", tool: "bash",
  state: { status: "completed", output: "not stored", time: { start: 5000, end: 5010 } },
} } } });
await waitFor(() => mismatchedEvents.length === 1);
assert.equal(mismatchedEvents[0].host.parentSessionKey, undefined, "a response for another session must never be used as parent evidence");

// Lifecycle metadata wins when it arrives while the fallback request is still
// in flight. A stale endpoint response must not overwrite that newer evidence.
const lifecycleRaceEvents = [];
let resolveLifecycleRace;
const lifecycleRaceHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: { get() { return new Promise((resolve) => { resolveLifecycleRace = resolve; }); } },
} }, {
  salt: "fixture-salt",
  sink: { async emit(event) { lifecycleRaceEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});
await lifecycleRaceHooks.event({ event: { type: "message.part.updated", properties: { part: {
  type: "tool", sessionID: "lifecycle-race-child", callID: "lifecycle-race-call", tool: "read",
  state: { status: "completed", output: "not stored", time: { start: 5500, end: 5510 } },
} } } });
await lifecycleRaceHooks.event({ event: { type: "session.updated", properties: { info: {
  id: "lifecycle-race-child", parentID: "authoritative-lifecycle-parent",
} } } });
resolveLifecycleRace({ data: { id: "lifecycle-race-child", parentID: "stale-lookup-parent" } });
await waitFor(() => lifecycleRaceEvents.length === 1);
const expectedLifecycleParent = createHash("sha256").update("fixture-salt\0session\0authoritative-lifecycle-parent").digest("hex");
assert.equal(lifecycleRaceEvents[0].host.parentSessionKey, expectedLifecycleParent, "lifecycle metadata must win over an in-flight fallback response");

// An unavailable session endpoint cannot indefinitely postpone host telemetry or
// the intercepted OpenCode hook. It is an optional enrichment, not a transport
// dependency.
const timedLookupEvents = [];
const timedLookupHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: { async get() { await new Promise(() => {}); } },
} }, {
  salt: "fixture-salt",
  parentLookupTimeoutMs: 5,
  sink: { async emit(event) { timedLookupEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});
const timedLookupResult = await Promise.race([
  timedLookupHooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", sessionID: "timed-child", callID: "timed-call", tool: "read",
    state: { status: "completed", output: "not stored", time: { start: 6000, end: 6010 } },
  } } } }).then(() => "returned"),
  delay(50).then(() => "timed-out"),
]);
assert.equal(timedLookupResult, "returned", "a hung read-only enrichment must not block the host event hook");
await waitFor(() => timedLookupEvents.length === 1);
assert.equal(timedLookupEvents[0].host.parentSessionKey, undefined, "timed-out parent metadata remains absent");

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-plugin-"));
try {
  const queuePath = path.join(temporaryRoot, "host-calls.json");
  let retryNow = Date.now();
  const retryQueue = new MssrHostCallRetryQueue(queuePath, () => new Date(retryNow), 2, 2, 10);
  assert.equal(await retryQueue.enqueue(events[0]), "queued");
  assert.equal(await retryQueue.enqueue(events[0]), "duplicate", "the local spool keeps one pending event per id");
  const queuedText = await fs.readFile(queuePath, "utf8");
  for (const forbidden of ["raw-session-secret", "raw-parent-session-secret", "must-not-leak", "token=secret", "private"]) {
    assert.equal(queuedText.includes(forbidden), false, `queue leaked ${forbidden}`);
  }
  retryNow += 10;
  assert.equal((await retryQueue.due()).length, 1);
  assert.equal(await retryQueue.defer(events[0].eventId), "retry");
  retryNow += 20;
  assert.equal((await retryQueue.due()).length, 1, "backoff makes the second retry eligible");
  await retryQueue.delivered(events[0].eventId);
  assert.equal((await retryQueue.due()).length, 0, "successful retry cleans up its local record");

  const concurrentA = new MssrHostCallRetryQueue(queuePath, () => new Date(retryNow), 4, 2, 10);
  const concurrentB = new MssrHostCallRetryQueue(queuePath, () => new Date(retryNow), 4, 2, 10);
  await Promise.all([
    concurrentA.enqueue(events[0]),
    concurrentB.enqueue(events[1]),
  ]);
  retryNow += 10;
  const concurrentReader = new MssrHostCallRetryQueue(queuePath, () => new Date(retryNow), 4, 2, 10);
  const concurrentEvents = await concurrentReader.due();
  assert.deepEqual(
    concurrentEvents.map((entry) => entry.envelope.eventId).sort(),
    [events[0].eventId, events[1].eventId].sort(),
    "two OpenCode processes retain both concurrently queued host calls",
  );
  await Promise.all(concurrentEvents.map((entry) => concurrentReader.delivered(entry.envelope.eventId)));

  const staleLock = `${queuePath}.lock`;
  await fs.writeFile(staleLock, "stale", "utf8");
  const oldTime = new Date(Date.now() - 60_000);
  await fs.utimes(staleLock, oldTime, oldTime);
  const staleRecovery = new MssrHostCallRetryQueue(queuePath, () => new Date(retryNow), 4, 2, 10);
  assert.equal(await staleRecovery.enqueue(events[0]), "queued", "an abandoned process lock is recovered");
  assert.equal(await fs.stat(staleLock).then(() => true, () => false), false, "recovered lock is cleaned up");
  await staleRecovery.delivered(events[0].eventId);

  const recovered = [];
  let sendAttempts = 0;
  const retryHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\retry-project" }, {
    salt: "retry-salt",
    queuePath: path.join(temporaryRoot, "retry.json"),
    retryBaseMs: 5,
    sink: {
      async emit(event) {
        sendAttempts += 1;
        if (sendAttempts === 1) throw new Error("Bridge unavailable");
        recovered.push(mssrHostCallEnvelopeSchema.parse(event));
      },
    },
  });
  const retryPart = {
    type: "tool", sessionID: "retry-session", messageID: "retry-message", callID: "retry-call", tool: "read",
    state: { status: "completed", output: "not captured", time: { start: 1000, end: 1010 } },
  };
  await retryHooks.event({ event: { type: "message.part.updated", properties: { part: retryPart } } });
  await retryHooks.event({ event: { type: "message.part.updated", properties: { part: retryPart } } });
  await waitFor(() => recovered.length === 1);
  assert.equal(sendAttempts, 2, "one failed direct send is retried once from the local spool");
  assert.equal(recovered.length, 1, "duplicate host events do not multiply a queued call");

  const hangingHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\nonblocking-project" }, {
    queuePath: path.join(temporaryRoot, "hanging.json"),
    sink: { async emit() { await new Promise(() => {}); } },
  });
  const hookResult = await Promise.race([
    hangingHooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "nonblocking-session", messageID: "nonblocking-message", callID: "nonblocking-call", tool: "read",
      state: { status: "completed", output: "not captured", time: { start: 1000, end: 1010 } },
    } } } }).then(() => "returned"),
    delay(50).then(() => "timed-out"),
  ]);
  assert.equal(hookResult, "returned", "a stalled telemetry transport must not block an OpenCode hook");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}

console.log("OpenCode host metadata plugin: PASS");
