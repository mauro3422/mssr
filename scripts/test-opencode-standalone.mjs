import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  CodexMssrAdapter,
  createOpenCodeMssrMcpServer,
  mssrTelemetryEnvelopeSchema,
} from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text);
  return JSON.parse(item.text);
}

const events = [];
const registry = new CapabilityRegistry([{
  id: "fixture",
  async refresh() {
    return { capabilities: [{
      id: "skill:fixture", name: "fixture-skill", kind: "skill", providerId: "fixture",
      description: "Review and verify code.",
      skill: { name: "fixture-skill", description: "Review and verify code.", source: "fixture" },
    }] };
  },
}]);
const adapter = new CodexMssrAdapter(registry, {
  caller: "opencode-local", source: "opencode-cli", tracePrefix: "mssr-opencode",
  telemetrySink: { async emit(event) { events.push(mssrTelemetryEnvelopeSchema.parse(event)); } },
});
await adapter.initialize();
const { server } = createOpenCodeMssrMcpServer(adapter);
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
await server.connect(serverTransport);
const client = new Client({ name: "opencode-fixture", version: "1.0.0" });
await client.connect(clientTransport);

const names = (await client.listTools()).tools.map((tool) => tool.name);
for (const name of ["mssr_route_plan", "mssr_skill_bootstrap", "mssr_trace_record", "mssr_trace_status", "mssr_registry_status"]) {
  assert.ok(names.includes(name), `missing ${name}`);
}

const input = {
  task: "Review code with evidence.",
  intent: {
    summary: "Review code with evidence.", domains: ["opencode", "coding"], actions: ["review", "verify"],
    artifacts: ["code"], needs: ["unit-tests"], signals: ["nominal"], risk: "read-only", ambiguity: "low",
  },
  stage: "start",
  model: "unknown",
  reasoningEffort: "unknown",
};
const route = json(await client.callTool({ name: "mssr_route_plan", arguments: input }));
assert.equal(route.caller, "opencode-local");
assert.match(route.traceId, /^mssr-opencode-/);
assert.equal(events.at(-1).event.kind, "route");
assert.equal("task" in events.at(-1).event, false, "telemetry must not contain raw task text");

const prematureOutcome = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success", primarySkill: "fixture-skill" },
}));
assert.equal(prematureOutcome.accepted, false, "A successful outcome requires an explicit close route even for read-only work");
assert.equal(
  prematureOutcome.violations.some((item) => item.code === "mssr-success-outcome-blocked-close"),
  true,
);

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
  name: "mssr_route_plan",
  arguments: { ...input, traceId: route.traceId, stage: "close", completedPhases: ["verification", "persistence"] },
}));
assert.equal(close.traceId, route.traceId);
let expectedCheckpointCount = 3;
if (close.lifecycle.maintenanceRequired) {
  const maintenance = json(await client.callTool({
    name: "mssr_trace_record",
    arguments: { traceId: route.traceId, eventType: "phase_completed", stage: "close", status: "success", completedPhases: ["maintenance"] },
  }));
  assert.equal(maintenance.accepted, true);
  expectedCheckpointCount += 1;
}

const outcome = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success", primarySkill: "fixture-skill" },
}));
assert.equal(outcome.accepted, true, "A read-only route without required loads may close after applicable gates complete");
assert.equal(events.filter((event) => event.event.kind === "checkpoint").length, expectedCheckpointCount, "outcome must be explicit, never automatic");

await client.close();
await server.close();
console.log("MSSR standalone OpenCode telemetry path: PASS");
