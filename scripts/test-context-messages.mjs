import assert from "node:assert/strict";
import {
  mssrContextMessageSchema,
  selectMssrContextMessages,
  structuredSkillIntentSchema,
} from "../dist/index.js";

const intent = structuredSkillIntentSchema.parse({
  domains: ["coding", "skill-system"],
  actions: ["edit", "verify"],
  artifacts: ["code", "repository"],
  needs: ["unit-tests"],
  signals: ["warning-observed"],
  risk: "write",
});

const messages = mssrContextMessageSchema.array().parse([
  {
    id: "architecture-context-plane",
    kind: "architecture-decision",
    severity: "attention",
    title: "Context plane decision applies",
    summary: "MSSR owns portable message semantics; adapters retrieve source evidence.",
    evidence: [{ kind: "architecture-decision", ref: "ADR-042", summary: "Portable context plane.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "abc123" }],
    advisoryActions: ["inspect-reference"],
    domains: ["skill-system"],
    actions: ["edit"],
    estimatedChars: 180,
  },
  {
    id: "unrelated-godot",
    kind: "recent-changelog",
    title: "Godot-only note",
    summary: "Unrelated graph audit note.",
    evidence: [{ kind: "changelog", ref: "godot-0.1", summary: "Graph audit.", canonicalOwner: "godot", provenance: "project", freshness: "fresh", revision: "v0.1" }],
    domains: ["godot"],
    actions: ["review"],
    estimatedChars: 180,
  },
  {
    id: "partial-selector-mismatch",
    kind: "context-request",
    title: "Selector requires the full stated scope",
    summary: "Coding matches, but the message is only relevant to review work.",
    evidence: [{ kind: "project-context", ref: "context-selectors", summary: "Selectors use AND across specified dimensions.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "abc123" }],
    domains: ["coding"],
    actions: ["review"],
    estimatedChars: 180,
  },
  {
    id: "required-continuation",
    kind: "continuation",
    severity: "warning",
    title: "Continuation required",
    summary: "A source implementation is complete but runtime verification is pending.",
    advisoryActions: ["resume-trace", "verify-runtime"],
    required: true,
    estimatedChars: 200,
    continuation: {
      traceId: "trace-context-v1",
      projectRevision: "abc123",
      freshness: "stale",
      unresolvedRefs: ["ADR-042", "MSSR-031"],
      sourceReceipts: [{ kind: "trace", ref: "trace-context-v1", summary: "Trace awaits live verification.", canonicalOwner: "mssr", provenance: "trace", freshness: "stale", revision: "abc123" }],
      currentStage: "verify",
      completedPhases: ["implementation"],
      nextGate: "Verify the serving host after restart.",
      summary: "Portable Context Messages source change awaits runtime verification.",
    },
  },
  {
    id: "incident-provider-old",
    kind: "related-incident",
    title: "Repeated provider incident",
    summary: "A prior provider refresh omitted the newest catalog update.",
    evidence: [{ kind: "incident", ref: "MSSR-017", summary: "Refresh race regression.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "fix-017" }],
    advisoryActions: ["refresh-provider"],
    signals: ["warning-observed"],
    dedupeKey: "provider-refresh",
    priority: 10,
    estimatedChars: 160,
  },
  {
    id: "incident-provider-new",
    kind: "related-incident",
    severity: "attention",
    title: "Current provider incident",
    summary: "A newer incident is relevant to the observed provider warning.",
    evidence: [{ kind: "incident", ref: "MSSR-031", summary: "Newer refresh regression.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "fix-031" }],
    advisoryActions: ["refresh-provider"],
    signals: ["warning-observed"],
    dedupeKey: "provider-refresh",
    priority: 30,
    estimatedChars: 160,
  },
  {
    id: "stale-publication",
    kind: "publication-receipt-stale",
    severity: "warning",
    title: "Publication receipt is stale",
    summary: "The recorded runtime version predates the source revision.",
    evidence: [{ kind: "publication", ref: "release-0.2.8", summary: "Live receipt is older than source.", canonicalOwner: "mssr", provenance: "host", freshness: "stale", observedAt: "2026-08-13T17:00:00.000Z" }],
    advisoryActions: ["verify-runtime"],
    required: true,
    estimatedChars: 180,
  },
]);

const selected = selectMssrContextMessages({ messages, intent, stage: "implement", maxMessages: 6, maxChars: 5_000 });
assert.deepEqual(selected.selected.map((message) => message.id), [
  "required-continuation",
  "stale-publication",
  "incident-provider-new",
  "architecture-context-plane",
]);
assert.equal(selected.decisions.find((decision) => decision.id === "unrelated-godot")?.reason, "intent-mismatch");
assert.equal(selected.decisions.find((decision) => decision.id === "partial-selector-mismatch")?.reason, "intent-mismatch");
assert.equal(selected.decisions.find((decision) => decision.id === "incident-provider-old")?.reason, "deduplicated");
assert.equal(selected.continuationReceipts[0]?.nextGate, "Verify the serving host after restart.");
assert.equal(selected.continuationReceipts[0]?.freshness, "stale");
assert.equal(selected.advisoryOnly, true);
assert.equal(selected.selectedChars <= 5_000, true);

assert.equal(mssrContextMessageSchema.parse({
  id: "conflicting-evidence",
  kind: "roadmap-contradiction",
  title: "Evidence conflicts",
  summary: "The roadmap claim and source evidence disagree.",
  evidence: [{ kind: "changelog", ref: "0.2.8", summary: "Source changed after roadmap entry.", canonicalOwner: "mssr", provenance: "project", freshness: "conflicting", revision: "abc123" }],
  domains: ["skill-system"],
}).evidence[0].freshness, "conflicting");
assert.equal(mssrContextMessageSchema.parse({
  id: "provider-evidence-unavailable",
  kind: "provider-degraded",
  title: "Provider evidence unavailable",
  summary: "The provider did not return an authoritative revision.",
  evidence: [{ kind: "verification", ref: "provider-check", summary: "Provider health could not be read.", canonicalOwner: "provider-a", provenance: "provider", freshness: "unavailable", observedAt: "2026-08-13T17:00:00.000Z" }],
  domains: ["coding"],
}).evidence[0].freshness, "unavailable");

const bounded = selectMssrContextMessages({ messages, intent, stage: "implement", maxMessages: 2, maxChars: 390 });
assert.deepEqual(bounded.selected.map((message) => message.id), ["required-continuation", "stale-publication"]);
assert.equal(bounded.decisions.find((decision) => decision.id === "incident-provider-new")?.reason, "max-messages-exceeded");
assert.equal(bounded.selectedChars, bounded.selected.reduce((sum, message) => sum + Math.max(message.estimatedChars, JSON.stringify(message).length), 0));

const budgetRejected = selectMssrContextMessages({ messages, intent, stage: "implement", maxMessages: 6, maxChars: 250 });
assert.deepEqual(budgetRejected.selected.map((message) => message.id), ["required-continuation", "stale-publication"]);
assert.equal(budgetRejected.requiredBudgetExceeded, true);
assert.equal(budgetRejected.selectedChars, budgetRejected.selected.reduce((sum, message) => sum + Math.max(message.estimatedChars, JSON.stringify(message).length), 0));
assert.equal(budgetRejected.remainingChars, 0);
assert.equal(budgetRejected.remainingMessages, 4);

const proposal = mssrContextMessageSchema.parse({
  id: "incident-persistence-proposal",
  kind: "persistence-proposal",
  title: "Record recurring provider incident",
  summary: "The recurrence is evidence for a reviewed incident entry.",
  evidence: [{ kind: "incident", ref: "MSSR-031", summary: "Newer refresh regression.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "fix-031" }],
  persistenceProposal: {
    target: "incident",
    summary: "Propose a reviewed incident ledger update, never an automatic write.",
    evidence: [{ kind: "incident", ref: "MSSR-031", summary: "Newer refresh regression.", canonicalOwner: "mssr", provenance: "project", freshness: "fresh", revision: "fix-031" }],
    reviewRequired: true,
  },
  domains: ["skill-system"],
});
assert.equal(proposal.persistenceProposal?.reviewRequired, true);

const missingFreshnessEvidence = mssrContextMessageSchema.safeParse({
  id: "bad-evidence",
  kind: "related-incident",
  title: "Bad evidence",
  summary: "Evidence must establish provenance and freshness.",
  evidence: [{ kind: "incident", ref: "MSSR-0", summary: "Missing required fields." }],
  domains: ["coding"],
});
assert.equal(missingFreshnessEvidence.success, false);

const hardCapMessages = Array.from({ length: 11 }, (_, index) => ({
  ...messages.find((message) => message.id === "required-continuation"),
  id: `required-overflow-${index}`,
  estimatedChars: 2_000,
}));
const hardCap = selectMssrContextMessages({ messages: hardCapMessages, intent, stage: "implement", maxMessages: 1, maxChars: 1 });
assert.equal(hardCap.selected.length, 10);
assert.equal(hardCap.requiredBudgetExceeded, true);
assert.equal(hardCap.requiredMessageOverflow.length, 1);
assert.equal(hardCap.decisions.find((decision) => decision.id === hardCap.requiredMessageOverflow[0])?.reason, "required-message-overflow");

const underestimated = mssrContextMessageSchema.parse({
  id: "underestimated-message",
  kind: "related-incident",
  title: "Serialized size outranks an optimistic hint",
  summary: "x".repeat(500),
  signals: ["warning-observed"],
  estimatedChars: 40,
});
const actualUnderestimatedChars = JSON.stringify(underestimated).length;
const underestimatedSelection = selectMssrContextMessages({ messages: [underestimated], intent, stage: "implement", maxMessages: 1, maxChars: actualUnderestimatedChars - 1 });
assert.deepEqual(underestimatedSelection.selected, []);
assert.equal(underestimatedSelection.decisions[0].reason, "budget-exceeded");
assert.equal(underestimatedSelection.decisions[0].estimatedChars, actualUnderestimatedChars);

const forbiddenExtraField = mssrContextMessageSchema.safeParse({
  id: "bad-message",
  kind: "continuation",
  title: "Bad",
  summary: "Strict schema rejects raw payload fields.",
  prompt: "do not retain this",
});
assert.equal(forbiddenExtraField.success, false);

console.log("context message tests passed");
