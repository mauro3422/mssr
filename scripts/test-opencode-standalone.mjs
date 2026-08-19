import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  OpenCodeMssrAdapter,
  createOpenCodeMssrMcpServer,
  mssrTelemetryEnvelopeSchema,
} from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text);
  return JSON.parse(item.text);
}

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-opencode-standalone-"));
const contextNow = new Date().toISOString();
const noticeMessage = {
  id: "notice-review-001",
  kind: "continuation",
  severity: "info",
  title: "Standalone review notice",
  summary: "Confirm review evidence before closing the trace.",
  evidence: [{
    kind: "verification",
    ref: "docs/standalone-verification.md",
    summary: "Standalone review evidence reference.",
    canonicalOwner: "standalone-fixture",
    provenance: "manual",
    freshness: "fresh",
    observedAt: contextNow,
  }],
  advisoryActions: ["verify-runtime"],
  stages: ["start"],
  domains: ["coding"],
  actions: ["debug", "review", "verify"],
  signals: ["error-observed"],
  required: false,
  priority: 20,
  estimatedChars: 160,
};

try {
  await fs.mkdir(path.join(fixtureRoot, ".mssr"), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, "context"), { recursive: true });
  await fs.writeFile(
    path.join(fixtureRoot, ".mssr", "project-context.json"),
    JSON.stringify({
      schemaVersion: 1,
      core: [],
      modules: [{
        id: "review-guardrail",
        kind: "directive",
        topic: "operations",
        description: "Review guardrail fixture.",
        source: { path: "context/review-guardrail.md" },
        priority: 0,
        required: false,
        stages: ["start"],
        domains: ["coding"],
        actions: ["review"],
        signals: ["error-observed"],
      }],
    }),
    "utf8",
  );
  await fs.writeFile(
    path.join(fixtureRoot, "context", "review-guardrail.md"),
    "# Review guardrail\n\nRead-only review evidence module.\n",
    "utf8",
  );
  const skillDir = path.join(fixtureRoot, "systematic-debugging");
  await fs.mkdir(skillDir, { recursive: true });
  const skillPath = path.join(skillDir, "SKILL.md");
  await fs.writeFile(skillPath, "# Fixture Skill\n\n## Core\n\nCore host guidance.\n\n## Review Recipe\n\nSelective review recipe.\n", "utf8");
  await fs.writeFile(path.join(skillDir, "context-modules.json"), JSON.stringify({
    schemaVersion: 1,
    core: { sections: ["## Core"] },
    modules: [{ id: "review-recipe", description: "Review recipe", source: { sections: ["## Review Recipe"] }, actions: ["review"] }],
  }), "utf8");

  const events = [];
  const registry = new CapabilityRegistry([{
    id: "fixture",
    async refresh() {
      return { capabilities: [{
        id: "skill:fixture", name: "systematic-debugging", kind: "skill", providerId: "fixture",
        description: "Review and verify code.",
        skill: { name: "systematic-debugging", description: "Review and verify code.", source: "codex-local", path: skillPath },
      }] };
    },
  }]);
  const adapter = new OpenCodeMssrAdapter(registry, {
    telemetrySink: { async emit(event) { events.push(mssrTelemetryEnvelopeSchema.parse(event)); } },
  });
  await adapter.initialize();
  const { server } = createOpenCodeMssrMcpServer(adapter);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "opencode-fixture", version: "1.0.0" });
  await client.connect(clientTransport);

  const listedTools = await client.listTools();
  const names = listedTools.tools.map((tool) => tool.name);
  for (const name of ["mssr_route_plan", "mssr_skill_bootstrap", "mssr_trace_record", "mssr_trace_status", "mssr_registry_status"]) {
    assert.ok(names.includes(name), `missing ${name}`);
  }
  const bootstrapSchema = listedTools.tools.find((tool) => tool.name === "mssr_skill_bootstrap")?.inputSchema?.properties ?? {};
  for (const field of ["selectionMode", "skillDecisions", "contentMode", "includeReferences", "maxContextChars"]) {
    assert.ok(field in bootstrapSchema, `OpenCode bootstrap must inherit shared MSSR field ${field}`);
  }

  const input = {
    task: "Review code with evidence.",
    intent: {
      summary: "Review code with evidence.", domains: ["opencode", "coding"], actions: ["debug", "review", "verify"],
      artifacts: ["code"], needs: ["unit-tests"], signals: ["error-observed"], risk: "read-only", ambiguity: "low",
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
  const pendingBootstrap = json(await client.callTool({
    name: "mssr_skill_bootstrap",
    arguments: { ...input, traceId: route.traceId },
  }));
  assert.equal(pendingBootstrap.selection.mode, "host-gated", "OpenCode should inherit host-gated selection by default");
  assert.equal(pendingBootstrap.loaded.filter((item) => item.loaded).length, 0, "optional skills without a decision must remain outside context");
  assert.ok(pendingBootstrap.selection.pendingCandidates.some((item) => item.skill === "systematic-debugging"), JSON.stringify({ selection: pendingBootstrap.selection, activeSkills: pendingBootstrap.activeSkills }, null, 2));

  const acceptedBootstrap = json(await client.callTool({
    name: "mssr_skill_bootstrap",
    arguments: {
      ...input,
      traceId: route.traceId,
      skillDecisions: [{ skillName: "systematic-debugging", decision: "accepted", reasonCode: "useful", stage: "start" }],
    },
  }));
  const loadedFixture = acceptedBootstrap.loaded.find((item) => item.skill.name === "systematic-debugging");
  assert.equal(loadedFixture?.loaded, true, "accepted optional skill must load through the shared adapter");
  assert.equal(loadedFixture?.contextAssembly?.manifestStatus, "loaded");
  assert.deepEqual(loadedFixture?.contextAssembly?.selectedModules, ["review-recipe"]);
  assert.equal(loadedFixture?.content.includes("Selective review recipe."), true);


  const prematureOutcome = json(await client.callTool({
    name: "mssr_trace_record",
    arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success", primarySkill: "systematic-debugging" },
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
    arguments: { traceId: route.traceId, eventType: "outcome", stage: "close", status: "success", primarySkill: "systematic-debugging" },
  }));
  assert.equal(outcome.accepted, true, "A read-only route without required loads may close after applicable gates complete");
  assert.equal(events.filter((event) => event.event.kind === "checkpoint").length, expectedCheckpointCount, "outcome must be explicit, never automatic");

  const hostRoute = await adapter.route({
    ...input,
    projectRoot: fixtureRoot,
    contextNow,
    contextMaxModules: 4,
    contextMessageMaxMessages: 4,
    contextMessages: [noticeMessage],
  });
  assert.equal(hostRoute.projectContext.advisoryOnly, true);
  assert.deepEqual(hostRoute.projectContext.core.map((record) => record.ref), []);
  assert.deepEqual(hostRoute.projectContext.selected.map((record) => record.ref), ["review-guardrail"]);
  assert.equal(hostRoute.contextMessages.advisoryOnly, true);
  assert.deepEqual(hostRoute.contextMessages.selected.map((message) => message.id), ["notice-review-001"]);
  assert.equal(hostRoute.inbox.saved, true);
  assert.deepEqual(hostRoute.inbox.enqueued, ["notice-review-001"]);
  assert.deepEqual(hostRoute.inbox.prunedMessageIds, []);
  assert.ok(hostRoute.projectContext.receipts.some((receipt) => receipt.messageId === "notice-review-001"));
  const inboxPath = path.join(fixtureRoot, ".mssr", "runtime", "context-inbox.json");
  await fs.access(inboxPath);

  const ack = await adapter.acknowledgeContextMessages(fixtureRoot, ["notice-review-001"], contextNow);
  assert.equal(ack.advisoryOnly, true);
  assert.deepEqual(ack.acknowledged, ["notice-review-001"]);
  assert.deepEqual(ack.unknown, []);
  assert.equal(ack.saved, true);
  await fs.access(inboxPath);
  const reAck = await adapter.acknowledgeContextMessages(fixtureRoot, ["notice-review-001"], contextNow);
  assert.deepEqual(reAck.acknowledged, []);
  assert.deepEqual(reAck.unknown, ["notice-review-001"]);
  assert.equal(reAck.saved, false);

  await client.close();
  await server.close();
  console.log("MSSR standalone OpenCode telemetry path: PASS");
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}