import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  CodexMssrAdapter,
  createCodexMssrMcpServer,
  createMssrMcpServer,
  createOpenCodeMssrMcpServer,
} from "../dist/index.js";

function emptyRegistry() {
  return new CapabilityRegistry([{ id: "context-message-fixture", async refresh() { return { capabilities: [] }; } }]);
}

async function connect(created, name) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await created.server.connect(serverTransport);
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return { ...created, client };
}

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected a text MCP response");
  return JSON.parse(item.text);
}

const intent = {
  summary: "Review a context-plane code change.",
  domains: ["coding", "skill-system"],
  actions: ["review", "verify"],
  artifacts: ["code", "mcp"],
  needs: ["integrity-verification"],
  signals: ["nominal"],
  risk: "read-only",
  ambiguity: "low",
};

const evidence = {
  kind: "architecture-decision",
  ref: "docs/decisions/0001-context-plane-v1.md",
  summary: "The portable core owns selection semantics.",
  canonicalOwner: "mssr",
  provenance: "project",
  freshness: "fresh",
  revision: "fixture-rev-1",
};

const contextMessages = [
  {
    id: "context.architecture",
    kind: "architecture-decision",
    severity: "info",
    title: "Use portable selection",
    summary: "Keep host adapters free of persistence and queue semantics.",
    evidence: [evidence],
    advisoryActions: ["inspect-reference"],
    stages: ["start"],
    domains: ["coding"],
    actions: ["review"],
    artifacts: [], needs: [], signals: [],
    required: false,
    priority: 10,
    estimatedChars: 180,
  },
  {
    id: "context.required-continuation",
    kind: "continuation",
    severity: "attention",
    title: "Resume the active gate",
    summary: "Verification remains the next gate.",
    evidence: [], advisoryActions: ["resume-trace"],
    continuation: {
      freshness: "unknown",
      unresolvedRefs: ["verification"],
      sourceReceipts: [],
      currentStage: "start",
      completedPhases: ["discovery"],
      nextGate: "verification",
      summary: "Portable context-message parity is under verification.",
    },
    stages: [], domains: [], actions: [], artifacts: [], needs: [], signals: [],
    required: true,
    priority: 0,
    estimatedChars: 200,
  },
  {
    id: "context.unrelated",
    kind: "related-incident",
    severity: "warning",
    title: "Unrelated runtime incident",
    summary: "This message must remain unselected for the current intent.",
    evidence: [{ ...evidence, kind: "incident", ref: "incidents/unrelated.md" }],
    advisoryActions: ["inspect-reference"],
    stages: [], domains: ["roblox"], actions: [], artifacts: [], needs: [], signals: [],
    required: false,
    priority: 100,
    estimatedChars: 160,
  },
];

const input = {
  task: "Review portable Context Messages parity.",
  intent,
  stage: "start",
  contextMessages,
  maxContextMessages: 2,
  maxContextMessageChars: 2_000,
};

const native = await connect(createMssrMcpServer(emptyRegistry()), "native-context-test");
const codexAdapter = new CodexMssrAdapter(emptyRegistry());
await codexAdapter.initialize();
const codex = await connect(createCodexMssrMcpServer(codexAdapter), "codex-context-test");
const openCodeAdapter = new CodexMssrAdapter(emptyRegistry(), { caller: "opencode-local", source: "opencode-cli" });
await openCodeAdapter.initialize();
const openCode = await connect(createOpenCodeMssrMcpServer(openCodeAdapter), "opencode-context-test");

const nativeRoute = json(await native.client.callTool({ name: "mssr_route_plan", arguments: input }));
const codexRoute = json(await codex.client.callTool({ name: "skill_route_plan", arguments: input }));
const openCodeRoute = json(await openCode.client.callTool({ name: "mssr_route_plan", arguments: input }));
const codexBootstrap = json(await codex.client.callTool({ name: "skill_bootstrap", arguments: input }));
const openCodeBootstrap = json(await openCode.client.callTool({ name: "mssr_skill_bootstrap", arguments: input }));

const portable = (result) => ({
  ids: result.contextMessages.selected.map((message) => message.id),
  decisions: result.contextMessages.decisions,
  receipts: result.contextMessages.continuationReceipts,
  advisoryOnly: result.contextMessages.advisoryOnly,
});
const expected = portable(nativeRoute);
assert.deepEqual(expected.ids, ["context.required-continuation", "context.architecture"]);
assert.equal(expected.advisoryOnly, true);
for (const result of [codexRoute, openCodeRoute, codexBootstrap, openCodeBootstrap]) {
  assert.deepEqual(portable(result), expected, "All hosts must return the same portable selection and decisions");
}

const invalidInput = {
  ...input,
  contextMessages: [{ ...contextMessages[0], rawPrompt: "must be rejected" }],
};
for (const [client, tool] of [
  [native.client, "mssr_route_plan"],
  [codex.client, "skill_route_plan"],
  [openCode.client, "mssr_route_plan"],
]) {
  const result = await client.callTool({ name: tool, arguments: invalidInput });
  assert.equal(result.isError, true, `${tool} must reject non-contract message fields`);
}

for (const [client, tool] of [
  [native.client, "mssr_route_plan"],
  [codex.client, "skill_route_plan"],
  [openCode.client, "mssr_route_plan"],
]) {
  const result = await client.callTool({ name: tool, arguments: { ...input, unknownField: true } });
  assert.equal(result.isError, true, `${tool} must reject unknown top-level fields`);
}

async function seedFixture(root) {
  await fs.mkdir(path.join(root, ".mssr"), { recursive: true });
  await fs.mkdir(path.join(root, "context"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".mssr", "project-context.json"),
    JSON.stringify({
      schemaVersion: 1,
      core: [],
      modules: [{
        id: "review-guardrail",
        kind: "directive",
        topic: "operations",
        area: "review",
        description: "Cross-host review guardrail fixture.",
        source: { path: "context/review-guardrail.md" },
        priority: 0,
        required: false,
        stages: ["start"],
        domains: ["coding"],
        actions: ["review"],
        signals: ["nominal"],
      }],
    }),
    "utf8",
  );
  await fs.writeFile(path.join(root, "context", "review-guardrail.md"), "# Review guardrail\n\nRead-only context module.\n", "utf8");
}

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-cross-host-plane-"));
const contextNow = new Date().toISOString();
try {
  await seedFixture(fixtureRoot);

  const hostInput = {
    ...input,
    projectRoot: fixtureRoot,
    contextNow,
    contextMaxModules: 8,
    contextMaxChars: 4000,
    contextMessageMaxMessages: 4,
    contextMessageMaxChars: 6000,
  };

  const nativeHostRoute = json(await native.client.callTool({ name: "mssr_route_plan", arguments: hostInput }));
  const codexHostRoute = json(await codex.client.callTool({ name: "skill_route_plan", arguments: hostInput }));
  const openCodeHostRoute = json(await openCode.client.callTool({ name: "mssr_route_plan", arguments: hostInput }));
  const codexHostBootstrap = json(await codex.client.callTool({ name: "skill_bootstrap", arguments: hostInput }));
  const openCodeHostBootstrap = json(await openCode.client.callTool({ name: "mssr_skill_bootstrap", arguments: hostInput }));

  const plane = (result) => ({
    ids: result.contextMessages.selected.map((message) => message.id),
    decisions: result.contextMessages.decisions,
    receipts: result.contextMessages.continuationReceipts,
    projectModules: result.projectContext.selected.map((record) => record.ref),
    projectCore: result.projectContext.core.map((record) => record.ref),
    deliveryIds: result.projectContext.receipts.map((receipt) => receipt.messageId).sort(),
    advisoryOnly: result.contextMessages.advisoryOnly,
  });
  const expectedPlane = plane(nativeHostRoute);
  assert.deepEqual(expectedPlane.ids, ["context.required-continuation", "context.architecture"]);
  assert.deepEqual(expectedPlane.projectModules, ["review-guardrail"]);
  assert.deepEqual(expectedPlane.projectCore, []);
  assert.equal(expectedPlane.advisoryOnly, true);
  for (const result of [codexHostRoute, openCodeHostRoute, codexHostBootstrap, openCodeHostBootstrap]) {
    assert.deepEqual(plane(result), expectedPlane, "All hosts must return the same project context plane and portable selection");
  }

  const inboxPath = path.join(fixtureRoot, ".mssr", "runtime", "context-inbox.json");
  await fs.access(inboxPath);

  async function verifyAckPersistence(host, routeTool, root) {
    await host.client.callTool({ name: routeTool, arguments: { ...hostInput, projectRoot: root } });
    const ack = json(await host.client.callTool({
      name: "mssr_context_ack",
      arguments: { projectRoot: root, messageIds: ["context.required-continuation"], now: contextNow },
    }));
    assert.equal(ack.advisoryOnly, true);
    assert.deepEqual(ack.acknowledged, ["context.required-continuation"]);
    assert.deepEqual(ack.unknown, []);
    assert.equal(ack.saved, true, `ack must persist on ${routeTool}`);
    await fs.access(path.join(root, ".mssr", "runtime", "context-inbox.json"));
    const reAck = json(await host.client.callTool({
      name: "mssr_context_ack",
      arguments: { projectRoot: root, messageIds: ["context.required-continuation"], now: contextNow },
    }));
    assert.deepEqual(reAck.acknowledged, []);
    assert.deepEqual(reAck.unknown, ["context.required-continuation"]);
    assert.equal(reAck.saved, false, `re-ack must not persist on ${routeTool}`);
  }

  for (const [host, routeTool] of [
    [native, "mssr_route_plan"],
    [codex, "skill_route_plan"],
    [openCode, "mssr_route_plan"],
  ]) {
    const ackRoot = await fs.mkdtemp(path.join(os.tmpdir(), `mssr-ack-${routeTool}-`));
    try {
      await seedFixture(ackRoot);
      await verifyAckPersistence(host, routeTool, ackRoot);
    } finally {
      await fs.rm(ackRoot, { recursive: true, force: true });
    }
  }
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

for (const host of [native, codex, openCode]) {
  await host.client.close();
  await host.server.close();
}

console.log("MSSR Context Messages cross-host parity: PASS");
