import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  MSSR_PROJECT_CONTROL_TOOL_NAMES,
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
  const client = new Client({ name: `mssr-project-control-${kind}`, version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return { ...created, client };
}

const hosts = {
  native: await connect("native"),
  codex: await connect("codex"),
  opencode: await connect("opencode"),
};

const schemas = {};
for (const [kind, host] of Object.entries(hosts)) {
  const listed = await host.client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  for (const name of MSSR_PROJECT_CONTROL_TOOL_NAMES) {
    assert.equal(names.includes(name), true, `${kind} missing shared project-control tool ${name}`);
    schemas[`${kind}:${name}`] = listed.tools.find((tool) => tool.name === name)?.inputSchema;
  }
}
for (const name of MSSR_PROJECT_CONTROL_TOOL_NAMES) {
  assert.deepEqual(schemas[`codex:${name}`], schemas[`native:${name}`], `${name} schema drift: Codex`);
  assert.deepEqual(schemas[`opencode:${name}`], schemas[`native:${name}`], `${name} schema drift: OpenCode`);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-project-control-cross-host-"));
try {
  const repo = path.join(root, "repo");
  await fs.mkdir(path.join(repo, ".git"), { recursive: true });

  const initialized = json(await hosts.native.client.callTool({
    name: "mssr_project_initialize",
    arguments: { projectRoot: repo },
  }));
  assert.equal(initialized.initialized, true);
  assert.equal(initialized.manifestStatus, "valid");
  await fs.access(path.join(repo, ".mssr", "project-context.json"));
  await fs.access(path.join(repo, ".mssr", "knowledge"));
  await fs.access(path.join(repo, ".mssr", "runtime"));

  for (const kind of ["native", "codex", "opencode"]) {
    const health = json(await hosts[kind].client.callTool({
      name: "mssr_project_health",
      arguments: { projectRoot: repo },
    }));
    assert.equal(health.level, "ok", `${kind} health must agree`);
    assert.equal(health.manifestStatus, "valid");

    const capture = json(await hosts[kind].client.callTool({
      name: "mssr_project_capture_plan",
      arguments: {
        id: "routing-law",
        topic: "law",
        area: "routing",
        title: "Routing ownership law",
        content: "Only one canonical layer owns each routing decision.",
        domains: ["skill-system"],
        actions: ["design", "review"],
        artifacts: ["project"],
        signals: ["reusable-pattern"],
      },
    }));
    assert.equal(capture.relativePath, ".mssr/knowledge/law/routing-law.md");
    assert.equal(capture.module.topic, "law");
    assert.equal(capture.module.area, "routing");
    assert.equal(capture.advisoryOnly, true);

    const modularization = json(await hosts[kind].client.callTool({
      name: "mssr_project_modularization_plan",
      arguments: { projectRoot: repo },
    }));
    assert.equal(modularization.status, "not-needed", `${kind} modularization planner must agree on healthy fixture`);
    assert.deepEqual(modularization.candidates, []);
    assert.equal(modularization.advisoryOnly, true);
  }

  const nested = path.join(root, "nested", "repo-b");
  await fs.mkdir(path.join(nested, ".git"), { recursive: true });
  const workspace = json(await hosts.codex.client.callTool({
    name: "mssr_workspace_initialize",
    arguments: { workspaceRoot: root, maxDepth: 3 },
  }));
  assert.equal(workspace.projectCount, 2);
  assert.equal(workspace.blocked.length, 0);

  const blockedRepo = path.join(root, "blocked");
  await fs.mkdir(path.join(blockedRepo, ".git"), { recursive: true });
  await fs.mkdir(path.join(blockedRepo, ".bridge"), { recursive: true });
  await fs.writeFile(path.join(blockedRepo, ".bridge", "PROJECT_MEMORY.md"), "historical durable memory\n", "utf8");
  const blocked = json(await hosts.opencode.client.callTool({
    name: "mssr_project_initialize",
    arguments: { projectRoot: blockedRepo, initializeMissing: true, cleanupLegacyArtifacts: true },
  }));
  assert.equal(blocked.initialized, false);
  assert.deepEqual(blocked.legacy.blocked, [".bridge/PROJECT_MEMORY.md"]);
  await fs.access(path.join(blockedRepo, ".bridge", "PROJECT_MEMORY.md"));
  await assert.rejects(() => fs.access(path.join(blockedRepo, ".mssr", "PROJECT_MEMORY.md")));
} finally {
  await Promise.all(Object.values(hosts).map(({ client, server }) => Promise.allSettled([client.close(), server.close()])));
  await fs.rm(root, { recursive: true, force: true });
}

console.log("MSSR project-control cross-host tests PASS");
