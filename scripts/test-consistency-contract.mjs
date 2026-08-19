import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  MSSR_CONSISTENCY_TOOL_NAMES,
  OpenCodeMssrAdapter,
  createCodexMssrMcpServer,
  createMssrMcpServer,
  createOpenCodeMssrMcpServer,
} from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return JSON.parse(item.text);
}

async function connect(kind) {
  const registry = new CapabilityRegistry([{ id: `${kind}-empty`, async refresh() { return { capabilities: [] }; } }]);
  let created;
  if (kind === "native") created = createMssrMcpServer(registry);
  else if (kind === "codex") created = createCodexMssrMcpServer();
  else {
    const adapter = new OpenCodeMssrAdapter(registry);
    await adapter.initialize();
    created = createOpenCodeMssrMcpServer(adapter);
  }
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await created.server.connect(serverTransport);
  const client = new Client({ name: `mssr-consistency-${kind}`, version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return { ...created, client };
}

const hosts = {
  native: await connect("native"),
  codex: await connect("codex"),
  opencode: await connect("opencode"),
};

try {
  const schemas = {};
  for (const [kind, host] of Object.entries(hosts)) {
    const listed = await host.client.listTools();
    for (const name of MSSR_CONSISTENCY_TOOL_NAMES) {
      const tool = listed.tools.find((item) => item.name === name);
      assert.ok(tool, `${kind} missing shared C2c tool ${name}`);
      schemas[`${kind}:${name}`] = tool.inputSchema;
    }
  }
  for (const name of MSSR_CONSISTENCY_TOOL_NAMES) {
    assert.deepEqual(schemas[`codex:${name}`], schemas[`native:${name}`], `${name} schema drift: Codex`);
    assert.deepEqual(schemas[`opencode:${name}`], schemas[`native:${name}`], `${name} schema drift: OpenCode`);
  }

  const historicalArgs = {
    boundary: "context-load",
    observations: [
      { key: "bridge.release-version", observer: "package.json", role: "source", authority: "canonical", state: "observed", value: "0.6.102" },
      { key: "bridge.release-version", observer: "receipt:old-execution", role: "receipt", authority: "historical", state: "observed", value: "0.6.99" },
    ],
  };
  const staleReleaseArgs = {
    boundary: "post-restart",
    observations: [
      { key: "bridge.release-version", observer: "package.json", role: "source", authority: "canonical", state: "observed", value: "0.6.102" },
      { key: "bridge.release-version", observer: "src/config.ts", role: "source", authority: "replica", state: "observed", value: "0.6.102", required: true },
      { key: "bridge.release-version", observer: "dist/config.js", role: "generated", authority: "replica", state: "observed", value: "0.6.101", required: true },
      { key: "bridge.release-version", observer: "live-runtime", role: "runtime", authority: "replica", state: "observed", value: "0.6.101", required: true },
    ],
  };

  let historicalBaseline = null;
  let releaseBaseline = null;
  for (const [kind, host] of Object.entries(hosts)) {
    const historical = json(await host.client.callTool({ name: "mssr_consistency_evaluate", arguments: historicalArgs }));
    const release = json(await host.client.callTool({ name: "mssr_consistency_evaluate", arguments: staleReleaseArgs }));

    assert.equal(historical.level, "review", `${kind} historical mismatch level`);
    assert.deepEqual(historical.reasonCodes, ["historical-claim-stale", "receipt-claim-mismatch"]);
    assert.equal(historical.recommendationPolicy, "evidence-first-v1");
    assert.equal(historical.nextAction, "revalidate-context-evidence");
    assert.equal(historical.recommendations[0].status, "ready");
    assert.equal(historical.advisoryOnly, true);
    assert.equal(release.level, "error", `${kind} stale release level`);
    assert.equal(release.reasonCodes.includes("generated-artifact-mismatch"), true);
    assert.equal(release.reasonCodes.includes("runtime-state-mismatch"), true);
    assert.equal(release.nextAction, "rebuild-generated-artifact");
    assert.equal(release.recommendationMode, "repair");
    assert.equal(release.recommendations.find((item) => item.action === "verify-live-runtime")?.status, "deferred");
    assert.equal(release.recommendedActions.includes("rebuild-generated-artifact"), true);
    assert.equal(release.recommendedActions.includes("verify-live-runtime"), true);

    if (!historicalBaseline) historicalBaseline = historical;
    else assert.deepEqual(historical, historicalBaseline, `${kind} historical projection must match native exactly`);
    if (!releaseBaseline) releaseBaseline = release;
    else assert.deepEqual(release, releaseBaseline, `${kind} release projection must match native exactly`);
  }
} finally {
  await Promise.all(Object.values(hosts).map(({ client, server }) => Promise.allSettled([client.close(), server.close()])));
}

console.log("MSSR C2c consistency cross-host contract: PASS");
