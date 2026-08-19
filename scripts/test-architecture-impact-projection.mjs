import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureImpactProjectionSchema,
  architectureImpactReviewedBaselineSchema,
  createArchitectureImpactReviewedBaseline,
  evaluateArchitectureImpactProjection,
  normalizeArchitectureImpactObservationEvidence,
  validateArchitectureImpactReviewedBaseline,
} from "../dist/index.js";

const manifest = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context",
    impactRefs: ["src/alpha-a.ts", "src/shared.ts"],
  }],
};

function evidence({
  authorityRevision = "sha256:authority-a",
  authorityAvailability = "available",
  alphaAvailability = "available",
  alphaRevision = "sha256:alpha-a",
  sharedAvailability = "missing",
  sharedRevision = "sha256:shared-a",
  sharedReasonCode = "fs-eacces",
  sourceManifest = manifest,
} = {}) {
  const authority = authorityAvailability === "available"
    ? { ref: sourceManifest.architectures[0].authorityRef, availability: "available", revision: authorityRevision }
    : authorityAvailability === "missing"
      ? { ref: sourceManifest.architectures[0].authorityRef, availability: "missing" }
      : { ref: sourceManifest.architectures[0].authorityRef, availability: "unavailable", reasonCode: "fs-eacces" };
  const alpha = alphaAvailability === "available"
    ? { ref: sourceManifest.architectures[0].impactRefs[0], availability: "available", revision: alphaRevision }
    : alphaAvailability === "missing"
      ? { ref: sourceManifest.architectures[0].impactRefs[0], availability: "missing" }
      : { ref: sourceManifest.architectures[0].impactRefs[0], availability: "unavailable", reasonCode: "fs-eacces" };
  const shared = sharedAvailability === "available"
    ? { ref: sourceManifest.architectures[0].impactRefs[1], availability: "available", revision: sharedRevision }
    : sharedAvailability === "missing"
      ? { ref: sourceManifest.architectures[0].impactRefs[1], availability: "missing" }
      : { ref: sourceManifest.architectures[0].impactRefs[1], availability: "unavailable", reasonCode: sharedReasonCode };

  return normalizeArchitectureImpactObservationEvidence(sourceManifest, {
    schemaVersion: 1,
    architectureId: sourceManifest.architectures[0].architectureId,
    authority,
    impacts: [shared, alpha],
  });
}

const reviewedEvidence = evidence();
const baseline = createArchitectureImpactReviewedBaseline(reviewedEvidence, { reviewed: true });
assert.equal(architectureImpactReviewedBaselineSchema.safeParse(baseline).success, true);
assert.equal(baseline.reviewClass, "reviewed");
assert.equal(baseline.authority.availability, "available");
assert.equal(baseline.impacts[1].availability, "missing", "positive absence is a comparable reviewed source state");
assert.match(baseline.declarationFingerprint, /^sha256:[0-9a-f]{64}$/);
assert.match(baseline.sourceSetFingerprint, /^sha256:[0-9a-f]{64}$/);
assert.match(baseline.baselineFingerprint, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(validateArchitectureImpactReviewedBaseline(baseline), baseline);

assert.throws(
  () => createArchitectureImpactReviewedBaseline(evidence({ authorityAvailability: "missing" }), { reviewed: true }),
  /requires an available canonical architecture authority/,
);
assert.throws(
  () => createArchitectureImpactReviewedBaseline(evidence({ sharedAvailability: "unavailable" }), { reviewed: true }),
  /requires comparable impact evidence/,
);

const aligned = evaluateArchitectureImpactProjection({ baseline, current: evidence() });
assert.equal(architectureImpactProjectionSchema.safeParse(aligned).success, true);
assert.equal(aligned.status, "aligned");
assert.equal(aligned.level, "ok");
assert.equal(aligned.evidenceComplete, true);
assert.deepEqual(aligned.reasonCodes, ["aligned"]);
assert.deepEqual(aligned.changes, []);
assert.deepEqual(aligned.unresolvedRefs, []);
assert.equal(aligned.currentAuthorityRevision, baseline.authority.revision);
assert.equal(aligned.currentSourceSetFingerprint, baseline.sourceSetFingerprint);
assert.equal(evaluateArchitectureImpactProjection({ baseline, current: evidence() }).fingerprint, aligned.fingerprint, "same evidence must have a deterministic projection fingerprint");

const revisionChanged = evaluateArchitectureImpactProjection({
  baseline,
  current: evidence({ alphaRevision: "sha256:alpha-b" }),
});
assert.equal(revisionChanged.status, "possible-impact");
assert.equal(revisionChanged.level, "review");
assert.equal(revisionChanged.evidenceComplete, true);
assert.deepEqual(revisionChanged.reasonCodes, ["impact-revision-changed"]);
assert.equal(revisionChanged.changes.length, 1);
assert.deepEqual(revisionChanged.changes[0], {
  role: "impact",
  ref: "src/alpha-a.ts",
  kind: "revision",
  baseline: { ref: "src/alpha-a.ts", availability: "available", revision: "sha256:alpha-a" },
  current: { ref: "src/alpha-a.ts", availability: "available", revision: "sha256:alpha-b" },
});
assert.notEqual(revisionChanged.currentSourceSetFingerprint, baseline.sourceSetFingerprint);

const availabilityChanged = evaluateArchitectureImpactProjection({
  baseline,
  current: evidence({ sharedAvailability: "available", sharedRevision: "sha256:shared-a" }),
});
assert.equal(availabilityChanged.status, "possible-impact");
assert.deepEqual(availabilityChanged.reasonCodes, ["impact-availability-changed"]);
assert.equal(availabilityChanged.changes[0].kind, "availability");

const authorityChanged = evaluateArchitectureImpactProjection({
  baseline,
  current: evidence({ authorityRevision: "sha256:authority-b" }),
});
assert.equal(authorityChanged.status, "possible-impact");
assert.deepEqual(authorityChanged.reasonCodes, ["architecture-authority-revision-changed"]);
assert.equal(authorityChanged.changes[0].role, "authority");
assert.equal(authorityChanged.currentSourceSetFingerprint, baseline.sourceSetFingerprint, "authority revision is distinct from implementation source-set fingerprint");

const sourceUnavailable = evaluateArchitectureImpactProjection({
  baseline,
  current: evidence({ sharedAvailability: "unavailable", sharedReasonCode: "fs-eacces" }),
});
assert.equal(sourceUnavailable.status, "unresolved");
assert.equal(sourceUnavailable.level, "review");
assert.equal(sourceUnavailable.evidenceComplete, false);
assert.equal(sourceUnavailable.currentSourceSetFingerprint, null, "unavailable impact evidence must not synthesize a comparable source-set fingerprint");
assert.deepEqual(sourceUnavailable.reasonCodes, ["impact-source-unavailable"]);
assert.deepEqual(sourceUnavailable.unresolvedRefs, [{ ref: "src/shared.ts", availability: "unavailable", reasonCode: "fs-eacces" }]);
assert.deepEqual(sourceUnavailable.changes, [], "uncertainty is not fabricated into a change");

for (const authorityAvailability of ["missing", "unavailable"]) {
  const authorityUnresolved = evaluateArchitectureImpactProjection({
    baseline,
    current: evidence({ authorityAvailability }),
  });
  assert.equal(authorityUnresolved.status, "unresolved");
  assert.equal(authorityUnresolved.evidenceComplete, false);
  assert.equal(authorityUnresolved.currentAuthorityRevision, null);
  assert.equal(authorityUnresolved.reasonCodes[0], authorityAvailability === "missing"
    ? "architecture-authority-missing"
    : "architecture-authority-unavailable");
}

const changedManifest = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context-v2",
    impactRefs: ["src/alpha-a.ts", "src/shared.ts"],
  }],
};
const declarationChanged = evaluateArchitectureImpactProjection({
  baseline,
  current: evidence({ sourceManifest: changedManifest }),
});
assert.equal(declarationChanged.status, "unresolved");
assert.deepEqual(declarationChanged.reasonCodes, ["declared-relationship-changed"]);
assert.deepEqual(declarationChanged.changes, []);

const otherBaseline = structuredClone(baseline);
otherBaseline.architectureId = "beta-plane";
assert.throws(
  () => evaluateArchitectureImpactProjection({ baseline: otherBaseline, current: evidence() }),
  /fingerprint integrity|architectureId mismatch/,
);

const tamperedBaseline = structuredClone(baseline);
tamperedBaseline.sourceSetFingerprint = `sha256:${"0".repeat(64)}`;
assert.throws(
  () => validateArchitectureImpactReviewedBaseline(tamperedBaseline),
  /fingerprint integrity check failed/,
);

for (const projection of [aligned, revisionChanged, availabilityChanged, authorityChanged, sourceUnavailable, declarationChanged]) {
  assert.equal("notice" in projection, false, "C2f-C projection must not emit Operational Notices");
  assert.equal("contextRequest" in projection, false, "C2f-D owns bounded architecture context feedback");
  assert.equal("receipt" in projection, false, "C2f-E owns reviewed-current receipt persistence");
  assert.equal("architectureChanged" in projection, false, "possible impact must never be promoted into an architecture-change claim");
  assert.equal(projection.notifyOnWatch, false);
  assert.equal(projection.advisoryOnly, true);
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const baselineJsonSchema = JSON.parse(await fs.readFile(new URL("../config/project-context/architecture-impact-review-baseline.schema.json", import.meta.url), "utf8"));
const projectionJsonSchema = JSON.parse(await fs.readFile(new URL("../config/project-context/architecture-impact-projection.schema.json", import.meta.url), "utf8"));
const validateBaselineJson = ajv.compile(baselineJsonSchema);
const validateProjectionJson = ajv.compile(projectionJsonSchema);
assert.equal(validateBaselineJson(baseline), true, JSON.stringify(validateBaselineJson.errors));
for (const projection of [aligned, revisionChanged, availabilityChanged, authorityChanged, sourceUnavailable, declarationChanged]) {
  assert.equal(validateProjectionJson(projection), true, JSON.stringify(validateProjectionJson.errors));
}
assert.equal(validateBaselineJson({ ...baseline, extra: true }), false, "review baseline JSON Schema must stay strict");
assert.equal(validateProjectionJson({ ...aligned, notice: {} }), false, "projection JSON Schema must reject delivery/notice fields");

console.log("MSSR architecture-impact C2f-C projection contract tests PASS");
