import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CapabilityRegistry, MSSR_TOOL_NAMES, createMssrMcpServer } from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return JSON.parse(item.text);
}

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

const rejectedUnknown = await client.callTool({
  name: "mssr_route_plan",
  arguments: {
    task: "A route that must reject unknown fields.",
    intent: { domains: ["coding"], actions: ["review"], signals: ["nominal"], risk: "read-only", ambiguity: "low" },
    unknownField: true,
  },
});
assert.equal(rejectedUnknown.isError, true, "native mssr_route_plan must reject unknown top-level fields");

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-native-context-plane-"));
const contextNow = new Date().toISOString();
try {
  await fs.mkdir(path.join(fixtureRoot, ".bridge"), { recursive: true });
  await fs.mkdir(path.join(fixtureRoot, "context"), { recursive: true });
  await fs.writeFile(
    path.join(fixtureRoot, ".bridge", "project-context-modules.json"),
    JSON.stringify({
      schemaVersion: 1,
      canonicalOwner: "native-fixture",
      core: [],
      modules: [{
        id: "review-guardrail",
        path: "context/review-guardrail.md",
        priority: 0,
        required: false,
        estimatedChars: 256,
        stages: ["start"],
        domains: ["coding"],
        actions: ["review"],
        signals: ["nominal"],
      }],
    }),
    "utf8",
  );
  await fs.writeFile(path.join(fixtureRoot, "context", "review-guardrail.md"), "# Review guardrail\n\nRead-only review evidence module.\n", "utf8");

  const noticeMessage = {
    id: "notice-native-001",
    kind: "continuation",
    severity: "info",
    title: "Native context-plane notice",
    summary: "Confirm review evidence before closing the trace.",
    evidence: [{
      kind: "verification",
      ref: "docs/native-verification.md",
      summary: "Native review evidence reference.",
      canonicalOwner: "native-fixture",
      provenance: "manual",
      freshness: "fresh",
      observedAt: contextNow,
    }],
    advisoryActions: ["verify-runtime"],
    stages: ["start"],
    domains: ["coding"],
    actions: ["review", "verify"],
    signals: ["nominal"],
    required: false,
    priority: 20,
    estimatedChars: 160,
  };

  const hostRoute = json(await client.callTool({
    name: "mssr_route_plan",
    arguments: {
      task: "Review a TypeScript helper read-only.",
      intent: { summary: "Review TypeScript code.", domains: ["coding"], actions: ["review", "verify"], artifacts: ["code"], needs: ["integrity-verification"], signals: ["nominal"], risk: "read-only", ambiguity: "low" },
      stage: "start",
      projectRoot: fixtureRoot,
      contextNow,
      contextMaxModules: 4,
      contextMessageMaxMessages: 4,
      contextMaxChars: 4000,
      contextMessages: [noticeMessage],
    },
  }));
  assert.equal(hostRoute.projectContext.advisoryOnly, true);
  assert.deepEqual(hostRoute.projectContext.core.map((record) => record.ref), []);
  assert.deepEqual(hostRoute.projectContext.selected.map((record) => record.ref), ["review-guardrail"]);
  assert.equal(hostRoute.contextMessages.advisoryOnly, true);
  assert.deepEqual(hostRoute.contextMessages.selected.map((message) => message.id), ["notice-native-001"]);
  assert.equal(hostRoute.inbox.saved, true);
  assert.deepEqual(hostRoute.inbox.enqueued, ["notice-native-001"]);
  assert.ok(hostRoute.projectContext.receipts.some((receipt) => receipt.messageId === "notice-native-001"));

  const inboxPath = path.join(fixtureRoot, ".bridge", "mssr-context-inbox.json");
  await fs.access(inboxPath);

  const ack = json(await client.callTool({
    name: "mssr_context_ack",
    arguments: { projectRoot: fixtureRoot, messageIds: ["notice-native-001"], now: contextNow },
  }));
  assert.equal(ack.advisoryOnly, true);
  assert.deepEqual(ack.acknowledged, ["notice-native-001"]);
  assert.deepEqual(ack.unknown, []);
  assert.equal(ack.saved, true);

  const reAck = json(await client.callTool({
    name: "mssr_context_ack",
    arguments: { projectRoot: fixtureRoot, messageIds: ["notice-native-001"], now: contextNow },
  }));
  assert.deepEqual(reAck.acknowledged, []);
  assert.deepEqual(reAck.unknown, ["notice-native-001"]);
  assert.equal(reAck.saved, false);

  const badAck = await client.callTool({
    name: "mssr_context_ack",
    arguments: { projectRoot: fixtureRoot, messageIds: Array.from({ length: 33 }, (_, i) => `notice.${String(i + 1001).padStart(4, "0")}`) },
  });
  assert.equal(badAck.isError, true, "mssr_context_ack must reject more than 32 message ids");
  const unknownAck = await client.callTool({
    name: "mssr_context_ack",
    arguments: { projectRoot: fixtureRoot, messageIds: ["..not-a-bounded-id"] },
  });
  assert.equal(unknownAck.isError, true, "mssr_context_ack must reject non-bounded message ids");
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

await client.close();
await server.close();
console.log(`mcp tests passed: ${listed.tools.length} tools`);
