import assert from "node:assert/strict";
import {
  CapabilityRegistry,
  McpToolsProvider,
} from "../dist/index.js";

let listed = [
  {
    name: "first_tool",
    description: "Initial tool.",
    inputSchema: { type: "object", properties: { value: { type: "string" } } },
  },
];
let changed;
let fail = false;
let closes = 0;
let listCalls = 0;
let pauseNextList = false;
let releasePausedList;

const provider = new McpToolsProvider({
  id: "fixture-mcp",
  source: "mcp:fixture",
  location: "test-client",
  catalogTtlMs: 50,
  async clientFactory(onToolsChanged) {
    changed = onToolsChanged;
    return {
      client: {
        async listTools(request) {
          listCalls += 1;
          if (fail) throw new Error("fixture offline");
          // Capture the server view before pausing to reproduce a notification
          // racing a tools/list response.
          const responseTools = listed;
          if (pauseNextList) {
            pauseNextList = false;
            await new Promise((resolve) => { releasePausedList = resolve; });
          }
          if (request?.cursor === "page-2") return { tools: responseTools.slice(1) };
          return responseTools.length > 1
            ? { tools: responseTools.slice(0, 1), nextCursor: "page-2" }
            : { tools: responseTools };
        },
      },
      async close() {
        closes += 1;
      },
    };
  },
});

async function eventually(predicate, message) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(message);
}

assert.equal("callTool" in provider, false, "provider must not expose tool execution");
const registry = new CapabilityRegistry([provider]);
const initial = await registry.refresh();
assert.equal(initial.capabilities.length, 1);
assert.equal(initial.capabilities[0].id, "fixture-mcp:tool:first_tool");
assert.equal(initial.capabilities[0].source, "mcp:fixture");
assert.equal(initial.capabilities[0].location, "test-client");
assert.deepEqual(initial.capabilities[0].schema, listed[0].inputSchema);
assert.equal(initial.providers[0].status, "healthy");
assert.equal(initial.providers[0].freshness, "fresh");
assert.equal(initial.providers[0].ttlMs, 50);
assert.ok(Number.isFinite(Date.parse(initial.providers[0].observedAt)));

listed = [
  ...listed,
  { name: "second_tool", description: "Changed tool.", inputSchema: { type: "object" } },
];
changed();
await eventually(
  () => registry.getSnapshot().capabilities.some((capability) => capability.name === "second_tool"),
  "tools/list_changed must refresh the registered provider",
);

const callsBeforeRace = listCalls;
pauseNextList = true;
const racingRefresh = registry.refresh();
await eventually(() => typeof releasePausedList === "function", "fixture refresh must begin before racing notification");
listed = [
  ...listed,
  { name: "third_tool", description: "Arrived during list.", inputSchema: { type: "object" } },
];
changed();
releasePausedList();
await racingRefresh;
await eventually(
  () => registry.getSnapshot().capabilities.some((capability) => capability.name === "third_tool"),
  "a tools/list_changed notification during a list must schedule a follow-up refresh",
);
assert.ok(listCalls >= callsBeforeRace + 2, "notification during an in-flight list must not be lost");

await new Promise((resolve) => setTimeout(resolve, 80));
const expired = registry.getSnapshot();
assert.equal(expired.providers[0].freshness, "stale", "TTL expiry must be visible without a refresh");
assert.equal(expired.providers[0].usingCachedCapabilities, true);
assert.equal(expired.lastChange?.kind, "provider-catalog-stale");

fail = true;
changed();
await eventually(
  () => registry.getSnapshot().providers[0]?.status === "degraded",
  "failed refresh must mark the provider degraded",
);
const degraded = registry.getSnapshot();
assert.equal(degraded.providers[0].usingCachedCapabilities, true);
assert.equal(degraded.providers[0].freshness, "stale");
assert.equal(degraded.capabilities.length, 3, "failed refresh must retain the last good catalog");
assert.match(degraded.providers[0].warning ?? "", /fixture offline/);
assert.equal(degraded.lastChange?.kind, "provider-refresh-failed");

const loopingProvider = new McpToolsProvider({
  id: "looping-mcp",
  async clientFactory() {
    return {
      client: {
        async listTools() { return { tools: [], nextCursor: "again" }; },
      },
      async close() {},
    };
  },
});
await assert.rejects(() => loopingProvider.refresh(), /repeated pagination cursor/);
await loopingProvider.close();

await registry.close();
assert.equal(closes, 1, "registry close must release provider resources");
console.log("mcp tools provider tests passed");
