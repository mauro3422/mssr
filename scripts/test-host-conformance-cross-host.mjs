import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  CapabilityRegistry,
  CodexMssrAdapter,
  OpenCodeMssrAdapter,
  createArchitectureImpactReviewedBaseline,
  createCodexMssrMcpServer,
  createMssrMcpServer,
  createOpenCodeMssrMcpServer,
  normalizeArchitectureImpactObservationEvidence,
} from "../dist/index.js";

function emptyRegistry(id) {
  return new CapabilityRegistry([{ id, async refresh() { return { capabilities: [] }; } }]);
}

async function connect(created, name) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await created.server.connect(serverTransport);
  const client = new Client({ name, version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  return client;
}

function json(result) {
  const value = result.content?.find((entry) => entry.type === "text")?.text;
  assert.ok(value);
  return JSON.parse(value);
}

const clients = await Promise.all([
  connect(createMssrMcpServer(emptyRegistry("native")), "native"),
  connect(createCodexMssrMcpServer(new CodexMssrAdapter(emptyRegistry("codex"))), "codex"),
  connect(createOpenCodeMssrMcpServer(new OpenCodeMssrAdapter(emptyRegistry("opencode"))), "opencode"),
]);

const architectureManifest = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "portable-plane",
    authorityRef: "docs/portable.md",
    contextRef: "portable-context",
    impactRefs: ["src/portable.ts"],
  }],
};
const planResults = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_architecture_impact_plan",
  arguments: { architectureManifest, touchedRefs: ["src/portable.ts"] },
}).then(json)));
for (const result of planResults) assert.deepEqual(result, planResults[0]);
assert.equal(planResults[0].plans[0].semanticOwner, "mssr");
assert.equal(planResults[0].canonicalRewriteAllowed, false);


const coverageResults = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_semantic_consistency_coverage",
  arguments: {},
}).then(json)));
for (const result of coverageResults) assert.deepEqual(result, coverageResults[0]);
assert.equal(coverageResults[0].advisoryOnly, true);
assert.equal(coverageResults[0].canonicalRewriteAllowed, false);
assert.equal(coverageResults[0].entries.find((entry) => entry.id === "context-message:roadmap-contradiction")?.coverageClass, "pending-host-adoption");

const semanticInput = {
  claims: [
    { kind: "state-value", subject: "roadmap.r4", source: "project-state", sourceRef: "state#r4", authority: "canonical", value: "completed" },
    { kind: "state-value", subject: "roadmap.r4", source: "project-context", sourceRef: "roadmap#r4", authority: "replica", value: "pending" },
  ],
};
const semanticEvaluations = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_semantic_consistency_evaluate",
  arguments: { input: semanticInput },
}).then(json)));
for (const result of semanticEvaluations) assert.deepEqual(result, semanticEvaluations[0]);
assert.equal(semanticEvaluations[0].contradictionProven, true);
assert.equal(semanticEvaluations[0].canonicalRewriteAllowed, false);

const semanticMessages = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_semantic_context_messages",
  arguments: { input: semanticInput, observedAt: "2026-09-19T18:00:00-03:00" },
}).then(json)));
for (const result of semanticMessages) assert.deepEqual(result, semanticMessages[0]);
assert.equal(semanticMessages[0].messages[0].kind, "roadmap-contradiction");
assert.equal(semanticMessages[0].autoWriteAllowed, false);

const candidateResults = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_semantic_candidate_retrieve",
  arguments: { input: semanticInput },
}).then(json)));
for (const result of candidateResults) assert.deepEqual(result, candidateResults[0]);
assert.equal(candidateResults[0].candidates[0].truthAuthority, false);
assert.equal(candidateResults[0].lexicalTruthAuthority, false);

const shadowObservation = {
  schemaVersion: 1,
  candidateId: "candidate.portable-r4",
  modelId: "fixture-shadow-model",
  modelRevision: "fixture-1",
  label: "contradicts",
  score: 0.9,
  sourceRefs: ["state#r4", "roadmap#r4"],
  observedAt: "2026-09-19T18:00:00-03:00",
};
const shadowResults = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_semantic_shadow_evaluate",
  arguments: { observation: shadowObservation },
}).then(json)));
for (const result of shadowResults) assert.deepEqual(result, shadowResults[0]);
assert.equal(shadowResults[0].routingInfluence, false);
assert.equal(shadowResults[0].directNoticeAuthority, false);
assert.equal(shadowResults[0].truthAuthority, false);

const initial = {
  schemaVersion: 1,
  architectureId: "portable-plane",
  authority: { ref: "docs/portable.md", availability: "available", revision: "authority-1" },
  impacts: [{ ref: "src/portable.ts", availability: "available", revision: "source-1" }],
};
const baseline = createArchitectureImpactReviewedBaseline(
  normalizeArchitectureImpactObservationEvidence(architectureManifest, initial),
  { reviewed: true },
);
const evaluation = {
  architectureManifest,
  plan: planResults[0].plans[0],
  baseline,
  projectContextManifest: {
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "portable-context",
      kind: "context",
      description: "Portable architecture context.",
      source: { path: ".mssr/knowledge/portable.md" },
      topic: "architecture",
      area: "portable",
      maxChars: 1200,
      actions: ["review"],
    }],
  },
  hostEvidence: {
    ...initial,
    impacts: [{ ref: "src/portable.ts", availability: "available", revision: "source-2" }],
  },
};
const evaluations = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_architecture_impact_evaluate",
  arguments: { evaluation },
}).then(json)));
for (const result of evaluations) assert.deepEqual(result, evaluations[0]);
assert.equal(evaluations[0].attentionLevel, "review");
assert.equal(evaluations[0].canonicalRewriteAllowed, false);

const evidence = {
  kind: "project-state",
  ref: ".mssr/PROJECT_STATE.md",
  summary: "Current state supports a reviewed update.",
  canonicalOwner: "mssr-repository",
  provenance: "project",
  freshness: "fresh",
  revision: "state-1",
};
const proposal = {
  id: "proposal.project-state",
  kind: "persistence-proposal",
  title: "Review state update",
  summary: "A repository owner should review the bounded proposal.",
  evidence: [evidence],
  advisoryActions: ["record-decision"],
  persistenceProposal: {
    target: "project-state",
    summary: "Record the reviewed current state.",
    evidence: [evidence],
    reviewRequired: true,
  },
  estimatedChars: 200,
};
const reviews = await Promise.all(clients.map((client) => client.callTool({
  name: "mssr_context_proposal_review",
  arguments: { messages: [proposal] },
}).then(json)));
for (const result of reviews) assert.deepEqual(result, reviews[0]);
assert.equal(reviews[0].reviews[0].disposition, "review-ready");
assert.equal(reviews[0].reviews[0].reviewRequired, true);
assert.equal(reviews[0].autoWriteAllowed, false);

const stale = structuredClone(proposal);
stale.id = "proposal.stale-state";
stale.persistenceProposal.evidence[0].freshness = "stale";
const staleReview = json(await clients[0].callTool({
  name: "mssr_context_proposal_review",
  arguments: { messages: [stale] },
}));
assert.equal(staleReview.reviews[0].disposition, "refresh-required");

await Promise.all(clients.map((client) => client.close()));
console.log("MSSR Architecture Impact + Context Plane cross-host conformance: PASS");
