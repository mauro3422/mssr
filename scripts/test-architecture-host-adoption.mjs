import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureHostAdoptionEvaluationSchema,
  architectureHostAdoptionPlanItemSchema,
  architectureImpactManifestSchema,
  buildMarkdownArchitectureStructuralEvidence,
  buildSymbolArchitectureStructuralEvidence,
  createArchitectureImpactReviewedBaseline,
  createArchitectureReviewedCurrentReceipt,
  createArchitectureStructuralReviewedBaseline,
  evaluateArchitectureHostAdoption,
  mergeArchitectureStructuralEvidence,
  normalizeArchitectureImpactObservationEvidence,
  normalizedArchitectureSymbolEvidenceSchema,
  planArchitectureHostAdoption,
  projectContextManifestSchema,
} from "../dist/index.js";

const manifest = architectureImpactManifestSchema.parse({
  schemaVersion: 1,
  architectures: [
    {
      architectureId: "alpha-plane",
      authorityRef: "docs/alpha.md",
      contextRef: "alpha-context",
      impactRefs: ["src/shared.ts", "src/alpha.ts"],
    },
    {
      architectureId: "beta-plane",
      authorityRef: "docs/beta.md",
      contextRef: "beta-context",
      impactRefs: ["src/shared.ts", "src/beta.ts"],
    },
  ],
});

const projectContext = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [
    { id: "alpha-context", kind: "context", description: "Alpha", source: { path: ".mssr/alpha.md" }, topic: "architecture", area: "alpha", maxChars: 1200, actions: ["review"] },
    { id: "beta-context", kind: "context", description: "Beta", source: { path: ".mssr/beta.md" }, topic: "architecture", area: "beta", maxChars: 1200, actions: ["review"] },
  ],
});

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
const invariantManifest = {
  schemaVersion: 1,
  invariants: [{
    invariantId: "alpha-no-beta-import",
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    description: "Alpha must not import beta directly.",
    kind: "forbid-edge",
    edgeKind: "import",
    sourceRef: "src/alpha.ts",
    targetRef: "src/beta.ts",
  }],
};

const plan = planArchitectureHostAdoption(manifest, ["src/alpha.ts"]);
assert.equal(plan.length, 1);
assert.equal(plan[0].schemaVersion, 2);
assert.equal(plan[0].touch.architectureId, "alpha-plane");
assert.deepEqual(plan[0].touch.matchedRefs, [{ ref: "src/alpha.ts", role: "impact" }]);
assert.deepEqual(plan[0].observationPlan.impactRefs, ["src/shared.ts", "src/alpha.ts"]);
assert.equal(plan[0].optionalEvidence.structural, null);
assert.equal(plan[0].optionalEvidence.derivedGraph.canonicalReviewEligible, false);
assert.equal(plan[0].optionalEvidence.analyzersRequired, false);
assert.equal(plan[0].semanticOwner, "mssr");
assert.equal(plan[0].hostOwnsObservation, true);
assert.equal(plan[0].advisoryOnly, true);

const shared = planArchitectureHostAdoption(manifest, ["src/shared.ts"]);
assert.deepEqual(shared.map((item) => item.touch.architectureId), ["alpha-plane", "beta-plane"], "shared touched refs must preserve every declared architecture");
assert.deepEqual(planArchitectureHostAdoption(manifest, ["src/unrelated.ts"]), [], "unrelated refs must not cause architecture work");

const structuralPlan = planArchitectureHostAdoption(manifest, ["src/alpha.ts"], { structureManifest: structure });
assert.deepEqual(structuralPlan[0].optionalEvidence.structural?.authorityAnchors, ["ownership"]);
assert.equal(structuralPlan[0].optionalEvidence.structural?.symbolAnalysisPlans.length, 1);
assert.equal(structuralPlan[0].optionalEvidence.structural?.symbolAnalysisPlans[0].ref, "src/alpha.ts");
assert.equal(structuralPlan[0].optionalEvidence.analyzersRequired, false, "declaring structural guidance must never require an analyzer");

const invariantPlan = planArchitectureHostAdoption(manifest, ["src/alpha.ts"], { invariantManifest });
assert.equal(invariantPlan[0].optionalEvidence.invariants?.rules.length, 1);
assert.equal(invariantPlan[0].optionalEvidence.invariants?.rules[0].invariantId, "alpha-no-beta-import");

const initialEvidence = {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "rev-a" },
  impacts: [
    { ref: "src/shared.ts", availability: "available", revision: "rev-shared-1" },
    { ref: "src/alpha.ts", availability: "available", revision: "rev-alpha-1" },
  ],
};
const normalizedInitial = normalizeArchitectureImpactObservationEvidence(manifest, initialEvidence);
const baseline = createArchitectureImpactReviewedBaseline(normalizedInitial, { reviewed: true });

const changedEvidence = {
  ...initialEvidence,
  impacts: [
    initialEvidence.impacts[0],
    { ref: "src/alpha.ts", availability: "available", revision: "rev-alpha-2" },
  ],
};
const activeReview = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
});
assert.equal(activeReview.projection.status, "possible-impact");
assert.equal(activeReview.reviewedCurrent.state, "review-required");
assert.equal(activeReview.attentionLevel, "review");
assert.equal(activeReview.reviewRequired, true);
assert.equal(activeReview.replanRequired, true);
assert.equal(activeReview.contextFeedback?.trigger, "natural-replan");
assert.deepEqual(activeReview.contextFeedback?.requests.map((item) => item.role), ["context", "authority"]);
assert.equal(activeReview.canonicalRewriteAllowed, false);
assert.equal(activeReview.semanticOwner, "mssr");

const receipt = createArchitectureReviewedCurrentReceipt(activeReview.projection, {
  decision: "reviewed-current",
  reviewedAt: "2026-08-19T04:00:00.000Z",
});
const suppressed = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  reviewedCurrentReceipt: receipt,
});
assert.equal(suppressed.projection.status, "possible-impact", "receipt suppression must not erase the underlying evidence fact");
assert.equal(suppressed.reviewedCurrent.state, "reviewed-current");
assert.equal(suppressed.attentionLevel, "ok");
assert.equal(suppressed.reviewRequired, false);
assert.equal(suppressed.replanRequired, false);
assert.equal(suppressed.contextFeedback, null, "exact reviewed-current receipt suppresses repeated coarse context feedback");

const aligned = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: initialEvidence,
  projectContextManifest: projectContext,
});
assert.equal(aligned.projection.status, "aligned");
assert.equal(aligned.attentionLevel, "ok");
assert.equal(aligned.reviewRequired, false);
assert.equal(aligned.contextFeedback, null);

const baselineMarkdown = "# Alpha\n\n## Ownership\n<!-- mssr-arch-anchor: ownership -->\n\nPortable core owns Alpha semantics.\n";
const fpA = `sha256:${"a".repeat(64)}`;
const fpB = `sha256:${"b".repeat(64)}`;
const analyzerId = "mssr-typescript-reference";
const fingerprintScheme = "mssr-ts-symbol-v1:ts5.9.3";
function markdownEvidence(sourceRevision = "rev-a") {
  return buildMarkdownArchitectureStructuralEvidence({
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    sourceRevision,
    markdown: baselineMarkdown,
    anchorIds: ["ownership"],
  });
}
function symbolEvidence(sourceRevision, fingerprint) {
  return buildSymbolArchitectureStructuralEvidence(normalizedArchitectureSymbolEvidenceSchema.parse({
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    ref: "src/alpha.ts",
    sourceRevision,
    analyzerId,
    fingerprintScheme,
    results: [{ selector, availability: "observed", structuralFingerprint: fingerprint }],
  }));
}
const structuralBaselineEvidence = mergeArchitectureStructuralEvidence("alpha-plane", [
  markdownEvidence(),
  symbolEvidence("rev-alpha-1", fpA),
]);
const structuralBaseline = createArchitectureStructuralReviewedBaseline({
  impactManifest: manifest,
  structureManifest: structure,
  coarseBaseline: baseline,
  evidence: structuralBaselineEvidence,
  review: { reviewed: true },
});

const analyzerOptional = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: structuralPlan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  structureManifest: structure,
});
assert.equal(analyzerOptional.attentionLevel, "review", "structure declarations alone must not require analyzer evidence or alter coarse behavior");
assert.equal(analyzerOptional.structuralRefinement, null);

const structuralNoiseEvidence = mergeArchitectureStructuralEvidence("alpha-plane", [
  markdownEvidence(),
  symbolEvidence("rev-alpha-2", fpA),
]);
const structuralNoise = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: structuralPlan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  structureManifest: structure,
  structuralBaseline,
  structuralEvidence: structuralNoiseEvidence,
});
assert.equal(structuralNoise.projection.status, "possible-impact", "structural refinement must preserve the coarse fact");
assert.equal(structuralNoise.structuralRefinement?.status, "noise-candidate");
assert.equal(structuralNoise.attentionLevel, "watch");
assert.equal(structuralNoise.reviewRequired, false);
assert.equal(structuralNoise.contextFeedback, null, "WATCH must not force context loading/replan");

const structuralChangedEvidence = mergeArchitectureStructuralEvidence("alpha-plane", [
  markdownEvidence(),
  symbolEvidence("rev-alpha-2", fpB),
]);
const structuralChanged = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: structuralPlan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  structureManifest: structure,
  structuralBaseline,
  structuralEvidence: structuralChangedEvidence,
});
assert.equal(structuralChanged.structuralRefinement?.status, "structural-possible-impact");
assert.equal(structuralChanged.attentionLevel, "review");
assert.equal(structuralChanged.contextFeedback?.architectureLevel, "review");

const derivedOnly = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  reviewedCurrentReceipt: receipt,
  derivedGraphEvidence: {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "derived",
    evidenceClass: "observed",
    analyzerId: "test-graph",
    edges: [{ kind: "import", sourceRef: "src/alpha.ts", targetRef: "src/beta.ts" }],
  },
});
assert.equal(derivedOnly.attentionLevel, "ok", "derived candidates must never elevate architecture attention");
assert.equal(derivedOnly.derivedGraph?.canonicalReviewEligible, false);
assert.equal(derivedOnly.derivedGraph?.candidates[0].promotionState, "candidate");
assert.equal(derivedOnly.derivedGraph?.candidates[0].targetRef, "src/beta.ts", "undeclared targets may exist only as derived candidates");
assert.equal(derivedOnly.reviewRequired, false);

assert.throws(() => evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  derivedGraphEvidence: {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "derived",
    evidenceClass: "observed",
    analyzerId: "test-graph",
    edges: [{ kind: "import", sourceRef: "src/beta.ts", targetRef: "src/alpha.ts" }],
  },
}), /outside declared architecture/);

const invariantViolation = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: invariantPlan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  reviewedCurrentReceipt: receipt,
  invariantManifest,
  invariantGraphEvidence: {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    analyzerId: "test-invariants",
    coverage: "complete",
    edges: [{ kind: "import", sourceRef: "src/alpha.ts", targetRef: "src/beta.ts" }],
  },
});
assert.equal(invariantViolation.reviewedCurrent.state, "reviewed-current", "coarse receipt should still be recognized for the coarse layer");
assert.equal(invariantViolation.invariants[0].status, "violated");
assert.equal(invariantViolation.attentionLevel, "review", "an invariant violation must override coarse receipt suppression");
assert.equal(invariantViolation.reviewRequired, true);
assert.equal(invariantViolation.contextFeedback?.architectureLevel, "review");
assert.equal(invariantViolation.contextFeedback?.requests.some((item) => item.request.reasonCodes.includes("architecture-invariant-review")), true);

const invariantWatch = evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: invariantPlan[0],
  baseline,
  hostEvidence: initialEvidence,
  projectContextManifest: projectContext,
  invariantManifest,
  invariantGraphEvidence: {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    analyzerId: "test-invariants",
    coverage: "partial",
    edges: [],
  },
});
assert.equal(invariantWatch.projection.status, "aligned");
assert.equal(invariantWatch.invariants[0].status, "unresolved");
assert.equal(invariantWatch.attentionLevel, "watch");
assert.equal(invariantWatch.reviewRequired, false);
assert.equal(invariantWatch.contextFeedback, null);

assert.throws(() => evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: structuralPlan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  structuralEvidence: structuralNoiseEvidence,
}), /requires a structure manifest/);
assert.throws(() => evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: changedEvidence,
  projectContextManifest: projectContext,
  invariantGraphEvidence: {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    analyzerId: "test-invariants",
    coverage: "complete",
    edges: [],
  },
}), /requires an invariant manifest/);
assert.throws(() => evaluateArchitectureHostAdoption({
  architectureManifest: manifest,
  plan: plan[0],
  baseline,
  hostEvidence: { ...changedEvidence, architectureId: "beta-plane" },
  projectContextManifest: projectContext,
}), /evidence mismatch/);

assert.throws(() => architectureHostAdoptionPlanItemSchema.parse({ ...plan[0], semanticOwner: "bridge" }));
assert.throws(() => architectureHostAdoptionPlanItemSchema.parse({ ...plan[0], optionalEvidence: { ...plan[0].optionalEvidence, analyzersRequired: true } }));
assert.throws(() => architectureHostAdoptionEvaluationSchema.parse({ ...activeReview, canonicalRewriteAllowed: true }));

const schema = JSON.parse(await fs.readFile("config/project-context/architecture-host-adoption.schema.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validatePlan = ajv.compile(schema.$defs.planItem);
const validateEvaluation = ajv.compile(schema.$defs.evaluation);
assert.equal(validatePlan(structuralPlan[0]), true, JSON.stringify(validatePlan.errors));
assert.equal(validateEvaluation(structuralNoise), true, JSON.stringify(validateEvaluation.errors));
assert.equal(validateEvaluation(invariantViolation), true, JSON.stringify(validateEvaluation.errors));
assert.equal(validateEvaluation({ ...activeReview, canonicalRewriteAllowed: true }), false);

console.log("MSSR Architecture Impact host adoption B: PASS");
