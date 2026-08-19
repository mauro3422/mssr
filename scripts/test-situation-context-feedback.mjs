import assert from "node:assert/strict";

import {
  buildMssrSituationContextFeedback,
  evaluateMssrSituationModel,
  projectContextManifestSchema,
} from "../dist/index.js";

function staleSituation({ key, canonicalRef, canonicalCategory = "project-memory", canonicalRole = "memory" }) {
  return evaluateMssrSituationModel({
    boundary: "context-load",
    observations: [
      {
        key,
        observer: `canonical:${canonicalRef}`,
        role: canonicalRole,
        authority: "canonical",
        state: "observed",
        revision: "rev-new",
        category: canonicalCategory,
        evidenceClass: canonicalCategory.startsWith("project-") ? "declared" : "observed",
        sourceRef: canonicalRef,
      },
      {
        key,
        observer: `historical:${canonicalRef}`,
        role: "receipt",
        authority: "historical",
        state: "observed",
        revision: "rev-old",
        category: canonicalCategory,
        evidenceClass: "declared",
        sourceRef: canonicalRef,
      },
    ],
  });
}

const exactManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [{
    id: "architecture-ownership",
    kind: "context",
    description: "Canonical ownership",
    source: { path: ".mssr/knowledge/architecture/canonical-ownership.md" },
    topic: "architecture",
    area: "core",
    maxChars: 4200,
    actions: ["review"],
  }],
});
const exactSituation = staleSituation({
  key: "knowledge.revision:ownership",
  canonicalRef: ".mssr/knowledge/architecture/canonical-ownership.md",
  canonicalCategory: "architecture",
  canonicalRole: "reference",
});
assert.equal(exactSituation.decision.level, "review");
assert.equal(exactSituation.decision.nextAction, "revalidate-context-evidence");
const exact = buildMssrSituationContextFeedback({ situation: exactSituation, manifest: exactManifest });
assert.equal(exact.advisoryOnly, true);
assert.equal(exact.requests.length, 1);
assert.equal(exact.requests[0].kind, "project-context-entry");
assert.equal(exact.requests[0].resolution, "exact-entry");
assert.equal(exact.requests[0].entry?.id, "architecture-ownership");
assert.equal(exact.requests[0].entry?.sourcePath, ".mssr/knowledge/architecture/canonical-ownership.md");
assert.equal(exact.requests[0].entry?.suggestedMaxChars, 4200);
assert.equal(exact.requests[0].action, "revalidate-context-evidence");

const ambiguousManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [
    {
      id: "memory-release-decision",
      kind: "memory",
      description: "Release decision",
      source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Release decision"] },
      topic: "decision",
    },
    {
      id: "memory-routing-decision",
      kind: "memory",
      description: "Routing decision",
      source: { path: ".mssr/PROJECT_MEMORY.md", sections: ["## Routing decision"] },
      topic: "decision",
    },
  ],
});
const ambiguous = buildMssrSituationContextFeedback({
  situation: staleSituation({ key: "knowledge.revision:memory", canonicalRef: ".mssr/PROJECT_MEMORY.md" }),
  manifest: ambiguousManifest,
});
const sectionManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [
    {
      id: "state-current-release",
      kind: "state",
      description: "Current release state",
      source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Current release"] },
      topic: "state",
      maxChars: 1200,
    },
    {
      id: "state-learning",
      kind: "state",
      description: "Learning state",
      source: { path: ".mssr/PROJECT_STATE.md", sections: ["## Learning dataset state"] },
      topic: "state",
      maxChars: 1400,
    },
  ],
});
const sectionTargeted = buildMssrSituationContextFeedback({
  situation: staleSituation({
    key: "semantic.state-value:bridge.live-version",
    canonicalRef: ".mssr/PROJECT_STATE.md#current-release",
    canonicalCategory: "project-state",
    canonicalRole: "state",
  }),
  manifest: sectionManifest,
});
assert.equal(sectionTargeted.requests.length, 1);
assert.equal(sectionTargeted.requests[0].resolution, "exact-entry");
assert.equal(sectionTargeted.requests[0].entry?.id, "state-current-release", "an explicit sourceRef selector should disambiguate modules sharing one authority file");
assert.equal(sectionTargeted.requests[0].entry?.suggestedMaxChars, 1200);

assert.equal(ambiguous.requests.length, 1);
assert.equal(ambiguous.requests[0].kind, "canonical-authority");
assert.equal(ambiguous.requests[0].resolution, "ambiguous-authority");
assert.equal(ambiguous.requests[0].entry, undefined, "shared PROJECT_MEMORY path must not guess a section/module");
assert.ok(ambiguous.requests[0].reasonCodes.includes("authority-maps-to-multiple-context-entries"));

const unindexed = buildMssrSituationContextFeedback({
  situation: staleSituation({
    key: "knowledge.revision:adr",
    canonicalRef: "docs/decisions/0099-example.md",
    canonicalCategory: "architecture",
    canonicalRole: "reference",
  }),
  manifest: exactManifest,
});
assert.equal(unindexed.requests.length, 1);
assert.equal(unindexed.requests[0].kind, "canonical-authority");
assert.equal(unindexed.requests[0].resolution, "unindexed-authority");
assert.equal(unindexed.requests[0].authorityRef, "docs/decisions/0099-example.md");
assert.ok(unindexed.requests[0].reasonCodes.includes("authority-not-indexed"));

const missingCanonicalSituation = evaluateMssrSituationModel({
  boundary: "pre-execution",
  observations: [{
    key: "semantic.state-value:bridge.live-version",
    observer: "runtime:bridge-health",
    role: "runtime",
    authority: "replica",
    state: "observed",
    value: "0.6.105",
    category: "runtime",
    evidenceClass: "observed",
    sourceRef: "bridge-health",
  }],
});
assert.equal(missingCanonicalSituation.decision.nextAction, "load-canonical-authority");
const missingCanonical = buildMssrSituationContextFeedback({ situation: missingCanonicalSituation, manifest: exactManifest });
assert.deepEqual(missingCanonical.requests, []);
assert.deepEqual(missingCanonical.unresolved, [{ key: "semantic.state-value:bridge.live-version", reason: "canonical-source-unresolved" }]);

const cleanSituation = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: [{
    key: "project.state",
    observer: "PROJECT_STATE",
    role: "state",
    authority: "canonical",
    state: "observed",
    value: "current",
    category: "project-state",
    evidenceClass: "declared",
    sourceRef: ".mssr/PROJECT_STATE.md",
  }],
});
assert.equal(cleanSituation.decision.level, "ok");
assert.deepEqual(buildMssrSituationContextFeedback({ situation: cleanSituation, manifest: ambiguousManifest }), {
  requests: [], unresolved: [], overflowKeys: [], advisoryOnly: true,
});

const bounded = buildMssrSituationContextFeedback({ situation: exactSituation, manifest: exactManifest, maxRequests: 0 });
assert.deepEqual(bounded, { requests: [], unresolved: [], overflowKeys: [], advisoryOnly: true });

const publicApi = await import("../dist/index.js");
assert.equal(typeof publicApi.buildMssrSituationContextFeedback, "function");
assert.equal(typeof publicApi.mssrSituationContextFeedbackSchema?.parse, "function");

console.log("MSSR C2e-E Situation context feedback: PASS");
