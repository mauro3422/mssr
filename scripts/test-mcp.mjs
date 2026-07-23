import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CapabilityRegistry, MSSR_TOOL_NAMES, createMssrMcpServer } from "../dist/index.js";

assert.deepEqual(MSSR_TOOL_NAMES, ["mssr_registry_status", "mssr_capability_search", "mssr_capability_inspect", "mssr_route_plan", "mssr_route_audit"]);
const registry = new CapabilityRegistry([{ id: "test", async refresh() { return { capabilities: [] }; } }]);
const { server } = createMssrMcpServer(registry);
const client = new Client({ name: "mssr-test-client", version: "0.1.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
const listed = await client.listTools();
assert.deepEqual(listed.tools.map((tool) => tool.name), MSSR_TOOL_NAMES);
await client.close();
await server.close();
console.log(`mcp tests passed: ${listed.tools.length} tools`);
