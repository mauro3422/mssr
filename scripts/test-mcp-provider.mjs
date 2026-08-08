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

const provider = new McpToolsProvider({
  id: "fixture-mcp",
  source: "mcp:fixture",
  location: "test-client",
  async clientFactory(onToolsChanged) {
    changed = onToolsChanged;
    return {
      client: {
        async listTools() {
          if (fail) throw new Error("fixture offline");
          return { tools: listed };
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

fail = true;
changed();
await eventually(
  () => registry.getSnapshot().providers[0]?.status === "degraded",
  "failed refresh must mark the provider degraded",
);
const degraded = registry.getSnapshot();
assert.equal(degraded.providers[0].usingCachedCapabilities, true);
assert.equal(degraded.capabilities.length, 2, "failed refresh must retain the last good catalog");
assert.match(degraded.providers[0].warning ?? "", /fixture offline/);

await registry.close();
assert.equal(closes, 1, "registry close must release provider resources");
console.log("mcp tools provider tests passed");
