import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  OpenCodeMssrAdapter,
  createCodexMssrMcpServer,
  createMssrMcpServer,
  createOpenCodeMssrMcpServer,
  measureEnvelopeSections,
} from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return { parsed: JSON.parse(item.text), text: item.text };
}

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-route-envelope-"));
const sizes = {};
try {
  await fs.mkdir(path.join(fixtureRoot, ".mssr"), { recursive: true });
  const skillDefs = [
    { name: "envelope-guard", marker: "ENVELOPE_GUARD_CORE_MARKER_7f3a", module: "guard recipe body" },
    { name: "envelope-helper", marker: "ENVELOPE_HELPER_CORE_MARKER_9c1e", module: "helper recipe body" },
    { name: "envelope-dep", marker: "ENVELOPE_DEP_CORE_MARKER_51b7", module: "dep recipe body" },
  ];
  const skillByName = new Map();
  for (const def of skillDefs) {
    const dir = path.join(fixtureRoot, def.name);
    await fs.mkdir(dir, { recursive: true });
    const skillPath = path.join(dir, "SKILL.md");
    await fs.writeFile(skillPath, `# ${def.name}\n\n## Core\n\n${def.marker} core guidance.\n\n## Recipe\n\n${def.module}.\n`, "utf8");
    await fs.writeFile(path.join(dir, "context-modules.json"), JSON.stringify({
      schemaVersion: 1,
      core: { sections: ["## Core"] },
      modules: [{ id: "recipe", description: "Recipe", source: { sections: ["## Recipe"] }, actions: ["review"] }],
    }), "utf8");
    skillByName.set(def.name, skillPath);
  }

  const routingPath = path.join(fixtureRoot, "routing-overrides.json");
  await fs.writeFile(routingPath, JSON.stringify({
    schemaVersion: 1,
    skills: {
      "envelope-guard": {
        phase: "discovery", coversPhases: ["discovery"],
        domains: ["coding"], actions: ["review"], artifacts: ["code"],
        needs: ["unit-tests"], requires: [], complements: [], excludes: [],
        negativeIntents: [], priority: 80, activation: "on-demand",
      },
      "envelope-helper": {
        phase: "discovery", coversPhases: ["discovery"],
        domains: ["coding"], actions: ["review"], artifacts: ["code"],
        needs: ["unit-tests"], requires: ["envelope-dep"], complements: [], excludes: [],
        negativeIntents: [], priority: 70, activation: "on-demand",
      },
      "envelope-dep": {
        phase: "discovery", coversPhases: ["discovery"],
        domains: ["coding"], actions: ["review"], artifacts: ["code"],
        needs: ["unit-tests"], requires: [], complements: [], excludes: [],
        negativeIntents: [], priority: 60, activation: "on-demand",
      },
    },
    workflows: [{
      name: "envelope-fixture-workflow",
      match: { domains: ["coding"], actions: ["review"] },
      phases: [{ phase: "discovery", skills: ["envelope-guard"], required: true }],
    }],
  }), "utf8");
  process.env.MSSR_SKILL_ROUTING_PATH = routingPath;

  const skillCapabilities = [...skillByName.entries()].map(([name, skillPath]) => ({
    id: `fixture:skill:${name}`,
    name,
    description: `${name} fixture skill.`,
    kind: "skill",
    providerId: "fixture",
    source: "fixture",
    location: skillPath,
    skill: { name, description: `${name} fixture skill.`, source: "codex-local", path: skillPath },
  }));

  const bigSchema = { type: "object", properties: {}, blob: "x".repeat(2000) };
  const toolCapabilities = Array.from({ length: 100 }, (_, index) => ({
    id: `big-tools:tool:irrelevant_tool_${index}`,
    name: `irrelevant_tool_${index}`,
    description: `Irrelevant tool ${index} for catalog growth.`,
    kind: "tool",
    providerId: "big-tools",
    source: "mcp:big-tools",
    schema: bigSchema,
  }));

  const input = {
    task: "Review code with evidence.",
    intent: {
      summary: "Review code with evidence.", domains: ["coding"], actions: ["review"],
      artifacts: ["code"], needs: ["unit-tests"], signals: ["nominal"], risk: "read-only", ambiguity: "low",
    },
    stage: "start",
  };

  // Adapter 1: small catalog (skills only). Adapter 2: skills + 100 irrelevant tools with schemas.
  const smallRegistry = new CapabilityRegistry([{
    id: "fixture",
    async refresh() { return { capabilities: skillCapabilities }; },
  }]);
  const bigRegistry = new CapabilityRegistry([
    { id: "fixture", async refresh() { return { capabilities: skillCapabilities }; } },
    { id: "big-tools", async refresh() { return { capabilities: toolCapabilities }; } },
  ]);

  const smallAdapter = new OpenCodeMssrAdapter(smallRegistry);
  const bigAdapter = new OpenCodeMssrAdapter(bigRegistry);
  const smallRoute = await smallAdapter.route(input);
  const bigRoute = await bigAdapter.route(input);
  const smallText = JSON.stringify(smallRoute, null, 2);
  const bigText = JSON.stringify(bigRoute, null, 2);
  const smallSnapshotText = JSON.stringify(smallRegistry.getSnapshot());
  const bigSnapshotText = JSON.stringify(bigRegistry.getSnapshot());
  sizes.smallCatalogSnapshotChars = smallSnapshotText.length;
  sizes.bigCatalogSnapshotChars = bigSnapshotText.length;
  sizes.smallRouteChars = smallText.length;
  sizes.bigRouteChars = bigText.length;

  // 1. Normal mode: no full catalog, no foreign schemas.
  // `registry` keeps only the small routing summary from planSkillRoute
  // (counts/paths); the capability snapshot must never be attached.
  for (const [label, route, text] of [["small", smallRoute, smallText], ["big", bigRoute, bigText]]) {
    assert.equal(route.registry?.capabilities, undefined, `${label}: route must not attach capability entries`);
    assert.deepEqual(Object.keys(route.registry ?? {}).sort(),
      ["canonicalSkills", "duplicateNames", "liveRescan", "routingConfigPath", "routingFixturesPath"],
      `${label}: registry key keeps only the small routing summary`);
    assert.ok(!("capabilities" in (route.registrySummary ?? {}) && Array.isArray(route.registrySummary.capabilities)),
      `${label}: registrySummary must be counts, not a capability array`);
    assert.ok(!text.includes("irrelevant_tool_"), `${label}: serialized route must not contain catalog tool entries`);
    assert.ok(!text.includes("\"inputSchema\""), `${label}: serialized route must not contain foreign tool schemas`);
    assert.ok(route.registrySummary, `${label}: registrySummary is required`);
    assert.equal(route.registrySummary.skillCount, 3, `${label}: skillCount`);
    assert.ok(Array.isArray(route.diagnostics?.tools) && route.diagnostics.tools.includes("mssr_registry_status"),
      `${label}: diagnostics pointer is required`);
    // The small routing summary from planSkillRoute keeps the `registry` key out; canonical counts stay visible.
    assert.equal(route.registrySummary.skillCount, route.registry?.canonicalSkills,
      `${label}: routing skill counts stay consistent`);
  }
  assert.equal(bigRoute.registrySummary.toolCount, 100, "big catalog toolCount");
  assert.equal(bigRoute.registrySummary.capabilityCount, 103, "big catalog capabilityCount");

  // 2. Envelope must not grow proportionally with irrelevant catalog growth.
  const catalogDelta = bigSnapshotText.length - smallSnapshotText.length;
  const envelopeDelta = bigText.length - smallText.length;
  sizes.catalogDeltaChars = catalogDelta;
  sizes.envelopeDeltaChars = envelopeDelta;
  assert.ok(catalogDelta > 150_000, `catalog must grow substantially (got ${catalogDelta} chars)`);
  assert.ok(envelopeDelta < 3_000, `envelope must stay bounded (grew ${envelopeDelta} chars)`);

  // 3-5. Bootstrap through the real MCP transport: required kept, pending optionals leak nothing.
  const { server } = createOpenCodeMssrMcpServer(bigAdapter);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "envelope-fixture", version: "1.0.0" });
  await client.connect(clientTransport);

  const route = json(await client.callTool({ name: "mssr_route_plan", arguments: input }));
  assert.ok(route.text.length < 60_000, `MCP route text must stay compact (got ${route.text.length} chars)`);
  assert.ok(!route.text.includes("irrelevant_tool_"), "MCP route text must not embed catalog tools");
  const guard = route.parsed.activeSkills.find((skill) => skill.name === "envelope-guard");
  assert.ok(guard?.required, "workflow-required root must stay required");

  const pending = json(await client.callTool({
    name: "mssr_skill_bootstrap", arguments: { ...input, traceId: route.parsed.traceId },
  }));
  sizes.pendingBootstrapChars = pending.text.length;
  assert.equal(pending.parsed.traceId, route.parsed.traceId, "trace continuity");
  assert.ok(pending.parsed.lifecycle, "lifecycle must continue");
  assert.ok(pending.parsed.selection.pendingCandidates.some((item) => item.skill === "envelope-helper"),
    "optional roots without a decision must stay pending");
  const pendingLoaded = pending.parsed.loaded.filter((item) => item.loaded);
  assert.ok(pendingLoaded.some((item) => item.skill.name === "envelope-guard"), "required root must load without a decision");
  assert.ok(!pendingLoaded.some((item) => item.skill.name === "envelope-helper"), "pending optional must not load");
  assert.ok(!pending.text.includes("ENVELOPE_HELPER_CORE_MARKER_9c1e"), "pending optional content must not leak");
  assert.ok(!pending.text.includes("ENVELOPE_DEP_CORE_MARKER_51b7"), "unaccepted dependency content must not leak");
  assert.ok(pending.text.includes("ENVELOPE_GUARD_CORE_MARKER_7f3a"), "required content must be preserved");

  // 6. Accepted optional carries its dependency; skipped stays out.
  const accepted = json(await client.callTool({
    name: "mssr_skill_bootstrap",
    arguments: {
      ...input,
      traceId: route.parsed.traceId,
      skillDecisions: [{ skillName: "envelope-helper", decision: "accepted", reasonCode: "useful", stage: "start" }],
    },
  }));
  sizes.acceptedBootstrapChars = accepted.text.length;
  const acceptedNames = new Set(accepted.parsed.loaded.filter((item) => item.loaded).map((item) => item.skill.name));
  assert.ok(acceptedNames.has("envelope-helper"), "accepted optional must load");
  assert.ok(acceptedNames.has("envelope-dep"), "dependency of an accepted optional must load");
  assert.ok(accepted.text.includes("ENVELOPE_DEP_CORE_MARKER_51b7"), "dependency content must be preserved");
  // No duplicated delivery: page strips repeated content, canonical field is `loaded`.
  assert.equal(accepted.parsed.contextAssembly.skillsContentStripped, true, "page must strip repeated skill content");
  for (const entry of accepted.parsed.contextAssembly.skills ?? []) {
    assert.equal(entry.content, undefined, "page skills must not repeat content strings");
  }
  const sections = Object.fromEntries(measureEnvelopeSections(accepted.parsed).map((item) => [item.section, item.chars]));
  sizes.acceptedSections = sections;
  assert.equal(accepted.parsed.registrySummary?.capabilities, undefined, "bootstrap summary carries counts, not entries");
  assert.ok(!accepted.text.includes("irrelevant_tool_"), "bootstrap must not attach the catalog either");

  // 7. Explicit diagnostics still expose the catalog in bounded form.
  const status = json(await client.callTool({ name: "mssr_registry_status", arguments: {} }));
  assert.equal(status.parsed.capabilities.length, 103, "diagnostic snapshot stays complete on demand");
  const search = json(await client.callTool({ name: "mssr_capability_search", arguments: { query: "envelope-helper", limit: 5 } }));
  assert.ok(search.parsed.matches.some((item) => item.name === "envelope-helper"), "diagnostic search works");
  const inspect = json(await client.callTool({ name: "mssr_capability_inspect", arguments: { idOrName: "envelope-dep" } }));
  assert.equal(inspect.parsed.capability?.name, "envelope-dep", "diagnostic inspect works");

  // 8. No silent truncation: a fitting page is explicit, cursors stay usable.
  assert.equal(accepted.parsed.contextAssembly.status, "complete", "fitting page must report complete");
  assert.equal(accepted.parsed.contextAssembly.mustContinue, false, "fitting page must not require continuation");

  // 9. Codex exposes the same bounded diagnostics; native route is compact too.
  const { server: codexServer } = createCodexMssrMcpServer();
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await codexServer.connect(st);
  const codexClient = new Client({ name: "envelope-codex", version: "1.0.0" });
  await codexClient.connect(ct);
  const codexTools = (await codexClient.listTools()).tools.map((tool) => tool.name);
  for (const name of ["mssr_registry_status", "mssr_capability_search", "mssr_capability_inspect"]) {
    assert.ok(codexTools.includes(name), `codex must expose ${name}`);
  }
  await codexClient.close();
  await codexServer.close();

  const native = createMssrMcpServer(new CapabilityRegistry([
    { id: "fixture", async refresh() { return { capabilities: skillCapabilities }; } },
  ]));
  const [nt, nst] = InMemoryTransport.createLinkedPair();
  await native.server.connect(nst);
  const nativeClient = new Client({ name: "envelope-native", version: "1.0.0" });
  await nativeClient.connect(nt);
  const nativeRoute = json(await nativeClient.callTool({ name: "mssr_route_plan", arguments: { task: input.task, caller: "opencode-local", stage: "start" } }));
  assert.equal(nativeRoute.parsed.registry?.capabilities, undefined, "native route must not attach entries either");
  assert.ok(nativeRoute.parsed.registrySummary, "native route keeps the summary");
  await nativeClient.close();
  await native.server.close();

  await client.close();
  await server.close();
  console.log(JSON.stringify({ status: "PASS", sizes }, null, 2));
} finally {
  delete process.env.MSSR_SKILL_ROUTING_PATH;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
