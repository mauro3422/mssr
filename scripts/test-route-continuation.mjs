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
} from "../dist/index.js";

// Transport-level paged-continuation proof: a skill whose selected context
// exceeds one page budget must be consumable across pages with no lost and no
// duplicated units. Runs through the real MCP transport (in-memory).

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return { parsed: JSON.parse(item.text), text: item.text };
}

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-route-continuation-"));
try {
  const body = (marker, target) => {
    const line = `Procedure line ${marker} with stable instructional content. `;
    return line.repeat(Math.ceil(target / line.length)).slice(0, target);
  };
  const dir = path.join(fixtureRoot, "envelope-tome");
  await fs.mkdir(dir, { recursive: true });
  const skillPath = path.join(dir, "SKILL.md");
  const core = `## Core\n\nTOME_CORE_MARKER_aa11 core guidance.\n\n${body("core", 2000)}\n`;
  const alpha = `## Alpha\n\nTOME_ALPHA_MARKER_bb22 alpha recipe.\n\n${body("alpha", 3000)}\n`;
  const beta = `## Beta\n\nTOME_BETA_MARKER_cc33 beta recipe.\n\n${body("beta", 3000)}\n`;
  await fs.writeFile(skillPath, `# envelope-tome\n\n${core}\n${alpha}\n${beta}`, "utf8");
  await fs.writeFile(path.join(dir, "context-modules.json"), JSON.stringify({
    schemaVersion: 1,
    core: { sections: ["## Core"] },
    modules: [
      { id: "alpha", description: "Alpha recipe", source: { sections: ["## Alpha"] }, actions: ["document"] },
      { id: "beta", description: "Beta recipe", source: { sections: ["## Beta"] }, actions: ["document"] },
    ],
  }), "utf8");

  const routingPath = path.join(fixtureRoot, "routing-overrides.json");
  await fs.writeFile(routingPath, JSON.stringify({
    schemaVersion: 1,
    skills: {
      "envelope-tome": {
        phase: "implementation", coversPhases: ["implementation"],
        domains: ["coding"], actions: ["document"], artifacts: ["document"],
        needs: ["history-recovery"], requires: [], complements: [], excludes: [],
        negativeIntents: [], priority: 70, activation: "on-demand",
        requireNeedMatch: true, requireActionMatch: true, requireArtifactMatch: true,
      },
    },
    workflows: [],
  }), "utf8");
  process.env.MSSR_SKILL_ROUTING_PATH = routingPath;

  const registry = new CapabilityRegistry([{
    id: "fixture",
    async refresh() {
      return {
        capabilities: [{
          id: "fixture:skill:envelope-tome", name: "envelope-tome", kind: "skill",
          providerId: "fixture", description: "Long fixture skill.", source: "fixture",
          location: skillPath,
          skill: { name: "envelope-tome", description: "Long fixture skill.", source: "codex-local", path: skillPath },
        }],
      };
    },
  }]);

  const adapter = new OpenCodeMssrAdapter(registry);
  const { server } = createOpenCodeMssrMcpServer(adapter);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "continuation-fixture", version: "1.0.0" });
  await client.connect(clientTransport);

  const base = {
    task: "Document the tome procedure for later recovery.",
    intent: {
      summary: "Document the tome procedure.", domains: ["coding"], actions: ["document"],
      artifacts: ["document"], needs: ["history-recovery"], signals: ["nominal"],
      risk: "read-only", ambiguity: "low",
    },
    stage: "implement",
    skillDecisions: [{ skillName: "envelope-tome", decision: "accepted", reasonCode: "useful", stage: "implement" }],
  };

  const full = json(await client.callTool({ name: "mssr_skill_bootstrap", arguments: { ...base, maxContextChars: 100000 } }));
  assert.equal(full.parsed.contextAssembly.status, "complete", "reference page must be complete");
  const fullUnits = full.parsed.contextAssembly.units.map((u) => u.id).sort();
  assert.ok(fullUnits.length >= 3, `expected core+modules units (got ${fullUnits.length})`);
  const fullContent = full.parsed.loaded.find((l) => l.skill.name === "envelope-tome")?.content ?? "";
  assert.ok(fullContent.includes("TOME_CORE_MARKER_aa11") && fullContent.includes("TOME_ALPHA_MARKER_bb22") && fullContent.includes("TOME_BETA_MARKER_cc33"));

  const traceId = full.parsed.traceId;
  const p1 = json(await client.callTool({ name: "mssr_skill_bootstrap", arguments: { ...base, traceId, maxContextChars: 4000 } }));
  assert.equal(p1.parsed.contextAssembly.status, "partial", "over-budget page must be explicit partial, never silent truncation");
  assert.equal(p1.parsed.contextAssembly.mustContinue, true, "partial page must require continuation");
  assert.ok(typeof p1.parsed.contextAssembly.cursor === "string" && p1.parsed.contextAssembly.cursor.length >= 16, "partial page must carry an opaque cursor");
  assert.ok(p1.parsed.contextAssembly.units.some((u) => u.kind === "core"), "required core ships on the first page");
  assert.equal(p1.parsed.loaded.find((l) => l.skill.name === "envelope-tome")?.obligation, "accepted", "accepted roots stay accepted, never relabelled required");

  const pages = [p1];
  let cursor = p1.parsed.contextAssembly.cursor;
  for (let hop = 0; hop < 4 && cursor; hop++) {
    const next = json(await client.callTool({
      name: "mssr_skill_bootstrap", arguments: { ...base, traceId, maxContextChars: 4000, contextCursor: cursor },
    }));
    pages.push(next);
    cursor = next.parsed.contextAssembly.status === "partial" ? next.parsed.contextAssembly.cursor : undefined;
    if (next.parsed.contextAssembly.status === "partial") {
      assert.equal(next.parsed.contextAssembly.mustContinue, true);
      assert.ok(next.parsed.contextAssembly.cursor, "chained partial must carry the next cursor");
    }
  }
  const last = pages.at(-1);
  assert.equal(last.parsed.contextAssembly.status, "complete", "chain must terminate explicitly");
  assert.equal(last.parsed.contextAssembly.mustContinue, false);
  assert.ok(pages.length >= 3, `expected multi-hop chain (got ${pages.length} pages)`);

  // No loss, no duplication: delivered unit ids partition the reference set.
  const seen = new Map();
  let deliveredChars = 0;
  let combinedContent = "";
  for (const [index, page] of pages.entries()) {
    for (const unit of page.parsed.contextAssembly.units) {
      assert.ok(!seen.has(unit.id), `page ${index}: unit ${unit.id} delivered twice`);
      seen.set(unit.id, unit.chars);
      deliveredChars += unit.chars;
    }
    combinedContent += page.parsed.loaded.find((l) => l.skill.name === "envelope-tome")?.content ?? "";
  }
  assert.deepEqual([...seen.keys()].sort(), fullUnits, "paged units must partition the reference units exactly");
  assert.equal(deliveredChars, full.parsed.contextAssembly.deliveredChars, "delivered chars must equal the reference page");
  // The loader joins delivered units with "\n\n" inside each page, so pages
  // rejoin with the same separator to reconstruct the reference content.
  const pageContents = pages.map((page) => page.parsed.loaded.find((l) => l.skill.name === "envelope-tome")?.content ?? "").filter(Boolean);
  assert.equal(pageContents.join("\n\n"), fullContent, "rejoined pages must equal the reference content exactly");
  for (const marker of ["TOME_CORE_MARKER_aa11", "TOME_ALPHA_MARKER_bb22", "TOME_BETA_MARKER_cc33"]) {
    const occurrences = combinedContent.split(marker).length - 1;
    assert.equal(occurrences, 1, `${marker} must appear exactly once across pages`);
  }

  await client.close();
  await server.close();
  console.log(JSON.stringify({ status: "PASS", pages: pages.length, units: fullUnits.length, deliveredChars }, null, 2));
} finally {
  delete process.env.MSSR_SKILL_ROUTING_PATH;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}
