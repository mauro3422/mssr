import assert from "node:assert/strict";

import {
  buildMssrKnowledgeRevisionSituation,
  evaluateMssrSituationModel,
  mssrSituationObservationSchema,
} from "../dist/situation-model.js";

const owner = "D:/Dev/example";
const canonicalMemory = {
  id: "project-memory:.mssr-project-memory.md",
  sourceKind: "project-memory",
  ref: ".mssr/PROJECT_MEMORY.md",
  title: "Project Memory",
  summary: "Durable project decisions.",
  canonicalOwner: owner,
  provenance: "project",
  availability: true,
  authoritative: true,
  observedAt: "2026-08-16T12:00:00.000Z",
  revision: "rev-memory-new",
  stages: [], domains: [], actions: [], artifacts: [], needs: [], signals: [],
  severity: "info",
  required: false,
  priority: 0,
  estimatedChars: 320,
};

function memoryMessage(revision) {
  return {
    id: "memory-context-message",
    kind: "context-request",
    severity: "info",
    title: "Memory context",
    summary: "Selected memory evidence.",
    evidence: [{
      kind: "project-memory",
      ref: ".mssr/PROJECT_MEMORY.md",
      summary: "Durable project decisions.",
      canonicalOwner: owner,
      provenance: "project",
      freshness: "fresh",
      observedAt: "2026-08-16T11:00:00.000Z",
      revision,
    }],
    advisoryActions: ["load-context"],
    stages: [], domains: [], actions: [], artifacts: [], needs: [], signals: [],
    required: false,
    priority: 0,
    estimatedChars: 320,
  };
}

const staleObservations = buildMssrKnowledgeRevisionSituation({
  repositoryObservations: [canonicalMemory],
  selectedMessages: [memoryMessage("rev-memory-old")],
});
const stale = evaluateMssrSituationModel({ boundary: "context-load", observations: staleObservations });
assert.equal(stale.decision.level, "review");
assert.equal(stale.decision.nextAction, "revalidate-context-evidence");
assert.equal(stale.classification.noticeClass, "context-refresh");
assert.equal(stale.classification.primaryCategory, "project-memory");
assert.ok(stale.classification.priority >= 65);
assert.equal(stale.classification.advisoryOnly, true);
assert.ok(stale.decision.reasonCodes.includes("memory-claim-mismatch"));

const current = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrKnowledgeRevisionSituation({
    repositoryObservations: [canonicalMemory],
    selectedMessages: [memoryMessage("rev-memory-new")],
  }),
});
assert.equal(current.decision.level, "ok");
assert.equal(current.decision.nextAction, null);
const deliveryReceiptStale = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrKnowledgeRevisionSituation({
    repositoryObservations: [canonicalMemory],
    deliveryReceipts: [{
      messageId: "memory-delivery",
      messageKind: "context-request",
      selectedCount: 1,
      firstSelectedAt: "2026-08-16T10:00:00.000Z",
      lastSelectedAt: "2026-08-16T10:00:00.000Z",
      sources: memoryMessage("rev-memory-old").evidence,
    }],
  }),
});
assert.equal(deliveryReceiptStale.decision.level, "review", "a durable receipt must remain comparable after the original host turn is gone");
assert.equal(deliveryReceiptStale.decision.nextAction, "revalidate-context-evidence");
assert.equal(deliveryReceiptStale.observations.some((item) => item.observer.startsWith("delivery:memory-delivery:")), true);

const oldReceipt = {
  messageId: "memory-delivery-old",
  messageKind: "context-request",
  selectedCount: 1,
  firstSelectedAt: "2026-08-16T09:00:00.000Z",
  lastSelectedAt: "2026-08-16T09:00:00.000Z",
  sources: memoryMessage("rev-memory-old").evidence,
};
const newerReceipt = {
  messageId: "memory-delivery-new",
  messageKind: "context-request",
  selectedCount: 1,
  firstSelectedAt: "2026-08-16T12:00:00.000Z",
  lastSelectedAt: "2026-08-16T12:00:00.000Z",
  sources: memoryMessage("rev-memory-new").evidence,
};
const newestReceiptWins = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrKnowledgeRevisionSituation({
    repositoryObservations: [canonicalMemory],
    deliveryReceipts: [newerReceipt, oldReceipt],
  }),
});
assert.equal(newestReceiptWins.decision.level, "ok", "an older stale receipt must not poison a newer current delivery for the same authority");
assert.equal(newestReceiptWins.observations.some((item) => item.observer.startsWith("delivery:memory-delivery-old:")), false);

const currentSelectionSupersedesReceipt = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrKnowledgeRevisionSituation({
    repositoryObservations: [canonicalMemory],
    selectedMessages: [memoryMessage("rev-memory-new")],
    deliveryReceipts: [oldReceipt],
  }),
});
assert.equal(currentSelectionSupersedesReceipt.decision.level, "ok", "a current context selection must resolve an older stale delivery receipt immediately");
assert.equal(currentSelectionSupersedesReceipt.observations.some((item) => item.observer.startsWith("delivery:memory-delivery-old:")), false);
assert.equal(currentSelectionSupersedesReceipt.observations.some((item) => item.observer.startsWith("context:memory-context-message:")), true);
const longOwnerPrefix = `D:/Dev/${"very-long-workspace-segment/".repeat(10)}`;
const collisionGuard = buildMssrKnowledgeRevisionSituation({
  repositoryObservations: [
    { ...canonicalMemory, canonicalOwner: longOwnerPrefix, ref: ".mssr/PROJECT_MEMORY.md" },
    { ...canonicalMemory, id: "project-state:long", sourceKind: "project-state", canonicalOwner: longOwnerPrefix, ref: ".mssr/PROJECT_STATE.md" },
  ],
});
assert.equal(new Set(collisionGuard.map((item) => item.key)).size, 2, "long owner/ref identities must not collapse after C2c key bounds");

const inferredCanonical = mssrSituationObservationSchema.safeParse({
  key: "project.fact",
  observer: "inference-engine",
  role: "reference",
  authority: "canonical",
  state: "observed",
  value: "x",
  category: "other",
  evidenceClass: "inferred",
});
assert.equal(inferredCanonical.success, false, "inferred evidence must never become canonical truth");

const inferredOnly = evaluateMssrSituationModel({
  boundary: "pre-execution",
  observations: [{
    key: "project.fact",
    observer: "inference-engine",
    role: "reference",
    authority: "replica",
    state: "observed",
    value: "possible-value",
    category: "other",
    evidenceClass: "inferred",
  }],
});
assert.equal(inferredOnly.observations[0].confidence, 0.6);
assert.equal(inferredOnly.decision.level, "watch");
assert.equal(inferredOnly.decision.nextAction, "load-canonical-authority");

const learnedHistorical = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: [
    {
      key: "project.release",
      observer: "PROJECT_STATE",
      role: "state",
      authority: "canonical",
      state: "observed",
      value: "2",
      category: "project-state",
      evidenceClass: "declared",
    },
    {
      key: "project.release",
      observer: "learning-digest",
      role: "memory",
      authority: "historical",
      state: "observed",
      value: "1",
      category: "project-memory",
      evidenceClass: "learned",
    },
  ],
});
assert.equal(learnedHistorical.decision.level, "review");
assert.equal(learnedHistorical.decision.nextAction, "revalidate-context-evidence");
assert.equal(learnedHistorical.observations.find((item) => item.evidenceClass === "learned")?.confidence, 0.5);

const release = evaluateMssrSituationModel({
  boundary: "pre-release",
  observations: [
    { key: "release.version", observer: "package", role: "source", authority: "canonical", state: "observed", value: "2", category: "release", evidenceClass: "observed", required: true },
    { key: "release.version", observer: "changelog", role: "reference", authority: "historical", state: "observed", value: "1", category: "changelog", evidenceClass: "declared" },
  ],
});
assert.equal(release.classification.noticeClass, "release-integrity");
assert.equal(release.decision.level, "review");

console.log("MSSR C2e Situation Model: PASS");
