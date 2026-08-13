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
for (const expected of ["skill_route_plan", "skill_bootstrap", "mssr_trace_record", "mssr_trace_working_update", "mssr_trace_status"]) {
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

const optionalSkills = route.activeSkills.filter((skill) => !skill.required);
const acceptedOptional = optionalSkills.at(0)?.name;
const skillDecisions = optionalSkills.map((skill, index) => ({
  skillName: skill.name,
  decision: index === 0 ? "accepted" : "skipped",
  reasonCode: index === 0 ? "useful" : "irrelevant-domain",
  stage: "start",
}));
const bootstrap = json(await client.callTool({
  name: "skill_bootstrap", arguments: {
    ...input,
    traceId: route.traceId,
    selectionMode: "host-gated",
    skillDecisions,
  },
}));
assert.equal(bootstrap.traceId, route.traceId);
const loadedNames = new Set(bootstrap.loaded.filter((item) => item.loaded).map((item) => item.skill.name));
for (const skill of route.activeSkills.filter((item) => item.required)) assert.equal(loadedNames.has(skill.name), true);
for (const skill of optionalSkills.slice(1)) assert.equal(loadedNames.has(skill.name), false, `Skipped optional ${skill.name} must not load`);
if (acceptedOptional) assert.equal(loadedNames.has(acceptedOptional), true);

const working = json(await client.callTool({
  name: "mssr_trace_working_update",
  arguments: {
    traceId: route.traceId,
    workingMemory: {
      workingSummary: "Testing host-gated selection and lifecycle closure.",
      hypotheses: [{ summary: "Optional skipped skills remain outside context.", status: "supported" }],
      decisions: [{ subject: "bootstrap", decision: "host-gated", reason: "Separate recommendation from loading." }],
      nextGate: "verification",
    },
  },
}));
assert.equal(working.accepted, true);

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
assert.equal(status.workingMemory, null, "Ephemeral working memory must be purged after outcome");
assert.equal(status.closure.nextRequiredAction, "none");
console.log("MSSR standalone Codex path: PASS");

await client.close();
await server.close();
