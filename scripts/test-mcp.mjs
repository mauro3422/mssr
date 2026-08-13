import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CapabilityRegistry, MSSR_TOOL_NAMES, createMssrMcpServer } from "../dist/index.js";

const registry = new CapabilityRegistry([{ id: "test", async refresh() { return { capabilities: [] }; } }]);
const { server } = createMssrMcpServer(registry);
const client = new Client({ name: "mssr-test-client", version: "0.2.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

const listed = await client.listTools();
const toolNames = listed.tools.map((tool) => tool.name);
for (const name of MSSR_TOOL_NAMES) {
  assert.equal(toolNames.includes(name), true, `missing ${name}`);
}

const normalized = await client.callTool({
  name: "mssr_intent_normalize",
  arguments: { intent: { domains: ["coding"], actions: ["inspect"], risk: "read" } },
});
const normalizedText = normalized.content.find((entry) => entry.type === "text")?.text;
assert.ok(normalizedText);
assert.equal(JSON.parse(normalizedText).status, "normalized");

const vocabulary = await client.callTool({ name: "mssr_vocabulary", arguments: {} });
const vocabularyText = vocabulary.content.find((entry) => entry.type === "text")?.text;
assert.ok(vocabularyText);
assert.equal(JSON.parse(vocabularyText).traceContract, "trace-contract-v1");
assert.equal(JSON.parse(vocabularyText).routing.skillSources.includes("mssr-first-party"), true);

const reduced = await client.callTool({
  name: "mssr_trace_reduce",
  arguments: { event: { type: "route", route: { stage: "start", activeSkills: [] } } },
});
const reducedText = reduced.content.find((entry) => entry.type === "text")?.text;
assert.ok(reducedText);
const state = JSON.parse(reducedText).state;
assert.equal(state.routeCount, 1);

const preflight = await client.callTool({
  name: "mssr_trace_validate",
  arguments: { state, checkpoint: { eventType: "outcome", stage: "close", status: "success" } },
});
const preflightText = preflight.content.find((entry) => entry.type === "text")?.text;
assert.ok(preflightText);
assert.equal(
  JSON.parse(preflightText).violations.some((item) => item.code === "mssr-success-outcome-blocked-close"),
  true,
);

const closedRoute = await client.callTool({
  name: "mssr_trace_reduce",
  arguments: { state, event: { type: "route", route: { stage: "close", activeSkills: [] } } },
});
const closedRouteText = closedRoute.content.find((entry) => entry.type === "text")?.text;
assert.ok(closedRouteText);

const validation = await client.callTool({
  name: "mssr_trace_validate",
  arguments: { state: JSON.parse(closedRouteText).state, checkpoint: { eventType: "outcome", stage: "close", status: "success" } },
});
const validationText = validation.content.find((entry) => entry.type === "text")?.text;
assert.ok(validationText);
assert.deepEqual(JSON.parse(validationText).violations, []);

await client.close();
await server.close();
console.log(`mcp tests passed: ${listed.tools.length} tools`);
