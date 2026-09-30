import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  MSSR_SEMANTIC_CURATION_SCHEMA_VERSION,
  buildMssrProjectEvidenceGraph,
  buildMssrProjectEvidenceJobs,
  evaluateMssrSemanticCuration,
  reviewMssrProjectEvidenceGraph,
} from "../dist/index.js";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-evidence-graph-"));
const projectRoot = path.join(root, "project");
const reviewRoot = path.join(root, "reviews");
const distillationStorePath = path.join(root, "semantic-learning.json");
const experienceStorePath = path.join(root, "semantic-experience.json");

try {
  await Promise.all([
    fs.mkdir(path.join(projectRoot, ".mssr", "knowledge", "phase"), { recursive: true }),
    fs.mkdir(path.join(projectRoot, ".mssr", "runtime"), { recursive: true }),
    fs.mkdir(path.join(projectRoot, "docs"), { recursive: true }),
    fs.mkdir(path.join(projectRoot, "evidence"), { recursive: true }),
    fs.mkdir(path.join(projectRoot, "node_modules", "noise"), { recursive: true }),
  ]);

  const currentText = "# Verification summary\n\nCurrent npm run check verification passes with 0 errors and 0 warnings after the Atlas integration. This is the current editor verification state.\n";
  const oldText = "# K3 verification\n\nPrevious npm run check verification reported 1 inherited Explorer activity error and 0 warnings before the Atlas integration. This is older editor verification evidence.\n";
  const unrelatedText = "# Art direction\n\nThe water silhouette should remain readable against a dark background and preserve broad curved ribbons.\n";
  const duplicateText = "# Shared invariant\n\nNever rewrite canonical project truth from lexical retrieval alone.\n";
  const longHistoryText = [
    "# Long verification archive",
    ...Array.from({ length: 38 }, (_, index) => `\n\n## Archive ${index + 1}\n\nHistorical subsystem note ${index + 1} with unrelated renderer detail and archival context.`),
    "\n\n## Final verification\n\nHistorical npm run check verification ended with 2 errors and 0 warnings before the current integration gate.",
  ].join("");

  const currentPath = path.join(projectRoot, ".mssr", "PROJECT_STATE.md");
  const oldPath = path.join(projectRoot, ".mssr", "knowledge", "phase", "k3-old.md");
  await fs.writeFile(currentPath, currentText, "utf8");
  await fs.writeFile(oldPath, oldText, "utf8");
  await fs.writeFile(path.join(projectRoot, "docs", "art.md"), unrelatedText, "utf8");
  await fs.writeFile(path.join(projectRoot, "docs", "invariant.md"), duplicateText, "utf8");
  await fs.writeFile(path.join(projectRoot, "docs", "long-history.md"), longHistoryText, "utf8");
  await fs.writeFile(path.join(projectRoot, "README.md"), duplicateText, "utf8");
  await fs.writeFile(path.join(projectRoot, "evidence", "qa_result.json"), `${JSON.stringify({ check: "npm run check", errors: 0, warnings: 0, status: "pass" }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(projectRoot, ".mssr", "runtime", "noise.md"), "# Runtime noise\n\nThis must never enter the graph.\n", "utf8");
  await fs.writeFile(path.join(projectRoot, "node_modules", "noise", "README.md"), "# Dependency noise\n", "utf8");

  const oldTime = new Date("2026-09-20T12:00:00Z");
  const newTime = new Date("2026-09-28T12:00:00Z");
  await fs.utimes(oldPath, oldTime, oldTime);
  await fs.utimes(currentPath, newTime, newTime);

  const graph = await buildMssrProjectEvidenceGraph({
    projectRoot,
    maxSources: 32,
    maxBlocks: 128,
    maxPairs: 16,
    minScore: 0.1,
  });
  const refs = graph.sources.map((source) => source.sourceRef);
  assert.ok(refs.includes(".mssr/PROJECT_STATE.md"));
  assert.ok(refs.includes(".mssr/knowledge/phase/k3-old.md"));
  assert.ok(refs.includes("evidence/qa_result.json"));
  assert.ok(!refs.some((ref) => ref.includes(".mssr/runtime")));
  assert.ok(!refs.some((ref) => ref.includes("node_modules")));
  assert.equal(graph.policy.lexicalTruthAuthority, false);
  assert.equal(graph.policy.freshnessAuthority, false);
  assert.equal(graph.policy.advisoryOnly, true);
  assert.ok(graph.nodes.every((node) => node.block.sha256.length === 64));
  assert.ok(graph.nodes.every((node) => Number.isInteger(node.block.startLine) && Number.isInteger(node.block.endLine)));
  assert.ok(graph.edges.every((edge) => edge.leftSourceRef !== edge.rightSourceRef));
  assert.ok(graph.edges.every((edge) => edge.truthAuthority === false && edge.freshnessAuthority === false));

  const staleEdge = graph.edges.find((edge) => new Set([edge.leftSourceRef, edge.rightSourceRef]).has(".mssr/PROJECT_STATE.md")
    && new Set([edge.leftSourceRef, edge.rightSourceRef]).has(".mssr/knowledge/phase/k3-old.md"));
  assert.ok(staleEdge, "Expected current/old verification evidence to be retrieved cross-document");
  assert.equal(staleEdge.leftSourceRef, ".mssr/PROJECT_STATE.md");
  assert.equal(staleEdge.orderingHint.method, "mtime");
  const duplicateEdge = graph.edges.find((edge) => edge.retrieval.methods.includes("exact-hash"));
  assert.ok(duplicateEdge, "Expected exact duplicate evidence to be retrieved");
  const longHistoryNodes = graph.nodes.filter((node) => node.source.sourceRef === "docs/long-history.md");
  assert.ok(longHistoryNodes.some((node) => node.block.text.includes("Historical npm run check verification ended with 2 errors")), "Expected stratified sampling to retain the end of a long document");
  const anchoredEdge = graph.edges.find((edge) => new Set([edge.leftSourceRef, edge.rightSourceRef]).has(".mssr/PROJECT_STATE.md")
    && new Set([edge.leftSourceRef, edge.rightSourceRef]).has("docs/long-history.md")
    && edge.retrieval.methods.includes("fact-anchor"));
  assert.ok(anchoredEdge, "Expected shared factual command/status anchors to retrieve cross-document drift candidates");

  const jobs = buildMssrProjectEvidenceJobs(graph);
  assert.equal(jobs.length, graph.edges.length);
  assert.ok(jobs.every((job) => job.blocks.length === 2 && job.pairCandidates.length === 1));
  assert.ok(jobs.every((job) => job.blocks[0].sourceRef !== job.blocks[1].sourceRef));
  assert.ok(jobs.every((job) => job.corpusKey === "project-evidence-graph"));
  assert.ok(jobs.every((job) => job.blocks.length * 4 + job.pairCandidates.length * 3 === 11));

  const fakeExecute = async ({ jobs: jobInputs, maxHeadsPerRequest = 64 }) => {
    const results = jobInputs.map((job, index) => {
      const providerResult = {
        schemaVersion: MSSR_SEMANTIC_CURATION_SCHEMA_VERSION,
        provider: "fixture",
        modelId: "fixture-model",
        blockJudgments: job.blocks.map((block, blockIndex) => ({
          blockId: block.id,
          role: { value: blockIndex === 0 ? "current-state" : "history", confidence: 0.95 },
          destination: { value: blockIndex === 0 ? "state" : "memory", confidence: 0.9 },
          protectedProbability: block.protected ? 0.95 : 0.1,
          topic: { value: block.topicCandidates[0], confidence: 0.9 },
        })),
        pairJudgments: [{
          leftId: job.blocks[0].id,
          rightId: job.blocks[1].id,
          relation: { value: "supersedes", confidence: 0.9 },
          connector: { value: "however", confidence: 0.8 },
        }],
      };
      return {
        jobId: job.id,
        projectKey: job.projectKey,
        corpusKey: job.corpusKey,
        providerResult,
        evaluation: evaluateMssrSemanticCuration({ blocks: job.blocks, result: providerResult }),
        batchId: `fixture:${index + 1}`,
        usage: { input_tokens: 10, output_tokens: 5 },
        elapsedMs: 1,
      };
    });
    return {
      results,
      batches: results.map((result, index) => ({
        batchId: result.batchId,
        projectKey: result.projectKey,
        corpusKey: result.corpusKey,
        jobIds: [result.jobId],
        heads: 11,
        stateChars: 100,
        model: "fixture-model",
        usage: result.usage,
        elapsedMs: 1,
      })),
      rejected: [],
      totalInputTokens: results.length * 10,
      totalOutputTokens: results.length * 5,
      totalHeads: results.length * 11,
      policy: { maxHeadsPerRequest, mixedProjectState: false, parallelRequests: true },
    };
  };

  const review = await reviewMssrProjectEvidenceGraph({
    projectRoot,
    maxSources: 32,
    maxBlocks: 128,
    maxPairs: 4,
    minScore: 0.1,
    reviewRoot,
    distillationStorePath,
    experienceStorePath,
    trace: { traceId: "mssr-evidence-trace-001", workflowKey: "evidence-graph-test" },
    persist: true,
    execute: fakeExecute,
  });
  assert.equal(review.advisoryOnly, true);
  assert.equal(review.canonicalRewriteAllowed, false);
  assert.ok(review.reviewPath);
  const persisted = await fs.readFile(review.reviewPath, "utf8");
  const parsed = JSON.parse(persisted);
  assert.equal(parsed.sourceTextDuplicated, false);
  assert.equal(parsed.retrievalTruthAuthority, false);
  assert.equal(parsed.freshnessAuthority, false);
  assert.equal(parsed.canonicalRewriteAllowed, false);
  assert.ok(parsed.jobs.every((job) => job.blockProvenance.every((block) => !("text" in block))));
  assert.ok(!persisted.includes("Current npm run check verification passes with 0 errors"));
  assert.ok(!persisted.includes("Previous npm run check verification reported 1 inherited"));
  const learningStore = JSON.parse(await fs.readFile(distillationStorePath, "utf8"));
  assert.ok(learningStore.observations.length > 0);
  assert.ok(learningStore.observations.every((observation) => observation.trace?.traceId === "mssr-evidence-trace-001"));
  assert.ok(learningStore.observations.every((observation) => observation.verification.status === "unknown"), "Trace association must not verify Jev output");
  const experienceStore = JSON.parse(await fs.readFile(experienceStorePath, "utf8"));
  assert.ok(experienceStore.observations.length > 0);
  assert.ok(experienceStore.observations.every((observation) => observation.decisionKind === "semantic-relation"));
  assert.ok(experienceStore.observations.every((observation) => observation.trace?.traceId === "mssr-evidence-trace-001"));
  assert.ok(experienceStore.observations.every((observation) => observation.verification.status === "unknown"));
  assert.ok(experienceStore.observations.every((observation) => !JSON.stringify(observation).includes("Current npm run check verification passes with 0 errors")));
  assert.equal(review.experienceLearning.observationsRecorded, experienceStore.observations.length);

  console.log("semantic-curation-evidence-graph tests passed");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
