import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createMssrOpenCodePlugin,
  defaultStateRoot,
  generatePersistableMachineSalt,
  hardenPrivateFile,
  MssrHostCallRetryQueue,
  mssrHostCallEnvelopeSchema,
  rotateMachineSalt,
} from "../dist/index.js";

// A high-entropy explicit salt the plugin accepts. Low-entropy fixture salts
// ("fixture-salt", "retry-salt") are now intentionally rejected as insecure.
const STRONG_SALT = "7f83b1657ff1fc53b92dc18148a1d65dfa13514eb5d8459d6e6c7b80e2f41b2f";

function assertPrivateFileHardeningOutcome(diagnostics, message) {
  if (process.platform !== "win32" || diagnostics.length === 0) {
    assert.deepEqual(diagnostics, [], message);
    return;
  }
  assert.ok(
    diagnostics.every((diagnostic) => diagnostic.code === "mssr-opencode-windows-acl-unavailable"),
    `${message}: a policy-restricted Windows host may report only the bounded ACL degradation diagnostic`,
  );
}

// Internally generated salts must satisfy the same structural floor that later
// readers apply. Rejection sampling prevents a rare but valid CSPRNG sample
// from being persisted, rejected by its creator, and replaced concurrently.
{
  const weakButWellShaped = "00".repeat(32);
  const candidates = [weakButWellShaped, STRONG_SALT];
  assert.equal(generatePersistableMachineSalt(() => candidates.shift()), STRONG_SALT);
  assert.throws(
    () => generatePersistableMachineSalt(() => weakButWellShaped),
    /could not generate a structurally valid OpenCode metadata salt/i,
  );
}

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
  salt: STRONG_SALT,
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
  salt: STRONG_SALT,
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
  salt: STRONG_SALT,
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
  salt: STRONG_SALT,
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
  salt: STRONG_SALT,
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
const expectedLifecycleParent = createHash("sha256").update(`${STRONG_SALT}\0session\0authoritative-lifecycle-parent`).digest("hex");
assert.equal(lifecycleRaceEvents[0].host.parentSessionKey, expectedLifecycleParent, "lifecycle metadata must win over an in-flight fallback response");

// An unavailable session endpoint cannot indefinitely postpone host telemetry or
// the intercepted OpenCode hook. It is an optional enrichment, not a transport
// dependency.
const timedLookupEvents = [];
const timedLookupHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project", client: {
  session: { async get() { await new Promise(() => {}); } },
} }, {
  salt: STRONG_SALT,
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

// With no caller-supplied salt, the plugin must never fall back to a
// predictable public default. It resolves a random, machine-local secret that
// is shared across OpenCode processes on the same host so correlation survives
// while low-entropy IDs stay unguessable.
const saltRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-salt-"));
try {
  const saltPath = path.join(saltRoot, "host-metadata-salt.key");
  const hashSecret = (salt, kind, value) => createHash("sha256").update(`${salt}\0${kind}\0${value}`).digest("hex");
  const saltEvents = [];
  const saltDiagnostics = [];
  const saltHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\salt-project" }, {
    saltPath,
    onDiagnostic(diagnostic) { saltDiagnostics.push(diagnostic); },
    sink: { async emit(event) { saltEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
  });
  await saltHooks.event({ event: { type: "session.created", properties: { info: { id: "shared-session-secret" } } } });
  await saltHooks.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", sessionID: "shared-session-secret", callID: "salt-call", tool: "read",
    state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
  } } } });
  await waitFor(() => saltEvents.length === 1);

  const storedSalt = (await fs.readFile(saltPath, "utf8")).trim();
  assertPrivateFileHardeningOutcome(saltDiagnostics, "ordinary atomic salt creation either hardens or reports the bounded Windows ACL degradation");
  assert.equal(storedSalt.length, 64, "machine salt is a 32-byte random hex secret");
  assert.notEqual(storedSalt, "mssr-opencode-host-metadata-v1", "the predictable public default must never be persisted or used");
  const expectedKey = hashSecret(storedSalt, "session", "shared-session-secret");
  assert.equal(saltEvents[0].host.sessionKey, expectedKey, "session key is derived from the persisted machine secret");

  const saltEventsB = [];
  const saltDiagnosticsB = [];
  const saltHooksB = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\salt-project" }, {
    saltPath,
    onDiagnostic(diagnostic) { saltDiagnosticsB.push(diagnostic); },
    sink: { async emit(event) { saltEventsB.push(mssrHostCallEnvelopeSchema.parse(event)); } },
  });
  await saltHooksB.event({ event: { type: "session.created", properties: { info: { id: "shared-session-secret" } } } });
  await saltHooksB.event({ event: { type: "message.part.updated", properties: { part: {
    type: "tool", sessionID: "shared-session-secret", callID: "salt-call-2", tool: "read",
    state: { status: "completed", output: "not stored", time: { start: 3, end: 4 } },
  } } } });
  await waitFor(() => saltEventsB.length === 1);
  assertPrivateFileHardeningOutcome(saltDiagnosticsB, "reloading an existing salt remains idempotent under the host ACL policy");
  assert.equal(saltEventsB[0].host.sessionKey, expectedKey, "a second process on the same host correlates via the persisted machine secret");

  const emptySaltPath = path.join(saltRoot, "empty-host-metadata-salt.key");
  await fs.writeFile(emptySaltPath, "", "utf8");
  const concurrentEvents = [[], []];
  const [concurrentA, concurrentB] = await Promise.all([0, 1].map((index) => createMssrOpenCodePlugin(
    { directory: "C:\\Dev\\salt-race-project" },
    {
      saltPath: emptySaltPath,
      sink: { async emit(event) { concurrentEvents[index].push(mssrHostCallEnvelopeSchema.parse(event)); } },
    },
  )));
  await Promise.all([concurrentA, concurrentB].map((hooks, index) => hooks.event({ event: {
    type: "message.part.updated",
    properties: { part: {
      type: "tool", sessionID: "shared-race-session", callID: `race-call-${index}`, tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } },
  } })));
  await waitFor(() => concurrentEvents.every((events) => events.length === 1));
  const healedSalt = (await fs.readFile(emptySaltPath, "utf8")).trim();
  assert.match(healedSalt, /^[a-f0-9]{64}$/, "an empty/corrupt machine salt is healed under the cross-process lock");
  assert.equal(
    concurrentEvents[0][0].host.sessionKey,
    concurrentEvents[1][0].host.sessionKey,
    "concurrent plugin creation preserves cross-process correlation",
  );

  const serializedSalt = JSON.stringify(saltEvents.concat(saltEventsB));
  for (const forbidden of ["shared-session-secret", "mssr-opencode-host-metadata-v1", storedSalt]) {
    assert.equal(serializedSalt.includes(forbidden), false, `salt regression leaked ${forbidden}`);
  }
} finally {
  await fs.rm(saltRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
}

// Even when the machine salt cannot be persisted, the plugin must keep working
// and must never degrade to a public, predictable salt.
{
  const saltBlockRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-salt-block-"));
  try {
    const blocker = path.join(saltBlockRoot, "not-a-dir");
    await fs.writeFile(blocker, "block", "utf8");
    const blockEvents = [];
    const diagnostics = [];
    const blockHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\salt-block-project" }, {
      saltPath: path.join(blocker, "nested", "salt.key"),
      onDiagnostic(diagnostic) { diagnostics.push(diagnostic); },
      sink: { async emit(event) { blockEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await blockHooks.event({ event: { type: "session.created", properties: { info: { id: "secret-session-degraded" } } } });
    await blockHooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "secret-session-degraded", callID: "degraded-call", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 5, end: 6 } },
    } } } });
    await waitFor(() => blockEvents.length === 1);
    assert.equal(blockEvents[0].host.sessionKey?.length, 64, "an unavailable salt location still yields a working, hashed plugin");
    const publicDefault = createHash("sha256").update("mssr-opencode-host-metadata-v1\0session\0secret-session-degraded").digest("hex");
    assert.notEqual(blockEvents[0].host.sessionKey, publicDefault, "a persistence failure must never fall back to the public default salt");
    assert.equal(JSON.stringify(blockEvents).includes("secret-session-degraded"), false, "degraded path still never leaks secrets");
    assert.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.code),
      ["mssr-opencode-salt-degraded"],
      "ephemeral correlation degradation is observable without exposing secrets",
    );
  } finally {
    await fs.rm(saltBlockRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

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
    salt: STRONG_SALT,
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
    saltPath: path.join(temporaryRoot, "machine-salt.key"),
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
  await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
}

// A low-entropy explicit option salt is rejected without ever logging its
// value, and the plugin falls back to a strong machine-local secret so it
// keeps working and correlating on this host.
{
  const weakRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-weak-salt-"));
  try {
    const weakSaltPath = path.join(weakRoot, "salt.key");
    const weakEvents = [];
    const weakDiagnostics = [];
    const weakHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\weak-project" }, {
      salt: "weak-salt",
      saltPath: weakSaltPath,
      onDiagnostic(diagnostic) { weakDiagnostics.push(diagnostic); },
      sink: { async emit(event) { weakEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await weakHooks.event({ event: { type: "session.created", properties: { info: { id: "weak-session-secret" } } } });
    await weakHooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "weak-session-secret", callID: "weak-call", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } } } });
    await waitFor(() => weakEvents.length === 1);
    assert.ok(
      weakDiagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-salt-rejected-weak"),
      "a weak explicit option salt is rejected with an observable diagnostic",
    );
    assert.ok(
      weakDiagnostics.every((diagnostic) => !JSON.stringify(diagnostic).includes("weak-salt")),
      "the rejected salt value is never logged",
    );
    assert.match((await fs.readFile(weakSaltPath, "utf8")).trim(), /^[a-f0-9]{64}$/, "fallback persists a strong machine-local secret");
    assert.equal(weakEvents[0].host.sessionKey?.length, 64, "the fallback secret still yields hashed host metadata");
    const weakSerialized = JSON.stringify(weakEvents);
    assert.equal(weakSerialized.includes("weak-salt"), false, "the weak salt never leaks into telemetry");
    assert.equal(weakSerialized.includes("weak-session-secret"), false, "host identifiers are still privacy-safe");
  } finally {
    await fs.rm(weakRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

// Canonical length alone is insufficient: a trivial 64-hex value is rejected
// by the structural minimum and never becomes the hashing key.
{
  const trivialRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-trivial-salt-"));
  try {
    const diagnostics = [];
    const events = [];
    const trivial = "0".repeat(64);
    const hooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\trivial-salt-project" }, {
      salt: trivial,
      saltPath: path.join(trivialRoot, "salt.key"),
      onDiagnostic(diagnostic) { diagnostics.push(diagnostic); },
      sink: { async emit(event) { events.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await hooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "trivial-session", callID: "trivial-call", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } } } });
    await waitFor(() => events.length === 1);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-salt-rejected-weak"));
    const predictable = createHash("sha256").update(`${trivial}\0session\0trivial-session`).digest("hex");
    assert.notEqual(events[0].host.sessionKey, predictable, "a trivial canonical-length salt is never accepted");
  } finally {
    await fs.rm(trivialRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

// The same strength rule applies to the env-provided salt, and it is never
// logged either.
{
  const envRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-env-salt-"));
  process.env.MSSR_OPENCODE_HASH_SALT = "tiny-env-salt";
  try {
    const envSaltPath = path.join(envRoot, "salt.key");
    const envEvents = [];
    const envDiagnostics = [];
    const envHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\env-salt-project" }, {
      saltPath: envSaltPath,
      onDiagnostic(diagnostic) { envDiagnostics.push(diagnostic); },
      sink: { async emit(event) { envEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await envHooks.event({ event: { type: "session.created", properties: { info: { id: "env-session-secret" } } } });
    await envHooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "env-session-secret", callID: "env-call", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } } } });
    await waitFor(() => envEvents.length === 1);
    assert.ok(
      envDiagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-salt-rejected-weak"),
      "a weak env salt is rejected",
    );
    assert.match((await fs.readFile(envSaltPath, "utf8")).trim(), /^[a-f0-9]{64}$/, "env fallback also persists a strong machine-local secret");
    assert.equal(JSON.stringify(envEvents).includes("tiny-env-salt"), false, "the weak env salt never logs");
  } finally {
    delete process.env.MSSR_OPENCODE_HASH_SALT;
    await fs.rm(envRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

// A strong env salt is accepted and drives key derivation.
{
  const strongEnvRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-env-strong-"));
  process.env.MSSR_OPENCODE_HASH_SALT = STRONG_SALT;
  try {
    const envDiagnostics = [];
    const envEvents = [];
    const envHooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\env-strong-project" }, {
      onDiagnostic(diagnostic) { envDiagnostics.push(diagnostic); },
      sink: { async emit(event) { envEvents.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await envHooks.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "env-strong-session", callID: "env-strong-call", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } } } });
    await waitFor(() => envEvents.length === 1);
    assert.ok(
      !envDiagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-salt-rejected-weak"),
      "a strong env salt is accepted without a rejection diagnostic",
    );
    const expected = createHash("sha256").update(`${STRONG_SALT}\0session\0env-strong-session`).digest("hex");
    assert.equal(envEvents[0].host.sessionKey, expected, "the strong env salt drives key derivation");
  } finally {
    delete process.env.MSSR_OPENCODE_HASH_SALT;
    await fs.rm(strongEnvRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

// Salt rotation is explicit and observable; it never silently destroys
// correlation. All processes after rotation agree on the new secret, and the
// prior secret is retained so old correlation stays resolvable.
{
  const rotRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-rotate-"));
  try {
    const saltPath = path.join(rotRoot, "salt.key");
    const eventsA = [];
    const hooksA = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\rotate-project" }, {
      saltPath,
      sink: { async emit(event) { eventsA.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await hooksA.event({ event: { type: "session.created", properties: { info: { id: "rotate-session" } } } });
    await hooksA.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "rotate-session", callID: "rotate-call-1", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 1, end: 2 } },
    } } } });
    await waitFor(() => eventsA.length === 1);
    const before = (await fs.readFile(saltPath, "utf8")).trim();
    const preKey = eventsA[0].host.sessionKey;

    const blockedPreviousPath = `${saltPath}.previous`;
    await fs.mkdir(blockedPreviousPath);
    await assert.rejects(
      rotateMachineSalt(saltPath),
      "rotation fails closed when the prior generation cannot be persisted",
    );
    assert.equal(
      (await fs.readFile(saltPath, "utf8")).trim(),
      before,
      "a failed rotation leaves the current secret authoritative",
    );
    await fs.rm(blockedPreviousPath, { recursive: true, force: true });

    const rotDiagnostics = [];
    const rotated = await rotateMachineSalt(saltPath, (diagnostic) => rotDiagnostics.push(diagnostic));
    const after = (await fs.readFile(saltPath, "utf8")).trim();
    assert.match(after, /^[a-f0-9]{64}$/, "rotated secret is a strong hex value");
    assert.equal(rotated, after, "rotation returns the persisted new secret");
    assert.notEqual(after, before, "rotation replaces the current machine secret");
    assert.ok(rotDiagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-salt-rotated"), "rotation is observable, never silent");
    assert.ok(rotDiagnostics.every((diagnostic) => !JSON.stringify(diagnostic).includes(before)), "rotation diagnostics never log the secret");
    assert.equal(
      (await fs.readFile(`${saltPath}.previous`, "utf8")).trim(),
      before,
      "the prior secret is retained so old correlation is not silently destroyed",
    );

    const eventsB = [];
    const hooksB = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\rotate-project" }, {
      saltPath,
      sink: { async emit(event) { eventsB.push(mssrHostCallEnvelopeSchema.parse(event)); } },
    });
    await hooksB.event({ event: { type: "session.created", properties: { info: { id: "rotate-session" } } } });
    await hooksB.event({ event: { type: "message.part.updated", properties: { part: {
      type: "tool", sessionID: "rotate-session", callID: "rotate-call-2", tool: "read",
      state: { status: "completed", output: "not stored", time: { start: 3, end: 4 } },
    } } } });
    await waitFor(() => eventsB.length === 1);
    const expectedAfter = createHash("sha256").update(`${after}\0session\0rotate-session`).digest("hex");
    assert.equal(eventsB[0].host.sessionKey, expectedAfter, "post-rotation processes agree on the new secret");
    assert.notEqual(eventsB[0].host.sessionKey, preKey, "rotation intentionally changes the emitted key");
  } finally {
    await fs.rm(rotRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

// State root follows conventional per-platform user-data paths.
{
  const darwinRoot = defaultStateRoot("darwin", "/Users/alice", null);
  assert.equal(
    darwinRoot,
    path.join("/Users/alice", "Library", "Application Support", "MauroPrime", "MSSR"),
    "macOS uses the conventional per-user Application Support path",
  );
  assert.equal(darwinRoot.includes(".local"), false, "macOS does not fall back to the linux .local/state path");
  assert.equal(
    defaultStateRoot("darwin", "/Users/alice", "C:\\unexpected"),
    darwinRoot,
    "macOS ignores a stray Windows LOCALAPPDATA value",
  );
  assert.equal(defaultStateRoot("linux", "/home/alice", null, null), path.join("/home/alice", ".local", "state", "mssr"), "linux keeps the default XDG-style state path");
  assert.equal(defaultStateRoot("linux", "/home/alice", null, "/state/alice"), path.join("/state/alice", "mssr"), "linux honors XDG_STATE_HOME");
  assert.equal(
    defaultStateRoot("win32", "C:\\Users\\alice", "C:\\Users\\alice\\AppData\\Local"),
    path.join("C:\\Users\\alice\\AppData\\Local", "MauroPrime", "MSSR"),
    "windows honors LOCALAPPDATA",
  );
}

// Windows ACL hardening is best-effort: it must not corrupt the secret, and an
// un-hardenable file yields a fail-safe diagnostic instead of failing init.
if (process.platform === "win32") {
  const aclRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-acl-"));
  try {
    const aclFile = path.join(aclRoot, "private.key");
    const secret = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
    await fs.writeFile(aclFile, secret, "utf8");
    const aclDiagnostics = [];
    await hardenPrivateFile(aclFile, (diagnostic) => aclDiagnostics.push(diagnostic));
    await hardenPrivateFile(aclFile, (diagnostic) => aclDiagnostics.push(diagnostic));
    assert.equal((await fs.readFile(aclFile, "utf8")).trim(), secret, "ACL hardening does not alter the secret content");
    assertPrivateFileHardeningOutcome(aclDiagnostics, "hardening a normal or already protected file is idempotent or explicitly degraded by host policy");

    const failDiagnostics = [];
    await hardenPrivateFile(path.join(aclRoot, "does-not-exist.key"), (diagnostic) => failDiagnostics.push(diagnostic));
    assert.ok(
      failDiagnostics.some((diagnostic) => diagnostic.code === "mssr-opencode-windows-acl-unavailable"),
      "an un-hardenable file yields a fail-safe diagnostic rather than failing plugin init",
    );
  } finally {
    await fs.rm(aclRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
} else {
  const modeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-mode-"));
  try {
    const modeFile = path.join(modeRoot, "private.key");
    await fs.writeFile(modeFile, STRONG_SALT, { encoding: "utf8", mode: 0o644 });
    await fs.chmod(modeFile, 0o644);
    await hardenPrivateFile(modeFile);
    assert.equal((await fs.stat(modeFile)).mode & 0o777, 0o600, "POSIX hardening fixes an existing permissive file");
  } finally {
    await fs.rm(modeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
  }
}

console.log("OpenCode host metadata plugin: PASS");
