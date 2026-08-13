import assert from "node:assert/strict";
import {
  PRODUCER_SOURCE_KINDS,
  deterministicProducerDedupeKey,
  mssrContextMessageSchema,
  mssrProducerObservationBatchSchema,
  mssrProducerObservationSchema,
  produceContextMessages,
  produceSingleContextMessage,
} from "../dist/index.js";

const baseObs = {
  ref: "adr-042",
  title: "Context plane decision",
  summary: "MSSR owns portable message semantics.",
  canonicalOwner: "mssr",
  provenance: "project",
  availability: true,
  revision: "abc123",
};

// --- All source kinds produce correct message kind and evidence kind ---

const architectureObs = {
  id: "arch-ctx-plane",
  sourceKind: "architecture-decision",
  ...baseObs,
  domains: ["skill-system"],
  actions: ["edit"],
};

const incidentObs = {
  id: "inc-provider-017",
  sourceKind: "incident",
  ref: "MSSR-017",
  title: "Provider refresh race",
  summary: "Catalog update race condition.",
  ...baseObs,
  advisoryActions: ["refresh-provider"],
};

const changelogObs = {
  id: "cl-030",
  sourceKind: "changelog",
  ref: "0.3.0",
  title: "Release 0.3.0",
  summary: "Portable context messages.",
  ...baseObs,
};

const projectContextObs = {
  id: "pc-selector",
  sourceKind: "project-context",
  ref: "context-selectors",
  title: "Selector rules",
  summary: "Selectors use AND across dimensions.",
  ...baseObs,
  signals: ["warning-observed"],
};

const gitReceiptObs = {
  id: "git-rev-abc",
  sourceKind: "git-receipt",
  ref: "commit/abc123",
  title: "Git receipt",
  summary: "Commit abc123 recorded.",
  ...baseObs,
  provenance: "git",
};

const providerReceiptObs = {
  id: "prov-check-1",
  sourceKind: "provider-receipt",
  ref: "provider-check",
  title: "Provider receipt",
  summary: "Provider health check.",
  ...baseObs,
  provenance: "provider",
};

const projectMemoryObs = {
  id: "pm-byte-for-byte",
  sourceKind: "project-memory",
  ref: "memory/byte-for-byte",
  title: "Memory record",
  summary: "Byte-for-byte memory note.",
  ...baseObs,
};

const projectStateObs = {
  id: "ps-current-state",
  sourceKind: "project-state",
  ref: "state/current",
  title: "State record",
  summary: "Current project state note.",
  ...baseObs,
};

const allMessages = produceContextMessages([
  architectureObs,
  incidentObs,
  changelogObs,
  projectContextObs,
  gitReceiptObs,
  providerReceiptObs,
  projectMemoryObs,
  projectStateObs,
]);

assert.equal(allMessages.length, 8);
assert.equal(
  allMessages.every((message) => mssrContextMessageSchema.safeParse(message).success),
  true,
);

const archMsg = allMessages[0];
assert.equal(archMsg.kind, "architecture-decision");
assert.equal(archMsg.evidence[0]?.kind, "architecture-decision");
assert.equal(archMsg.evidence[0]?.freshness, "unknown");
assert.equal(archMsg.advisoryActions.includes("inspect-reference"), true);
assert.equal(archMsg.advisoryActions.includes("record-decision"), true);

const incMsg = allMessages[1];
assert.equal(incMsg.kind, "related-incident");
assert.equal(incMsg.evidence[0]?.kind, "incident");
assert.equal(incMsg.advisoryActions.includes("refresh-provider"), true);
assert.equal(incMsg.advisoryActions.length, 1);

const clMsg = allMessages[2];
assert.equal(clMsg.kind, "recent-changelog");
assert.equal(clMsg.evidence[0]?.kind, "changelog");
assert.equal(clMsg.advisoryActions.includes("load-context"), true);

const pcMsg = allMessages[3];
assert.equal(pcMsg.kind, "context-request");
assert.equal(pcMsg.evidence[0]?.kind, "project-context");

const gitMsg = allMessages[4];
assert.equal(gitMsg.kind, "publication-receipt-stale");
assert.equal(gitMsg.evidence[0]?.kind, "publication");
assert.equal(gitMsg.evidence[0]?.provenance, "git");
assert.equal(gitMsg.advisoryActions.includes("verify-runtime"), true);

const provMsg = allMessages[5];
assert.equal(provMsg.kind, "provider-degraded");
assert.equal(provMsg.evidence[0]?.kind, "verification");
assert.equal(provMsg.evidence[0]?.provenance, "provider");
assert.equal(provMsg.advisoryActions.includes("refresh-provider"), true);

const pmMsg = allMessages[6];
assert.equal(pmMsg.kind, "context-request");
assert.equal(pmMsg.evidence[0]?.kind, "project-memory");

const psMsg = allMessages[7];
assert.equal(psMsg.kind, "context-request");
assert.equal(psMsg.evidence[0]?.kind, "project-state");

// --- Unavailable observation ---

const unavailObs = {
  id: "prov-down",
  sourceKind: "provider-receipt",
  ref: "provider-check",
  title: "Provider unavailable",
  summary: "Provider did not respond.",
  canonicalOwner: "mssr",
  provenance: "provider",
  availability: false,
  observedAt: "2026-08-13T12:00:00.000Z",
};

const unavailMsg = produceSingleContextMessage(unavailObs);
assert.equal(unavailMsg.kind, "provider-degraded");
assert.equal(unavailMsg.evidence[0]?.freshness, "unavailable");

// --- Unavailable observation without revision or timestamp is representable ---

const unavailNoStampObs = {
  id: "prov-quiet",
  sourceKind: "provider-receipt",
  ref: "provider-check",
  title: "Provider unavailable",
  summary: "Provider did not respond and the survey read no revision or timestamp.",
  canonicalOwner: "mssr",
  provenance: "provider",
  availability: false,
};

const unavailNoStampMsg = produceSingleContextMessage(unavailNoStampObs);
assert.equal(unavailNoStampMsg.kind, "provider-degraded");
assert.equal(unavailNoStampMsg.evidence.length, 0);

// --- A caller-supplied receipt alone is not fresh; authoritative observations are ---

const receiptOnly = produceSingleContextMessage({
  ...architectureObs,
  id: "arch-receipt-only",
});
assert.equal(receiptOnly.evidence[0]?.freshness, "unknown");

const authoritative = produceSingleContextMessage({
  ...architectureObs,
  id: "arch-authoritative",
  authoritative: true,
});
assert.equal(authoritative.evidence[0]?.freshness, "fresh");

// --- Selectors carried through ---

const selectorObs = {
  id: "sel-full",
  sourceKind: "architecture-decision",
  ...baseObs,
  stages: ["start", "verify"],
  domains: ["coding", "skill-system"],
  actions: ["edit", "verify"],
  artifacts: ["code"],
  needs: ["unit-tests"],
  signals: ["warning-observed"],
};

const selMsg = produceSingleContextMessage(selectorObs);
assert.deepEqual(selMsg.stages, ["start", "verify"]);
assert.deepEqual(selMsg.domains, ["coding", "skill-system"]);
assert.deepEqual(selMsg.actions, ["edit", "verify"]);
assert.deepEqual(selMsg.artifacts, ["code"]);
assert.deepEqual(selMsg.needs, ["unit-tests"]);
assert.deepEqual(selMsg.signals, ["warning-observed"]);

// --- Severity and priority carried through ---

const prioObs = {
  id: "prio-high",
  sourceKind: "incident",
  ref: "MSSR-031",
  title: "High priority",
  summary: "Critical incident.",
  canonicalOwner: "mssr",
  provenance: "project",
  availability: true,
  revision: "fix-031",
  severity: "warning",
  priority: 50,
  estimatedChars: 200,
};

const prioMsg = produceSingleContextMessage(prioObs);
assert.equal(prioMsg.severity, "warning");
assert.equal(prioMsg.priority, 50);
assert.equal(prioMsg.estimatedChars, 200);

// --- Missing observedAt and revision rejected ---

const missingTsRevision = mssrProducerObservationSchema.safeParse({
  id: "bad-ts",
  sourceKind: "changelog",
  ref: "0.3.0",
  title: "Bad",
  summary: "Missing observedAt and revision.",
  canonicalOwner: "mssr",
  provenance: "project",
  availability: true,
});
assert.equal(missingTsRevision.success, false);

// --- Extra field (rawPrompt) rejected by strict schema ---

const rawPromptRejected = mssrProducerObservationSchema.safeParse({
  id: "bad-raw",
  sourceKind: "architecture-decision",
  ref: "adr-001",
  title: "Bad",
  summary: "Strict schema rejects raw payload.",
  canonicalOwner: "mssr",
  provenance: "project",
  availability: true,
  revision: "abc123",
  rawPrompt: "secret content",
});
assert.equal(rawPromptRejected.success, false);

// --- Unavailability without revision/timestamp accepted ---

const unavailNoTs = mssrProducerObservationSchema.safeParse({
  id: "unavail-quiet",
  sourceKind: "provider-receipt",
  ref: "check",
  title: "OK",
  summary: "Unavailable without ts or revision.",
  canonicalOwner: "mssr",
  provenance: "provider",
  availability: false,
});
assert.equal(unavailNoTs.success, true);

// --- Unavailability with observedAt accepted ---

const unavailWithTs = mssrProducerObservationSchema.safeParse({
  id: "unavail-ts",
  sourceKind: "provider-receipt",
  ref: "check",
  title: "OK",
  summary: "Unavailable with observedAt.",
  canonicalOwner: "mssr",
  provenance: "provider",
  availability: false,
  observedAt: "2026-08-13T12:00:00.000Z",
});
assert.equal(unavailWithTs.success, true);

// --- Deterministic dedupeKey across caller message ids ---

const dedupeA = produceSingleContextMessage(changelogObs);
const dedupeB = produceSingleContextMessage({ ...changelogObs, id: "cl-same-evidence" });
assert.equal(typeof dedupeA.dedupeKey, "string");
assert.equal(dedupeA.dedupeKey, dedupeB.dedupeKey);
assert.equal(
  deterministicProducerDedupeKey(changelogObs),
  deterministicProducerDedupeKey({ ...changelogObs, id: "cl-same-evidence" }),
);
assert.equal(mssrContextMessageSchema.parse(dedupeA).dedupeKey, dedupeA.dedupeKey);

// --- Bounded observation batch ---

const thirtyTwo = Array.from({ length: 32 }, (_, index) => ({
  ...baseObs,
  id: `batch-${index}`,
  sourceKind: "changelog",
  ref: `0.0.${index}`,
}));
assert.equal(mssrProducerObservationBatchSchema.safeParse(thirtyTwo).success, true);
assert.equal(produceContextMessages(thirtyTwo).length, 32);

const thirtyThree = Array.from({ length: 33 }, (_, index) => ({
  ...baseObs,
  id: `batch-${index}`,
  sourceKind: "changelog",
  ref: `0.0.${index}`,
}));
assert.equal(mssrProducerObservationBatchSchema.safeParse(thirtyThree).success, false);
assert.throws(() => produceContextMessages(thirtyThree));

// --- produceSingleContextMessage returns exactly one ---

const single = produceSingleContextMessage(changelogObs);
assert.equal(single.kind, "recent-changelog");
assert.equal(typeof single.id, "string");

console.log("context message producers tests passed");
