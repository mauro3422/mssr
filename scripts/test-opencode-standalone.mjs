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

const failedOutcome = json(await client.callTool({
  name: "mssr_trace_record",
  arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success", primarySkill: "fixture-skill" },
}));
assert.equal(failedOutcome.accepted, true, "A read-only route without required loads may close explicitly");
assert.equal(events.filter((event) => event.event.kind === "checkpoint").length, 1, "outcome must be explicit, never automatic");

await client.close();
await server.close();
console.log("MSSR standalone OpenCode telemetry path: PASS");
