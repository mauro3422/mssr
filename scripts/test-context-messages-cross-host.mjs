import assert from "node:assert/strict";
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
  maxContextMessageChars: 500,
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

for (const host of [native, codex, openCode]) {
  await host.client.close();
  await host.server.close();
}

console.log("MSSR Context Messages cross-host parity: PASS");
