import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createCodexMssrMcpServer } from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return JSON.parse(item.text);
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const { server } = createCodexMssrMcpServer();
await server.connect(serverTransport);
const client = new Client({ name: "mssr-standalone-test", version: "1.0.0" }, { capabilities: {} });
await client.connect(clientTransport);

const tools = await client.listTools();
const names = tools.tools.map((tool) => tool.name);
for (const expected of ["skill_route_plan", "skill_bootstrap", "mssr_trace_record", "mssr_trace_status"]) {
  assert.equal(names.includes(expected), true, `Missing ${expected}`);
}

const input = {
  task: "Review a TypeScript helper and verify its behavior without modifying files.",
  intent: {
    summary: "Review TypeScript code read-only.",
    domains: ["coding"], actions: ["review", "verify"], artifacts: ["code"],
    needs: ["integrity-verification"], signals: ["nominal"], risk: "read-only", ambiguity: "low",
  },
  stage: "start",
};
const route = json(await client.callTool({ name: "skill_route_plan", arguments: input }));
assert.ok(route.traceId);
assert.equal(route.caller, "codex-local");

const bootstrap = json(await client.callTool({
  name: "skill_bootstrap", arguments: { ...input, traceId: route.traceId },
}));
assert.equal(bootstrap.traceId, route.traceId);
assert.ok(bootstrap.loaded.length > 0, "Expected at least one loaded skill");

const verification = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "verification", stage: "verify", status: "success", verificationPassed: true },
}));
assert.equal(verification.accepted, true);

const persistence = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "persistence", stage: "persist", status: "success", persisted: true },
}));
assert.equal(persistence.accepted, true);

const close = json(await client.callTool({
  name: "skill_route_plan",
  arguments: { ...input, traceId: route.traceId, stage: "close", completedPhases: ["discovery", "verification", "persistence"] },
}));
assert.equal(close.traceId, route.traceId);
if (close.lifecycle.maintenanceRequired) {
  const maintenance = json(await client.callTool({
    name: "mssr_trace_record",
    arguments: { traceId: route.traceId, eventType: "phase_completed", stage: "close", status: "success", completedPhases: ["discovery", "verification", "persistence", "maintenance"] },
  }));
  assert.equal(maintenance.accepted, true);
}

const outcome = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success" },
}));
assert.equal(outcome.accepted, true);

const status = json(await client.callTool({ name: "mssr_trace_status", arguments: { traceId: route.traceId } }));
assert.equal(status.state.closed, true);
console.log("MSSR standalone Codex path: PASS");

await client.close();
await server.close();
