import assert from "node:assert/strict";
import {
  MSSR_SEMANTIC_CURATION_SCHEMA_VERSION,
  assembleMssrSemanticReferenceProposals,
  evaluateMssrSemanticCuration,
  hashSemanticCurationText,
  planMssrSemanticCurationQueue,
} from "../dist/index.js";

function block(id, text, overrides = {}) {
  return {
    id,
    text,
    sourceRef: `.mssr/${id}.md`,
    sha256: hashSemanticCurationText(text),
    topicCandidates: ["context-economy", "verification", "ui"],
    ...overrides,
  };
}

const blocks = [
  block("b1", "Never drop the active no-push restriction.", { protected: true, validity: "current" }),
  block("b2", "Old dashboard accent was red.", { validity: "historical" }),
  block("b3", "The loader previously materialized optional modules before final budget selection.", { validity: "historical" }),
];

const result = {
  schemaVersion: MSSR_SEMANTIC_CURATION_SCHEMA_VERSION,
  provider: "fixture",
  modelId: "fixture-model",
  blockJudgments: [
    {
      blockId: "b1",
      role: { value: "durable-decision", confidence: 0.99 },
      destination: { value: "drop", confidence: 0.95 },
      protectedProbability: 0.99,
      topic: { value: "verification", confidence: 0.99 },
    },
    {
      blockId: "b2",
      role: { value: "noise", confidence: 0.95 },
      destination: { value: "drop", confidence: 0.95 },
      protectedProbability: 0.01,
      topic: { value: "ui", confidence: 0.95 },
    },
    {
      blockId: "b3",
      role: { value: "history", confidence: 0.96 },
      destination: { value: "knowledge-ref", confidence: 0.94 },
      protectedProbability: 0.1,
      topic: { value: "context-economy", confidence: 0.98 },
    },
  ],
  pairJudgments: [
    {
      leftId: "b1",
      rightId: "b3",
      relation: { value: "supports", confidence: 0.92 },
      connector: { value: "therefore", confidence: 0.91 },
    },
    {
      leftId: "b2",
      rightId: "b3",
      relation: { value: "contradicts", confidence: 0.93 },
    },
  ],
};

const evaluation = evaluateMssrSemanticCuration({
  blocks,
  result,
  pairCandidates: [
    { leftId: "b1", rightId: "b3" },
    { leftId: "b2", rightId: "b3" },
  ],
});
const b1 = evaluation.blocks.find((item) => item.blockId === "b1");
const b2 = evaluation.blocks.find((item) => item.blockId === "b2");
const b3 = evaluation.blocks.find((item) => item.blockId === "b3");
assert.equal(b1.destination, "review");
assert.equal(b1.protected, true);
assert.equal(b1.automaticDropAllowed, false);
assert.ok(b1.reviewReasons.includes("protected-drop-conflict"));
assert.equal(b2.destination, "drop");
assert.equal(b2.automaticDropAllowed, true);
assert.equal(b3.destination, "knowledge-ref");
assert.equal(evaluation.pairs.find((item) => item.leftId === "b1" && item.rightId === "b3").accepted, true);
assert.equal(evaluation.pairs.find((item) => item.leftId === "b2" && item.rightId === "b3").accepted, false);
assert.equal(evaluation.reviewRequired, true);
assert.equal(evaluation.canonicalRewriteAllowed, false);

const unofferedPair = evaluateMssrSemanticCuration({ blocks, result });
assert.equal(unofferedPair.pairs.every((item) => !item.accepted && item.reviewReasons.includes("pair-not-offered")), true);

const refs = assembleMssrSemanticReferenceProposals({ blocks, evaluation });
assert.deepEqual(refs.map((ref) => ref.topic), ["context-economy"]);
assert.deepEqual(refs[0].blockIds, ["b3"]);
assert.ok(refs[0].markdown.includes(blocks[2].text));
assert.equal(refs[0].exactSourceTextOnly, true);

const queue = planMssrSemanticCurationQueue({
  maxHeads: 64,
  maxStateChars: 10_000,
  items: [
    { id: "a-1", projectKey: "D:/Dev/A", corpusKey: "shared-a", sourceRef: "a1.md", reasons: ["project-context-entry-budget-exceeded"], estimatedHeads: 30, estimatedStateChars: 2000, priority: 10 },
    { id: "a-2", projectKey: "D:/Dev/A", corpusKey: "shared-a", sourceRef: "a2.md", reasons: ["duplicate-candidate"], estimatedHeads: 30, estimatedStateChars: 2000, priority: 9 },
    { id: "a-3", projectKey: "D:/Dev/A", corpusKey: "separate-a", sourceRef: "a3.md", reasons: ["stale-current-state"], estimatedHeads: 10, estimatedStateChars: 1000, priority: 8 },
    { id: "b-1", projectKey: "D:/Dev/B", corpusKey: "b", sourceRef: "b1.md", reasons: ["skill-context-budget-exceeded"], estimatedHeads: 20, estimatedStateChars: 1500, priority: 10 },
  ],
});
assert.equal(queue.totalItems, 4);
assert.equal(queue.totalBatches, 3);
assert.equal(queue.parallelProjectGroups, 2);
const sharedABatch = queue.batches.find((batch) => batch.projectKey === "D:/Dev/A" && batch.corpusKey === "shared-a");
const separateABatch = queue.batches.find((batch) => batch.projectKey === "D:/Dev/A" && batch.corpusKey === "separate-a");
const bBatch = queue.batches.find((batch) => batch.projectKey === "D:/Dev/B" && batch.corpusKey === "b");
assert.deepEqual(sharedABatch?.itemIds, ["a-1", "a-2"]);
assert.equal(sharedABatch?.estimatedHeads, 60);
assert.equal(sharedABatch?.remainingHeads, 4);
assert.equal(sharedABatch?.mixedProjectState, false);
assert.deepEqual(separateABatch?.itemIds, ["a-3"]);
assert.deepEqual(bBatch?.itemIds, ["b-1"]);
assert.equal(new Set(queue.batches.map((batch) => batch.projectKey)).size, 2);
assert.equal(new Set(queue.batches.filter((batch) => batch.projectKey === "D:/Dev/A").map((batch) => batch.corpusKey)).size, 2);

const rejected = planMssrSemanticCurationQueue({
  maxStateChars: 1000,
  items: [
    { id: "too-big", projectKey: "D:/Dev/A", sourceRef: "huge.md", reasons: ["manual-review"], estimatedHeads: 10, estimatedStateChars: 2000 },
  ],
});
assert.deepEqual(rejected.rejected, [{ itemId: "too-big", reason: "state-budget-exceeded" }]);
assert.equal(rejected.totalBatches, 0);

console.log("semantic-curation tests passed");
