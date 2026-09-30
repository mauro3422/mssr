import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CapabilityRegistry, createMssrMcpServer } from "../dist/index.js";

function json(result) {
  const item = result.content?.find((entry) => entry.type === "text");
  assert.ok(item?.text, "Expected text MCP response");
  return JSON.parse(item.text);
}

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-semantic-curation-mcp-"));
const projectRoot = path.join(root, "project");
const stateRoot = path.join(root, "state");
const priorStateRoot = process.env.MSSR_STATE_ROOT;
process.env.MSSR_STATE_ROOT = stateRoot;

const registry = new CapabilityRegistry([{ id: "test", async refresh() { return { capabilities: [] }; } }]);
const { server } = createMssrMcpServer(registry);
const client = new Client({ name: "mssr-semantic-curation-test", version: "0.1.0" });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await fs.mkdir(path.join(projectRoot, ".mssr", "knowledge", "phase"), { recursive: true });
  await fs.writeFile(path.join(projectRoot, ".mssr", "project-context.json"), `${JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "current-phase",
      kind: "memory",
      topic: "phase",
      description: "Current phase fixture that intentionally exceeds its selected module budget.",
      source: { path: ".mssr/knowledge/phase/current-phase.md" },
      priority: 20,
      required: false,
      maxChars: 1000,
    }],
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(
    path.join(projectRoot, ".mssr", "knowledge", "phase", "current-phase.md"),
    `# Current phase\n\n${"Current verified state and historical detail. ".repeat(80)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(projectRoot, "README.md"),
    "# Project\n\nCurrent verified state and historical detail are summarized by the active phase authority.\n",
    "utf8",
  );

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_evidence_graph"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_project_review"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_learning_status"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_learning_feedback"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_fallback_review"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_curation_learning_trace_link"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_experience_observe"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_experience_status"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_experience_feedback"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_experience_fallback"));
  assert.ok(tools.tools.some((tool) => tool.name === "mssr_semantic_experience_trace_link"));

  const experienceFeature = {
    subjectKind: "project-context-candidate",
    candidateKinds: ["state", "history"],
    signals: ["task-match"],
    flags: { protected: false },
    buckets: { stage: "implement", authority: "state" },
  };
  const observedExperience = json(await client.callTool({
    name: "mssr_semantic_experience_observe",
    arguments: {
      projectKey: projectRoot,
      decisionKind: "context-selection",
      feature: experienceFeature,
      evidenceUnits: [{ sourceRef: ".mssr/PROJECT_STATE.md", role: "candidate", selected: true, reasonCode: "selected" }],
      proposal: { value: "select", confidence: 0.94, provider: "shef", modelId: "system-one" },
      traceId: "mssr-semantic-experience-mcp-001",
      workflowKey: "semantic-experience-mcp-test",
    },
  }));
  assert.equal(observedExperience.decisionKind, "context-selection");
  assert.equal(observedExperience.verification.status, "unknown");
  assert.equal(observedExperience.rawProviderIsTrainingTruth, false);
  assert.equal(observedExperience.authorityInfluence, false);
  assert.equal(observedExperience.autoApplyAllowed, false);

  const experienceStatus = json(await client.callTool({ name: "mssr_semantic_experience_status", arguments: { maxRules: 10 } }));
  assert.equal(experienceStatus.observations, 1);
  assert.equal(experienceStatus.shadow, 1);
  assert.equal(experienceStatus.rawTraceLoaded, false);
  assert.equal(experienceStatus.rawSourceTextStored, false);
  assert.equal(experienceStatus.authorityInfluence, false);
  assert.ok(JSON.stringify(experienceStatus).length < 20_000);

  const experienceFallback = json(await client.callTool({
    name: "mssr_semantic_experience_fallback",
    arguments: { decisionKind: "context-selection", feature: experienceFeature },
  }));
  assert.equal(experienceFallback.basis, "abstain");
  assert.equal(experienceFallback.value, null);
  assert.equal(experienceFallback.autoApplyAllowed, false);

  const correctedExperience = json(await client.callTool({
    name: "mssr_semantic_experience_feedback",
    arguments: {
      observationId: observedExperience.observationId,
      status: "corrected",
      value: "review",
      evidenceRef: "fixture:independent-review",
      verificationId: "verification-semantic-curation-mcp-001",
      verifier: {
        kind: "test",
        id: "semantic-curation-mcp-fixture-verifier",
        provider: "fixture-test-runner",
        traceId: "mssr-semantic-experience-verifier-002",
      },
    },
  }));
  assert.equal(correctedExperience.verification.status, "corrected");
  assert.equal(correctedExperience.verification.value, "review");

  const graph = json(await client.callTool({
    name: "mssr_semantic_curation_evidence_graph",
    arguments: { projectRoot, maxSources: 16, maxBlocks: 64, maxPairs: 8, minScore: 0.05 },
  }));
  assert.equal(graph.advisoryOnly, true);
  assert.equal(graph.sourceTextDuplicated, false);
  assert.ok(graph.sources.some((source) => source.sourceRef === ".mssr/knowledge/phase/current-phase.md"));
  assert.ok(graph.sources.some((source) => source.sourceRef === "README.md"));
  assert.ok(graph.nodes.every((node) => !("text" in node)));
  assert.ok(graph.edges.every((edge) => edge.leftSourceRef !== edge.rightSourceRef));

  const initial = json(await client.callTool({ name: "mssr_semantic_curation_status", arguments: { maxEntries: 20 } }));
  assert.equal(initial.pendingCount, 0);
  assert.equal(path.resolve(initial.queuePath).startsWith(path.resolve(stateRoot)), true);

  const enqueue = json(await client.callTool({
    name: "mssr_semantic_curation_enqueue",
    arguments: { projectRoots: [projectRoot], skillRoots: [], includeWatch: false },
  }));
  assert.equal(enqueue.projects.length, 1);
  assert.equal(enqueue.projects[0].result.queued.length, 1);
  assert.equal(enqueue.projects[0].result.queued[0].entry.sourceRef, ".mssr/knowledge/phase/current-phase.md");

  const status = json(await client.callTool({ name: "mssr_semantic_curation_status", arguments: { maxEntries: 20 } }));
  assert.equal(status.pendingCount, 1);
  assert.equal(status.entries[0].sourceRef, ".mssr/knowledge/phase/current-phase.md");
  assert.equal(status.entries[0].reasons.includes("project-context-entry-budget-exceeded"), true);
  assert.equal(status.entries[0].reasons.includes("semantic-segmentation-review-required"), true);
  assert.equal(status.advisoryOnly, true);

  const learning = json(await client.callTool({ name: "mssr_semantic_curation_learning_status", arguments: { maxRules: 10 } }));
  assert.equal(learning.rawTraceLoaded, false);
  assert.equal(learning.rawSourceTextStored, false);
  assert.equal(learning.rawJevIsTrainingTruth, false);
  assert.equal(learning.routingInfluence, false);

  const fallback = json(await client.callTool({
    name: "mssr_semantic_curation_fallback_review",
    arguments: { projectRoot, maxSources: 16, maxBlocks: 64, maxPairs: 8, minScore: 0.05, detail: "summary" },
  }));
  assert.equal(fallback.mode, "deterministic-fallback");
  assert.equal(fallback.rawTraceLoaded, false);
  assert.equal(fallback.sourceTextReturned, false);
  assert.equal(fallback.canonicalRewriteAllowed, false);
  assert.ok(JSON.stringify(fallback).length < 20_000, "Default fallback review must remain context-bounded");

  console.log("semantic-curation-mcp tests passed");
} finally {
  await client.close().catch(() => undefined);
  await server.close().catch(() => undefined);
  if (priorStateRoot === undefined) delete process.env.MSSR_STATE_ROOT;
  else process.env.MSSR_STATE_ROOT = priorStateRoot;
  await fs.rm(root, { recursive: true, force: true });
}
