import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureStructuralReviewedBaselineSchema,
  architectureStructuralRefinementSchema,
  buildMarkdownArchitectureStructuralEvidence,
  buildSymbolArchitectureStructuralEvidence,
  createArchitectureImpactReviewedBaseline,
  createArchitectureStructuralReviewedBaseline,
  evaluateArchitectureImpactProjection,
  evaluateArchitectureStructuralRefinement,
  mergeArchitectureStructuralEvidence,
  normalizeArchitectureImpactObservationEvidence,
  normalizedArchitectureSymbolEvidenceSchema,
  validateArchitectureStructuralReviewedBaseline,
} from "../dist/index.js";

const manifest = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context",
    impactRefs: ["src/alpha.ts", "src/shared.ts"],
  }],
};

const selector = {
  kind: "symbol",
  language: "typescript",
  name: "loadAlpha",
  aspect: "body",
};

const structure = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityAnchors: ["ownership"],
    implementation: [{ ref: "src/alpha.ts", selectors: [selector] }],
  }],
};

const baselineMarkdown = `# Alpha\n\n## Ownership\n<!-- mssr-arch-anchor: ownership -->\n\nPortable core owns Alpha semantics.\n\n## Notes\nBaseline note.\n`;
const outsideMarkdownChange = baselineMarkdown.replace("Baseline note.", "Changed note outside the architecture anchor.");
const insideMarkdownChange = baselineMarkdown.replace("Portable core owns Alpha semantics.", "Host owns Alpha semantics.");

const fpA = `sha256:${"a".repeat(64)}`;
const fpB = `sha256:${"b".repeat(64)}`;
const analyzerId = "mssr-typescript-reference";
const scheme = "mssr-ts-symbol-v1:ts5.9.3";

function coarseEvidence({
  authorityRevision = "sha256:authority-a",
  authorityAvailability = "available",
  alphaRevision = "sha256:alpha-a",
  alphaAvailability = "available",
  sharedRevision = "sha256:shared-a",
  sharedAvailability = "missing",
} = {}) {
  const authority = authorityAvailability === "available"
    ? { ref: "docs/alpha.md", availability: "available", revision: authorityRevision }
    : authorityAvailability === "missing"
      ? { ref: "docs/alpha.md", availability: "missing" }
      : { ref: "docs/alpha.md", availability: "unavailable", reasonCode: "fs-eacces" };
  const alpha = alphaAvailability === "available"
    ? { ref: "src/alpha.ts", availability: "available", revision: alphaRevision }
    : alphaAvailability === "missing"
      ? { ref: "src/alpha.ts", availability: "missing" }
      : { ref: "src/alpha.ts", availability: "unavailable", reasonCode: "fs-eacces" };
  const shared = sharedAvailability === "available"
    ? { ref: "src/shared.ts", availability: "available", revision: sharedRevision }
    : sharedAvailability === "missing"
      ? { ref: "src/shared.ts", availability: "missing" }
      : { ref: "src/shared.ts", availability: "unavailable", reasonCode: "fs-eacces" };
  return normalizeArchitectureImpactObservationEvidence(manifest, {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    authority,
    impacts: [shared, alpha],
  });
}

function codeEvidence({ sourceRevision = "sha256:alpha-a", fingerprint = fpA, fingerprintScheme = scheme, availability = "observed" } = {}) {
  const result = availability === "observed"
    ? { selector, availability: "observed", structuralFingerprint: fingerprint }
    : availability === "missing"
      ? { selector, availability: "missing" }
      : { selector, availability: "unavailable", reasonCode: "parser-unavailable" };
  return buildSymbolArchitectureStructuralEvidence(normalizedArchitectureSymbolEvidenceSchema.parse({
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    ref: "src/alpha.ts",
    sourceRevision,
    analyzerId,
    fingerprintScheme,
    results: [result],
  }));
}

function markdownEvidence({ sourceRevision = "sha256:authority-a", markdown = baselineMarkdown } = {}) {
  return buildMarkdownArchitectureStructuralEvidence({
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    sourceRevision,
    markdown,
    anchorIds: ["ownership"],
  });
}

const coarseReviewedEvidence = coarseEvidence();
const coarseBaseline = createArchitectureImpactReviewedBaseline(coarseReviewedEvidence, { reviewed: true });
const structuralBaselineEvidence = mergeArchitectureStructuralEvidence("alpha-plane", [
  markdownEvidence(),
  codeEvidence(),
]);
const structuralBaseline = createArchitectureStructuralReviewedBaseline({
  impactManifest: manifest,
  structureManifest: structure,
  coarseBaseline,
  evidence: structuralBaselineEvidence,
  review: { reviewed: true },
});

assert.equal(architectureStructuralReviewedBaselineSchema.safeParse(structuralBaseline).success, true);
assert.equal(structuralBaseline.reviewClass, "reviewed");
assert.equal(structuralBaseline.landmarks.length, 2);
assert.match(structuralBaseline.baselineFingerprint, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(validateArchitectureStructuralReviewedBaseline(structuralBaseline), structuralBaseline);

const alignedCoarse = evaluateArchitectureImpactProjection({ baseline: coarseBaseline, current: coarseEvidence() });
const alignedRefinement = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: alignedCoarse,
  baseline: structuralBaseline,
});
assert.equal(alignedRefinement.status, "not-applicable");
assert.equal(alignedRefinement.coarseStatus, "aligned");
assert.equal(alignedRefinement.level, "ok");
assert.equal(alignedRefinement.evidenceComplete, true);
assert.deepEqual(alignedRefinement.reasonCodes, ["coarse-aligned"]);

const changedCodeCoarse = evaluateArchitectureImpactProjection({
  baseline: coarseBaseline,
  current: coarseEvidence({ alphaRevision: "sha256:alpha-b" }),
});
assert.equal(changedCodeCoarse.status, "possible-impact");

const codeNoise = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-b", fingerprint: fpA }),
});
assert.equal(architectureStructuralRefinementSchema.safeParse(codeNoise).success, true);
assert.equal(codeNoise.status, "noise-candidate");
assert.equal(codeNoise.coarseStatus, "possible-impact", "C3 must preserve the coarse source-change fact");
assert.equal(codeNoise.level, "watch");
assert.equal(codeNoise.changes.length, 0);
assert.equal(codeNoise.comparedLandmarkKeys.length, 1);
assert.deepEqual(codeNoise.reasonCodes, ["structural-fingerprints-aligned"]);
assert.equal(codeNoise.notifyOnWatch, false);
assert.equal(codeNoise.advisoryOnly, true);

const codeChanged = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-b", fingerprint: fpB }),
});
assert.equal(codeChanged.status, "structural-possible-impact");
assert.equal(codeChanged.level, "review");
assert.equal(codeChanged.changes.length, 1);
assert.deepEqual(codeChanged.reasonCodes, ["structural-fingerprint-changed"]);
assert.equal(codeChanged.changes[0].baselineFingerprint, fpA);
assert.equal(codeChanged.changes[0].currentFingerprint, fpB);

const schemeMismatch = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-b", fingerprintScheme: "mssr-ts-symbol-v1:ts5.9.4" }),
});
assert.equal(schemeMismatch.status, "unresolved");
assert.equal(schemeMismatch.evidenceComplete, false);
assert.deepEqual(schemeMismatch.reasonCodes, ["structural-fingerprint-scheme-mismatch"]);

const staleSymbolEvidence = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-a" }),
});
assert.equal(staleSymbolEvidence.status, "unresolved");
assert.deepEqual(staleSymbolEvidence.reasonCodes, ["structural-source-revision-mismatch"]);

const missingEvidence = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
});
assert.equal(missingEvidence.status, "unresolved");
assert.deepEqual(missingEvidence.reasonCodes, ["structural-evidence-required"]);

const missingSymbol = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-b", availability: "missing" }),
});
assert.equal(missingSymbol.status, "unresolved");
assert.deepEqual(missingSymbol.reasonCodes, ["structural-landmark-missing"]);

const unavailableSymbol = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
  currentEvidence: codeEvidence({ sourceRevision: "sha256:alpha-b", availability: "unavailable" }),
});
assert.equal(unavailableSymbol.status, "unresolved");
assert.deepEqual(unavailableSymbol.reasonCodes, ["structural-landmark-unavailable"]);

const authorityChangedCoarse = evaluateArchitectureImpactProjection({
  baseline: coarseBaseline,
  current: coarseEvidence({ authorityRevision: "sha256:authority-b" }),
});
const markdownNoise = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: authorityChangedCoarse,
  baseline: structuralBaseline,
  currentEvidence: markdownEvidence({ sourceRevision: "sha256:authority-b", markdown: outsideMarkdownChange }),
});
assert.equal(markdownNoise.status, "noise-candidate", "an unrelated Markdown edit must not escalate the architecture anchor");
assert.equal(markdownNoise.level, "watch");

const markdownChanged = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: authorityChangedCoarse,
  baseline: structuralBaseline,
  currentEvidence: markdownEvidence({ sourceRevision: "sha256:authority-b", markdown: insideMarkdownChange }),
});
assert.equal(markdownChanged.status, "structural-possible-impact");
assert.equal(markdownChanged.changes.length, 1);
assert.equal(markdownChanged.changes[0].landmark.kind, "markdown-anchor");

const missingAnchor = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: authorityChangedCoarse,
  baseline: structuralBaseline,
  currentEvidence: markdownEvidence({ sourceRevision: "sha256:authority-b", markdown: "# Alpha\n\n## Ownership\nNo anchor now.\n" }),
});
assert.equal(missingAnchor.status, "unresolved");
assert.deepEqual(missingAnchor.reasonCodes, ["structural-landmark-missing"]);

const availabilityChangedCoarse = evaluateArchitectureImpactProjection({
  baseline: coarseBaseline,
  current: coarseEvidence({ sharedAvailability: "available", sharedRevision: "sha256:shared-b" }),
});
const availabilityUnresolved = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: availabilityChangedCoarse,
  baseline: structuralBaseline,
});
assert.equal(availabilityUnresolved.status, "unresolved");
assert.deepEqual(availabilityUnresolved.reasonCodes, ["coarse-availability-change-unresolved"]);

const coarseUnresolved = evaluateArchitectureImpactProjection({
  baseline: coarseBaseline,
  current: coarseEvidence({ authorityAvailability: "unavailable" }),
});
const stillUnresolved = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: coarseUnresolved,
  baseline: structuralBaseline,
});
assert.equal(stillUnresolved.status, "unresolved", "structural evidence must never repair missing coarse evidence");
assert.deepEqual(stillUnresolved.reasonCodes, ["coarse-unresolved"]);

const changedStructure = structuredClone(structure);
changedStructure.architectures[0].authorityAnchors.push("new-anchor");
const structureChanged = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: changedStructure,
  coarse: changedCodeCoarse,
  baseline: structuralBaseline,
});
assert.equal(structureChanged.status, "unresolved");
assert.deepEqual(structureChanged.reasonCodes, ["structure-declaration-changed"]);

const sharedChangedCoarse = evaluateArchitectureImpactProjection({
  baseline: createArchitectureImpactReviewedBaseline(coarseEvidence({ sharedAvailability: "available", sharedRevision: "sha256:shared-a" }), { reviewed: true }),
  current: coarseEvidence({ sharedAvailability: "available", sharedRevision: "sha256:shared-b" }),
});
const allAvailableCoarseBaseline = createArchitectureImpactReviewedBaseline(
  coarseEvidence({ sharedAvailability: "available", sharedRevision: "sha256:shared-a" }),
  { reviewed: true },
);
const allAvailableStructuralBaseline = createArchitectureStructuralReviewedBaseline({
  impactManifest: manifest,
  structureManifest: structure,
  coarseBaseline: allAvailableCoarseBaseline,
  evidence: structuralBaselineEvidence,
  review: { reviewed: true },
});
const noLandmarkForShared = evaluateArchitectureStructuralRefinement({
  impactManifest: manifest,
  structureManifest: structure,
  coarse: sharedChangedCoarse,
  baseline: allAvailableStructuralBaseline,
});
assert.equal(noLandmarkForShared.status, "unresolved");
assert.deepEqual(noLandmarkForShared.reasonCodes, ["changed-source-without-structural-landmark"]);

assert.throws(
  () => createArchitectureStructuralReviewedBaseline({
    impactManifest: manifest,
    structureManifest: structure,
    coarseBaseline,
    evidence: mergeArchitectureStructuralEvidence("alpha-plane", [markdownEvidence(), codeEvidence({ sourceRevision: "sha256:alpha-b" })]),
    review: { reviewed: true },
  }),
  /sourceRevision mismatch/,
);

const tamperedBaseline = structuredClone(structuralBaseline);
tamperedBaseline.landmarks[0].structuralFingerprint = fpB;
assert.throws(() => validateArchitectureStructuralReviewedBaseline(tamperedBaseline), /fingerprint integrity check failed/);

const duplicateBaseline = structuredClone(structuralBaseline);
duplicateBaseline.landmarks.push(structuredClone(duplicateBaseline.landmarks[0]));
assert.equal(architectureStructuralReviewedBaselineSchema.safeParse(duplicateBaseline).success, false);

for (const result of [alignedRefinement, codeNoise, codeChanged, schemeMismatch, staleSymbolEvidence, missingEvidence, missingSymbol, unavailableSymbol, markdownNoise, markdownChanged, missingAnchor, availabilityUnresolved, stillUnresolved, structureChanged, noLandmarkForShared]) {
  assert.equal("notice" in result, false, "C3 does not emit Operational Notices");
  assert.equal("contextRequest" in result, false, "C2f-D owns architecture context injection");
  assert.equal("receipt" in result, false, "C2f-E owns reviewed-current receipts");
  assert.equal("architectureChanged" in result, false, "structural change is not an architecture-change claim");
  assert.equal(result.advisoryOnly, true);
}

const jsonSchema = JSON.parse(await fs.readFile(
  new URL("../config/project-context/architecture-structural-refinement.schema.json", import.meta.url),
  "utf8",
));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateJson = ajv.compile(jsonSchema);
for (const document of [structuralBaselineEvidence, structuralBaseline, codeNoise, codeChanged, schemeMismatch]) {
  assert.equal(validateJson(document), true, ajv.errorsText(validateJson.errors));
}
const injected = structuredClone(codeNoise);
injected.ttl = 30000;
assert.equal(validateJson(injected), false, "host delivery metadata must not enter the portable C3 contract");
const codeWithoutAnalyzer = structuredClone(codeEvidence());
delete codeWithoutAnalyzer.landmarks[0].analyzerId;
assert.equal(validateJson(codeWithoutAnalyzer), false, "code-symbol JSON evidence requires analyzer provenance");

console.log("MSSR architecture-impact C2f-C.5-C3 structural refinement tests PASS");
