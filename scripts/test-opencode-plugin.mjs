import assert from "node:assert/strict";
import { createMssrOpenCodePlugin, mssrHostCallEnvelopeSchema } from "../dist/index.js";

const events = [];
const hooks = await createMssrOpenCodePlugin({ directory: "C:\\Dev\\fixture-project" }, {
  salt: "fixture-salt",
  now: () => new Date("2026-08-08T19:00:00.000Z"),
  sink: { async emit(event) { events.push(mssrHostCallEnvelopeSchema.parse(event)); } },
});

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

assert.equal(events.length, 2, "terminal calls must be deduplicated by call ID");
assert.equal(events[0].traceId, "mssr-opencode-fixture-trace");
assert.equal(events[1].traceId, "mssr-opencode-fixture-trace");
assert.equal(events[1].host.agent, "build");
assert.equal(events[1].host.model, "opencode/deepseek-v4-flash-free");
assert.equal(events[1].host.reasoningEffort, "high");
assert.equal(events[1].host.variant, "high");
assert.equal(events[1].tool.status, "error");
assert.equal(events[1].tool.durationMs, 600);
const serialized = JSON.stringify(events);
for (const forbidden of ["raw-session-secret", "raw-user-message", "raw-shell-call", "must-not-leak", "token=secret", "private"]) {
  assert.equal(serialized.includes(forbidden), false, `private value leaked: ${forbidden}`);
}

console.log("OpenCode host metadata plugin: PASS");
