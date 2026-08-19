import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION,
  analyzeArchitectureStructureManifest,
  architectureSymbolHostEvidenceSchema,
  architectureSymbolSourceLocationSchema,
  loadArchitectureImpactManifest,
  loadArchitectureStructureManifest,
  normalizeArchitectureSymbolAnalysisEvidence,
  planArchitectureSymbolAnalysis,
} from "../dist/index.js";

const projectRoot = process.cwd();
const loadedImpact = await loadArchitectureImpactManifest(projectRoot);
assert.equal(loadedImpact.found, true, "self-hosted architecture impact manifest must exist");
const impactManifest = loadedImpact.manifest;
const loadedStructure = await loadArchitectureStructureManifest(projectRoot, impactManifest);
assert.equal(loadedStructure.found, true, "self-hosted architecture structure manifest must exist");
const structureManifest = loadedStructure.manifest;

assert.equal(MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION, 1);

// The portable planner only exposes selectors already reviewed into the non-widening structure manifest.
const realPlans = planArchitectureSymbolAnalysis(impactManifest, structureManifest);
assert.ok(realPlans.length >= 1);
const selfPlan = realPlans.find(
  (plan) => plan.architectureId === "architecture-impact-plane" && plan.ref === "src/architecture-symbol-analysis.ts",
);
assert.ok(selfPlan, "C1 must self-host its own declared symbol-analysis surface");
assert.deepEqual(
  selfPlan.selectors.map((selector) => [selector.name, selector.aspect]),
  [
    ["planArchitectureSymbolAnalysis", "signature"],
    ["normalizeArchitectureSymbolAnalysisEvidence", "body"],
    ["analyzeArchitectureStructureManifest", "body"],
  ],
);
assert.ok(
  impactManifest.architectures
    .find((entry) => entry.architectureId === "architecture-impact-plane")
    .impactRefs.includes("config/project-context/architecture-impact-symbol-analysis.schema.json"),
  "the C1 schema must itself be part of the declared architecture-impact surface",
);

const selectorSignature = {
  kind: "symbol",
  language: "typescript",
  name: "alpha",
  aspect: "signature",
};
const selectorBody = {
  kind: "symbol",
  language: "typescript",
  name: "alpha",
  aspect: "body",
};
const selectorShape = {
  kind: "symbol",
  language: "typescript",
  name: "AlphaState",
  aspect: "shape",
};
const syntheticImpact = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    impactRefs: ["src/alpha.ts"],
  }],
};
const syntheticStructure = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    implementation: [{
      ref: "src/alpha.ts",
      selectors: [selectorSignature, selectorBody, selectorShape],
    }],
  }],
};

const plans = planArchitectureSymbolAnalysis(syntheticImpact, syntheticStructure);
assert.equal(plans.length, 1);
assert.deepEqual(plans[0], {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  ref: "src/alpha.ts",
  selectors: [selectorSignature, selectorBody, selectorShape],
});

const fpA = `sha256:${"a".repeat(64)}`;
const fpB = `sha256:${"b".repeat(64)}`;
const validEvidenceShuffled = {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  ref: "src/alpha.ts",
  sourceRevision: "source-revision-alpha-1",
  analyzerId: "typescript-ast-reference-v1",
  fingerprintScheme: "mssr-ts-symbol-v1",
  results: [
    { selector: selectorShape, availability: "unavailable", reasonCode: "unsupported-shape" },
    { selector: selectorSignature, availability: "observed", structuralFingerprint: fpA, location: { startLine: 3, endLine: 5 } },
    { selector: selectorBody, availability: "missing" },
  ],
};
const normalized = normalizeArchitectureSymbolAnalysisEvidence(
  syntheticImpact,
  syntheticStructure,
  validEvidenceShuffled,
);
assert.equal(normalized.relationshipClass, "declared");
assert.equal(normalized.evidenceClass, "observed");
assert.equal(normalized.sourceRevision, "source-revision-alpha-1");
assert.equal(normalized.analyzerId, "typescript-ast-reference-v1");
assert.equal(normalized.fingerprintScheme, "mssr-ts-symbol-v1");
assert.deepEqual(
  normalized.results.map((result) => [result.selector.name, result.selector.aspect, result.availability]),
  [
    ["alpha", "signature", "observed"],
    ["alpha", "body", "missing"],
    ["AlphaState", "shape", "unavailable"],
  ],
  "host result order must normalize back to declaration order",
);

assert.equal(
  architectureSymbolHostEvidenceSchema.safeParse({ ...validEvidenceShuffled, extra: true }).success,
  false,
  "host evidence schema must stay strict",
);
assert.equal(
  architectureSymbolSourceLocationSchema.safeParse({ startLine: 9, endLine: 8 }).success,
  false,
  "source locations must reject reversed ranges",
);
assert.equal(
  architectureSymbolHostEvidenceSchema.safeParse({ ...validEvidenceShuffled, sourceRevision: " revision " }).success,
  false,
  "sourceRevision must be a bounded canonical single-line token",
);
assert.equal(
  architectureSymbolHostEvidenceSchema.safeParse({ ...validEvidenceShuffled, analyzerId: "Analyzer With Spaces" }).success,
  false,
  "analyzer ids must be stable machine ids",
);
assert.equal(
  architectureSymbolHostEvidenceSchema.safeParse({ ...validEvidenceShuffled, fingerprintScheme: "scheme with spaces" }).success,
  false,
  "fingerprint schemes must be stable machine ids",
);

assert.throws(
  () => normalizeArchitectureSymbolAnalysisEvidence(
    syntheticImpact,
    syntheticStructure,
    {
      ...validEvidenceShuffled,
      results: [validEvidenceShuffled.results[0], validEvidenceShuffled.results[0], validEvidenceShuffled.results[1]],
    },
  ),
  /Duplicate architecture symbol analysis result/,
  "duplicate selector results must fail even when result count still matches",
);

const undeclaredSelector = {
  kind: "symbol",
  language: "typescript",
  name: "notDeclared",
  aspect: "body",
};
assert.throws(
  () => normalizeArchitectureSymbolAnalysisEvidence(
    syntheticImpact,
    syntheticStructure,
    {
      ...validEvidenceShuffled,
      results: [
        validEvidenceShuffled.results[1],
        validEvidenceShuffled.results[0],
        { selector: undeclaredSelector, availability: "observed", structuralFingerprint: fpB },
      ],
    },
  ),
  /undeclared selector results/,
  "hosts cannot widen reviewed selectors through evidence",
);

assert.throws(
  () => normalizeArchitectureSymbolAnalysisEvidence(
    syntheticImpact,
    syntheticStructure,
    { ...validEvidenceShuffled, results: validEvidenceShuffled.results.slice(0, 2) },
  ),
  /omitted declared selectors/,
  "omitted selectors must be explicit missing/unavailable instead of silently disappearing",
);

assert.throws(
  () => normalizeArchitectureSymbolAnalysisEvidence(
    syntheticImpact,
    syntheticStructure,
    { ...validEvidenceShuffled, ref: "src/not-declared.ts" },
  ),
  /undeclared analysis target/,
);
assert.throws(
  () => normalizeArchitectureSymbolAnalysisEvidence(
    syntheticImpact,
    syntheticStructure,
    { ...validEvidenceShuffled, architectureId: "other-plane" },
  ),
  /undeclared analysis target/,
);

// A host callback is executed once per declared target; exceptions propagate and are never retried/synthesized.
let failingCalls = 0;
await assert.rejects(
  () => analyzeArchitectureStructureManifest(syntheticImpact, syntheticStructure, async () => {
    failingCalls += 1;
    throw new Error("parser unavailable");
  }),
  /parser unavailable/,
);
assert.equal(failingCalls, 1, "C1 must not retry a failed host analyzer call");

let successCalls = 0;
const batch = await analyzeArchitectureStructureManifest(syntheticImpact, syntheticStructure, async (plan) => {
  successCalls += 1;
  return {
    schemaVersion: 1,
    architectureId: plan.architectureId,
    ref: plan.ref,
    sourceRevision: "source-revision-alpha-2",
    analyzerId: "portable-test-analyzer-v1",
    fingerprintScheme: "mssr-ts-symbol-v1",
    results: plan.selectors.map((selector, index) => ({
      selector,
      availability: "observed",
      structuralFingerprint: index === 0 ? fpA : fpB,
    })),
  };
});
assert.equal(successCalls, 1);
assert.equal(batch.length, 1);
assert.equal(batch[0].sourceRevision, "source-revision-alpha-2");
assert.equal(batch[0].fingerprintScheme, "mssr-ts-symbol-v1");

// JSON Schema is a host interchange contract; Zod additionally enforces relational invariants such as duplicate selector keys and line ordering.
const schemaText = await fs.readFile("config/project-context/architecture-impact-symbol-analysis.schema.json", "utf8");
const jsonSchema = JSON.parse(schemaText);
const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true });
assert.equal(ajv.validateSchema(jsonSchema), true, JSON.stringify(ajv.errors));
const validateJson = ajv.compile(jsonSchema);
assert.equal(validateJson(validEvidenceShuffled), true, JSON.stringify(validateJson.errors));
assert.equal(validateJson({ ...validEvidenceShuffled, extra: true }), false, "symbol-analysis JSON schema must stay strict");
assert.equal(validateJson({ ...validEvidenceShuffled, fingerprintScheme: "not valid" }), false);
assert.equal(validateJson({
  ...validEvidenceShuffled,
  results: [{ selector: selectorSignature, availability: "observed", structuralFingerprint: "sha256:bad" }],
}), false);

console.log("MSSR architecture-impact C2f-C.5-C1 symbol-analysis contract tests PASS");
