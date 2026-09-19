import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  evaluateMssrSemanticConsistency,
  extractMssrDeclaredStateClaims,
  extractMssrRoadmapGateClaims,
} from "../dist/index.js";

const roadmapPending = extractMssrRoadmapGateClaims({
  markdown: "- [ ] **R3 — Context Economy v2:** host adoption pending.\n",
  sourceRef: "ROADMAP.md",
});
const projectCompleted = extractMssrDeclaredStateClaims({
  markdown: "<!-- mssr-state:roadmap.r3=completed -->\n",
  sourceRef: ".mssr/PROJECT_STATE.md",
});

assert.equal(roadmapPending.length, 1);
assert.equal(roadmapPending[0].subject, "roadmap.r3");
assert.equal(roadmapPending[0].value, "pending");
assert.equal(roadmapPending[0].extractor, "roadmap-checklist-v1");
assert.equal(projectCompleted[0].value, "completed");
assert.equal(projectCompleted[0].authority, "canonical");

const pendingVsCompleted = evaluateMssrSemanticConsistency({
  boundary: "context-load",
  claims: [...roadmapPending, ...projectCompleted],
});
assert.equal(pendingVsCompleted.contradictionProven, true, "current ROADMAP pending vs canonical PROJECT_STATE completed must be proven");
assert.equal(pendingVsCompleted.findings.length, 1);
assert.equal(pendingVsCompleted.findings[0].type, "state-contradiction");
assert.equal(pendingVsCompleted.findings[0].evidenceTier, "proven");
assert.equal(pendingVsCompleted.findings[0].sourceA?.sourceRef, ".mssr/PROJECT_STATE.md#roadmap.r3");
assert.equal(pendingVsCompleted.findings[0].sourceB.sourceRef, "ROADMAP.md#r3");
assert.equal(pendingVsCompleted.findings[0].severity, "review");
assert.equal(pendingVsCompleted.blocksPublication, false);

const historicalPending = evaluateMssrSemanticConsistency({
  claims: [
    ...projectCompleted,
    ...roadmapPending.map((claim) => ({ ...claim, validity: "historical" })),
  ],
});
assert.equal(historicalPending.contradictionProven, false, "a truthful historical pending state must not contradict current completed state");
assert.equal(historicalPending.findings.length, 0);
assert.equal(historicalPending.inactiveClaims[0].reason, "historical-valid");
assert.equal(historicalPending.situation?.decision.level, "ok");

const supersededPending = evaluateMssrSemanticConsistency({
  claims: [
    ...projectCompleted,
    ...roadmapPending.map((claim) => ({ ...claim, validity: "superseded" })),
  ],
});
assert.equal(supersededPending.findings.length, 0, "explicitly superseded evidence must remain provenance without operational contradiction noise");
assert.equal(supersededPending.inactiveClaims[0].reason, "superseded-information");

const canonicalConflict = evaluateMssrSemanticConsistency({
  boundary: "ordinary",
  claims: [
    {
      kind: "state-value",
      subject: "roadmap.r3",
      source: "project-state",
      sourceRef: ".mssr/PROJECT_STATE.md#roadmap.r3",
      authority: "canonical",
      value: "completed",
    },
    {
      kind: "state-value",
      subject: "roadmap.r3",
      source: "project-context",
      sourceRef: "other-canonical.md#roadmap.r3",
      authority: "canonical",
      value: "pending",
    },
  ],
});
assert.equal(canonicalConflict.findings.length, 1);
assert.equal(canonicalConflict.findings[0].type, "canonical-contradiction");
assert.equal(canonicalConflict.findings[0].reasonCode, "canonical-authority-conflict");
assert.equal(canonicalConflict.findings[0].severity, "error");

const resolved = evaluateMssrSemanticConsistency({
  claims: [
    ...projectCompleted,
    ...roadmapPending.map((claim) => ({ ...claim, value: "completed" })),
  ],
});
assert.equal(resolved.findings.length, 0, "updating the stale ROADMAP state must remove the finding deterministically");
assert.equal(resolved.situation?.decision.level, "ok");

const runtimeDrift = evaluateMssrSemanticConsistency({
  boundary: "pre-release",
  claims: [
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "source",
      sourceRef: "package.json",
      authority: "canonical",
      value: "0.6.138",
      required: true,
    },
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "runtime",
      sourceRef: "bridge-health",
      authority: "replica",
      value: "0.6.137",
      required: true,
    },
  ],
});
assert.equal(runtimeDrift.findings.length, 1);
assert.equal(runtimeDrift.findings[0].type, "runtime-drift");
assert.equal(runtimeDrift.findings[0].blocksPublication, true);
assert.equal(runtimeDrift.blocksPublication, true);
assert.equal(runtimeDrift.situation?.decision.level, "error");

const isolatedScopes = evaluateMssrSemanticConsistency({
  claims: [
    {
      kind: "state-value",
      subject: "roadmap.r3",
      scope: "mssr",
      source: "project-state",
      sourceRef: "mssr-state",
      authority: "canonical",
      value: "completed",
    },
    {
      kind: "state-value",
      subject: "roadmap.r3",
      scope: "bridge",
      source: "project-state",
      sourceRef: "bridge-state",
      authority: "canonical",
      value: "pending",
    },
  ],
});
assert.equal(isolatedScopes.findings.length, 0, "same subject in distinct explicit scopes must not be compared");
assert.deepEqual(isolatedScopes.situation?.decision.keysObserved, [
  "semantic.state-value:roadmap.r3@bridge",
  "semantic.state-value:roadmap.r3@mssr",
]);

assert.throws(() => extractMssrDeclaredStateClaims({
  markdown: "<!-- mssr-state:roadmap.r3=completed -->\n<!-- mssr-state:roadmap.r3=pending -->\n",
  sourceRef: ".mssr/PROJECT_STATE.md",
}), /duplicate semantic subject/, "ambiguous duplicate state declarations must fail closed");

const [actualRoadmapMarkdown, actualProjectStateMarkdown] = await Promise.all([
  readFile(new URL("../ROADMAP.md", import.meta.url), "utf8"),
  readFile(new URL("../.mssr/PROJECT_STATE.md", import.meta.url), "utf8"),
]);
const actualProjectStateClaims = extractMssrDeclaredStateClaims({
  markdown: actualProjectStateMarkdown,
  sourceRef: ".mssr/PROJECT_STATE.md",
});
const actualCurrentSubjects = new Set(actualProjectStateClaims.map((claim) => claim.subject));
const actualRoadmapClaims = extractMssrRoadmapGateClaims({
  markdown: actualRoadmapMarkdown,
  sourceRef: "ROADMAP.md",
}).filter((claim) => actualCurrentSubjects.has(claim.subject));
assert.deepEqual(
  actualProjectStateClaims.map((claim) => claim.subject).sort(),
  ["roadmap.r1", "roadmap.r2", "roadmap.r3"],
  "self-host PROJECT_STATE must expose the reconciled R1-R3 machine-readable current claims",
);
const actualSelfHost = evaluateMssrSemanticConsistency({
  boundary: "context-load",
  claims: [...actualProjectStateClaims, ...actualRoadmapClaims],
});
assert.equal(actualSelfHost.findings.length, 0, "the reconciled current ROADMAP/PROJECT_STATE R1-R3 claims must agree");
assert.equal(actualSelfHost.situation?.decision.level, "ok");

const publicApi = await import("../dist/index.js");
assert.equal(typeof publicApi.evaluateMssrSemanticConsistency, "function");
assert.equal(typeof publicApi.extractMssrRoadmapGateClaims, "function");
assert.equal(typeof publicApi.extractMssrDeclaredStateClaims, "function");

console.log("MSSR R4 deterministic semantic consistency slice: PASS");
