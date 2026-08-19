import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  MSSR_NOTICE_SCHEMA_VERSION,
  MSSR_OPERATIONAL_NOTICE_TOOL_NAMES,
  OpenCodeMssrAdapter,
  createCodexMssrMcpServer,
  createMssrMcpServer,
  createOpenCodeMssrMcpServer,
  mssrNoticeV1Schema,
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
  const client = new Client({ name: `mssr-notice-${kind}`, version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return { ...created, client };
}

const hosts = {
  native: await connect("native"),
  codex: await connect("codex"),
  opencode: await connect("opencode"),
};

const toolName = MSSR_OPERATIONAL_NOTICE_TOOL_NAMES[0];
const base = {
  subject: "project:alpha",
  source: "project-health",
  code: "mssr-project-review",
  resolutionCode: "mssr-project-resolved",
  message: "Project evidence requires review.",
  resolutionMessage: "Project evidence is coherent again.",
  recommendation: "Inspect the bounded evidence before acting.",
};

const cases = [
  ["opened", { ...base, previousLevel: "ok", currentLevel: "review", previousFingerprint: "fp-old", currentFingerprint: "fp-new" }],
  ["stable-review", { ...base, previousLevel: "review", currentLevel: "review", previousFingerprint: "fp-same", currentFingerprint: "fp-same" }],
  ["changed", { ...base, previousLevel: "review", currentLevel: "review", previousFingerprint: "fp-a", currentFingerprint: "fp-b" }],
  ["escalated", { ...base, previousLevel: "review", currentLevel: "error", previousFingerprint: "fp-a", currentFingerprint: "fp-b" }],
  ["deescalated", { ...base, previousLevel: "error", currentLevel: "review", previousFingerprint: "fp-a", currentFingerprint: "fp-b" }],
  ["resolved", { ...base, previousLevel: "review", currentLevel: "ok", previousFingerprint: "fp-a", currentFingerprint: "fp-ok" }],
  ["quiet-watch", { ...base, previousLevel: "ok", currentLevel: "watch", previousFingerprint: "fp-a", currentFingerprint: "fp-watch" }],
  ["watch-opt-in", { ...base, previousLevel: null, currentLevel: "watch", currentFingerprint: "fp-watch", notifyOnWatch: true }],
];

try {
  const schemas = {};
  for (const [kind, host] of Object.entries(hosts)) {
    const listed = await host.client.listTools();
    const tool = listed.tools.find((item) => item.name === toolName);
    assert.ok(tool, `${kind} missing Gate D tool ${toolName}`);
    schemas[kind] = tool.inputSchema;
  }
  assert.deepEqual(schemas.codex, schemas.native, "Operational Notice schema drift: Codex");
  assert.deepEqual(schemas.opencode, schemas.native, "Operational Notice schema drift: OpenCode");

  for (const [label, args] of cases) {
    let baseline = null;
    for (const [kind, host] of Object.entries(hosts)) {
      const result = json(await host.client.callTool({ name: toolName, arguments: args }));
      assert.equal(result.advisoryOnly, true, `${kind}/${label} must remain advisory`);
      assert.equal("queue" in result, false);
      assert.equal("ttl" in result, false);
      assert.equal("actions" in result, false);
      if (result.notice) {
        assert.deepEqual(mssrNoticeV1Schema.parse(result.notice), result.notice, `${kind}/${label} must emit a valid MssrNotice v1`);
        assert.equal(result.notice.schemaVersion, MSSR_NOTICE_SCHEMA_VERSION);
        for (const deliveryField of ["queue", "ttl", "attempts", "createdAt", "updatedAt", "expiresAt", "history", "ui", "actions"]) {
          assert.equal(deliveryField in result.notice, false, `${kind}/${label} leaked host delivery field ${deliveryField}`);
        }
      }
      if (!baseline) baseline = result;
      else assert.deepEqual(result, baseline, `${kind}/${label} candidate semantics must match native exactly`);
    }
  }

  const opened = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[0][1] }));
  assert.equal(opened.shouldNotify, true);
  assert.equal(opened.event, "opened");
  assert.equal(opened.notice.details.advisoryOnly, true);
  assert.equal(opened.notice.schemaVersion, MSSR_NOTICE_SCHEMA_VERSION);
  assert.equal(opened.notice.kind, "operational-attention");
  assert.equal(opened.notice.origin, "mssr");
  assert.equal(opened.notice.attentionLevel, "review");
  assert.equal(opened.notice.advisoryOnly, true);

  const stable = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[1][1] }));
  assert.deepEqual(stable, { attention: "none", event: null, transition: "review->review:stable", shouldNotify: false, advisoryOnly: true, notice: null });

  const changed = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[2][1] }));
  assert.equal(changed.event, "changed");
  const escalated = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[3][1] }));
  assert.equal(escalated.event, "escalated");
  assert.equal(escalated.notice.severity, "error");
  const deescalated = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[4][1] }));
  assert.equal(deescalated.event, "deescalated");
  const resolved = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[5][1] }));
  assert.equal(resolved.event, "resolved");
  assert.equal(resolved.notice.code, "mssr-project-resolved");
  assert.equal(resolved.notice.noticeId, opened.notice.noticeId, "resolution must preserve MssrNotice lifecycle identity");
  assert.notEqual(resolved.notice.dedupeKey, opened.notice.dedupeKey);
  assert.equal(resolved.notice.attentionLevel, "ok");
  const quietWatch = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[6][1] }));
  assert.equal(quietWatch.shouldNotify, false);
  const watchOptIn = json(await hosts.native.client.callTool({ name: toolName, arguments: cases[7][1] }));
  assert.equal(watchOptIn.shouldNotify, true);
  assert.equal(watchOptIn.event, "opened");
} finally {
  await Promise.all(Object.values(hosts).map(({ client, server }) => Promise.allSettled([client.close(), server.close()])));
}

console.log("MSSR Operational Notice Gate D + Gate E1 MssrNotice v1 cross-host contract: PASS");
