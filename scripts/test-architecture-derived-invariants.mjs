import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureDerivedGraphCandidatesSchema,
  architectureInvariantEvaluationSchema,
  architectureInvariantGraphEvidenceSchema,
  architectureInvariantManifestSchema,
  deriveArchitectureGraphCandidates,
  evaluateArchitectureInvariants,
  findArchitectureImpactForTouchedRefs,
  loadArchitectureImpactManifest,
  loadArchitectureInvariantManifest,
  validateArchitectureInvariantManifestAgainstImpactManifest,
} from "../dist/index.js";

const impact = {
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context",
    impactRefs: ["src/alpha.ts", "src/shared.ts"],
  }],
};

const derived = deriveArchitectureGraphCandidates(impact, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  relationshipClass: "derived",
  evidenceClass: "observed",
  analyzerId: "fixture-graph-v1",
  edges: [
    { kind: "import", sourceRef: "src/alpha.ts", targetRef: "src/nearby.ts" },
    { kind: "import", sourceRef: "src/alpha.ts", targetRef: "src/nearby.ts" },
    { kind: "call", sourceRef: "src/alpha.ts", targetRef: "src/helper.ts", sourceSymbol: "runAlpha", targetSymbol: "help" },
  ],
});
assert.equal(derived.relationshipClass, "derived");
assert.equal(derived.canonicalReviewEligible, false);
assert.equal(derived.candidates.length, 2, "derived graph candidates must deduplicate deterministically");
assert.ok(derived.candidates.every((candidate) => candidate.promotionState === "candidate"));
assert.deepEqual(findArchitectureImpactForTouchedRefs(impact, ["src/nearby.ts"]), [], "derived target must not widen declared architecture scope");
assert.throws(() => deriveArchitectureGraphCandidates(impact, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  relationshipClass: "derived",
  evidenceClass: "observed",
  analyzerId: "fixture-graph-v1",
  edges: [{ kind: "import", sourceRef: "src/not-declared.ts", targetRef: "src/alpha.ts" }],
}), /outside declared architecture/);
assert.throws(() => architectureDerivedGraphCandidatesSchema.parse({ ...derived, canonicalReviewEligible: true }));

const invariants = architectureInvariantManifestSchema.parse({
  schemaVersion: 1,
  invariants: [
    {
      invariantId: "alpha-no-host-import",
      architectureId: "alpha-plane",
      relationshipClass: "declared",
      description: "Portable alpha core must not import the host adapter.",
      kind: "forbid-edge",
      edgeKind: "import",
      sourceRef: "src/alpha.ts",
      targetRef: "src/host-adapter.ts",
    },
    {
      invariantId: "alpha-requires-shared",
      architectureId: "alpha-plane",
      relationshipClass: "declared",
      description: "Alpha core requires the shared dependency edge.",
      kind: "require-edge",
      edgeKind: "dependency",
      sourceRef: "src/alpha.ts",
      targetRef: "src/shared.ts",
    },
  ],
});
validateArchitectureInvariantManifestAgainstImpactManifest(invariants, impact);
assert.throws(() => validateArchitectureInvariantManifestAgainstImpactManifest({
  schemaVersion: 1,
  invariants: [{ ...invariants.invariants[0], invariantId: "bad-owner", architectureId: "missing-plane" }],
}, impact), /unknown architectureId/);

function evidence(coverage, edges) {
  return architectureInvariantGraphEvidenceSchema.parse({
    schemaVersion: 1,
    architectureId: "alpha-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    analyzerId: "fixture-graph-v1",
    coverage,
    edges,
  });
}

const cleanComplete = evaluateArchitectureInvariants(impact, invariants, evidence("complete", [
  { kind: "dependency", sourceRef: "src/alpha.ts", targetRef: "src/shared.ts" },
]));
assert.deepEqual(cleanComplete.map((item) => [item.invariantId, item.status, item.level, item.attentionClass]), [
  ["alpha-no-host-import", "satisfied", "ok", "none"],
  ["alpha-requires-shared", "satisfied", "ok", "none"],
]);
assert.ok(cleanComplete.every((item) => item.canonicalRewriteAllowed === false));

const forbiddenObserved = evaluateArchitectureInvariants(impact, invariants, evidence("partial", [
  { kind: "import", sourceRef: "src/alpha.ts", targetRef: "src/host-adapter.ts" },
]));
const forbidden = forbiddenObserved.find((item) => item.invariantId === "alpha-no-host-import");
assert.equal(forbidden.status, "violated");
assert.equal(forbidden.level, "review");
assert.equal(forbidden.attentionClass, "invariant-violation");
assert.equal(forbidden.reasonCode, "forbidden-edge-observed");

const partialMissing = evaluateArchitectureInvariants(impact, invariants, evidence("partial", []));
assert.ok(partialMissing.every((item) => item.status === "unresolved"), "partial evidence must never prove absence");
assert.ok(partialMissing.every((item) => item.level === "watch"));

const completeMissing = evaluateArchitectureInvariants(impact, invariants, evidence("complete", []));
assert.equal(completeMissing.find((item) => item.invariantId === "alpha-no-host-import").status, "satisfied");
const requiredMissing = completeMissing.find((item) => item.invariantId === "alpha-requires-shared");
assert.equal(requiredMissing.status, "violated");
assert.equal(requiredMissing.reasonCode, "required-edge-absent");
assert.equal(requiredMissing.attentionClass, "invariant-violation");

const ajv = new Ajv2020({ allErrors: true, strict: false });
const schemaCases = [
  ["config/project-context/architecture-derived-graph.schema.json", derived],
  ["config/project-context/architecture-invariant-manifest.schema.json", invariants],
  ["config/project-context/architecture-invariant-graph-evidence.schema.json", evidence("complete", [])],
  ["config/project-context/architecture-invariant-evaluation.schema.json", requiredMissing],
];
for (const [schemaPath, value] of schemaCases) {
  const schema = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, `${schemaPath} must accept portable runtime output: ${JSON.stringify(validate.errors)}`);
  assert.equal(validate({ ...value, unexpected: true }), false, `${schemaPath} must reject unknown fields`);
}
assert.throws(() => architectureInvariantEvaluationSchema.parse({ ...requiredMissing, canonicalRewriteAllowed: true }));

const selfImpactLoad = await loadArchitectureImpactManifest(process.cwd());
assert.equal(selfImpactLoad.found, true, "self-host architecture-impact manifest must load");
const selfInvariantLoad = await loadArchitectureInvariantManifest(process.cwd(), selfImpactLoad.manifest);
assert.equal(selfInvariantLoad.found, true, "self-host architecture-invariant manifest must load");
const selfInvariantResult = evaluateArchitectureInvariants(
  selfImpactLoad.manifest,
  selfInvariantLoad.manifest,
  architectureInvariantGraphEvidenceSchema.parse({
    schemaVersion: 1,
    architectureId: "architecture-impact-plane",
    relationshipClass: "declared",
    evidenceClass: "observed",
    analyzerId: "mssr-typescript-import-graph-v1",
    coverage: "complete",
    edges: [
      { kind: "dependency", sourceRef: "src/architecture-impact-projection.ts", targetRef: "src/architecture-impact.ts" },
      { kind: "dependency", sourceRef: "src/architecture-impact-projection.ts", targetRef: "src/architecture-impact-observation.ts" },
      { kind: "dependency", sourceRef: "src/architecture-impact-projection.ts", targetRef: "src/operational-notices.ts" }
    ]
  }),
);
assert.deepEqual(selfInvariantResult.map((item) => [item.invariantId, item.status, item.level]), [
  ["architecture-impact-projection-no-context-host-dependency", "satisfied", "ok"],
]);
assert.equal(selfInvariantResult[0].canonicalRewriteAllowed, false);
console.log("architecture derived graph + invariants tests passed");
