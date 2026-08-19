import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureImpactFileObservationSchema,
  architectureImpactHostEvidenceSchema,
  buildArchitectureImpactSituationObservations,
  normalizeArchitectureImpactObservationEvidence,
  observeArchitectureImpactManifest,
  planArchitectureImpactObservations,
} from "../dist/index.js";

const manifest = {
  schemaVersion: 1,
  architectures: [
    {
      architectureId: "alpha-plane",
      authorityRef: "docs/alpha.md",
      contextRef: "alpha-context",
      impactRefs: ["src/alpha-a.ts", "src/shared.ts"],
    },
    {
      architectureId: "beta-plane",
      authorityRef: "docs/beta.md",
      impactRefs: ["src/beta.ts", "src/shared.ts"],
    },
  ],
};

const plans = planArchitectureImpactObservations(manifest);
assert.deepEqual(plans, [
  {
    schemaVersion: 1,
    architectureId: "alpha-plane",
    authorityRef: "docs/alpha.md",
    impactRefs: ["src/alpha-a.ts", "src/shared.ts"],
  },
  {
    schemaVersion: 1,
    architectureId: "beta-plane",
    authorityRef: "docs/beta.md",
    impactRefs: ["src/beta.ts", "src/shared.ts"],
  },
]);
assert.equal("contextRef" in plans[0], false, "observation plans should name files only; context loading belongs to C2f-D");

const normalized = normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "sha256:authority-a" },
  impacts: [
    { ref: "src/shared.ts", availability: "unavailable", reasonCode: "read-failed" },
    { ref: "src/alpha-a.ts", availability: "available", revision: "sha256:alpha-a" },
  ],
});
assert.deepEqual(normalized, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  relationshipClass: "declared",
  evidenceClass: "observed",
  declared: {
    authorityRef: "docs/alpha.md",
    contextRef: "alpha-context",
    impactRefs: ["src/alpha-a.ts", "src/shared.ts"],
  },
  observed: {
    authority: { ref: "docs/alpha.md", availability: "available", revision: "sha256:authority-a" },
    impacts: [
      { ref: "src/alpha-a.ts", availability: "available", revision: "sha256:alpha-a" },
      { ref: "src/shared.ts", availability: "unavailable", reasonCode: "read-failed" },
    ],
  },
}, "host input order must not affect canonical manifest order");

assert.equal(architectureImpactFileObservationSchema.safeParse({
  ref: "src/a.ts",
  availability: "available",
}).success, false, "available evidence requires a revision");
assert.equal(architectureImpactFileObservationSchema.safeParse({
  ref: "src/a.ts",
  availability: "missing",
  revision: "invented",
}).success, false, "missing evidence must not carry a revision");
assert.equal(architectureImpactFileObservationSchema.safeParse({
  ref: "src/a.ts",
  availability: "unavailable",
  revision: "invented",
}).success, false, "unavailable evidence must not carry a revision");
assert.equal(architectureImpactFileObservationSchema.safeParse({
  ref: "src/a.ts",
  availability: "unavailable",
  reasonCode: "Permission denied with prose",
}).success, false, "unavailable reason must stay a bounded code, not raw error prose");

assert.equal(architectureImpactHostEvidenceSchema.safeParse({
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "a" },
  impacts: [
    { ref: "src/alpha-a.ts", availability: "available", revision: "1" },
    { ref: "src/alpha-a.ts", availability: "available", revision: "1" },
  ],
}).success, false, "duplicate host impact observations must fail");

assert.throws(() => normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "unknown-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "a" },
  impacts: [{ ref: "src/alpha-a.ts", availability: "available", revision: "1" }],
}), /undeclared architectureId/);

assert.throws(() => normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/other.md", availability: "available", revision: "a" },
  impacts: [
    { ref: "src/alpha-a.ts", availability: "available", revision: "1" },
    { ref: "src/shared.ts", availability: "available", revision: "2" },
  ],
}), /authority observation mismatch/);

assert.throws(() => normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "a" },
  impacts: [
    { ref: "src/alpha-a.ts", availability: "available", revision: "1" },
    { ref: "src/undeclared.ts", availability: "available", revision: "2" },
  ],
}), /undeclared impactRefs/);

assert.throws(() => normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "a" },
  impacts: [{ ref: "src/alpha-a.ts", availability: "available", revision: "1" }],
}), /omitted declared impactRefs/);

const withMissing = normalizeArchitectureImpactObservationEvidence(manifest, {
  schemaVersion: 1,
  architectureId: "beta-plane",
  authority: { ref: "docs/beta.md", availability: "missing" },
  impacts: [
    { ref: "src/shared.ts", availability: "unavailable", reasonCode: "permission-denied" },
    { ref: "src/beta.ts", availability: "available", revision: "sha256:beta" },
  ],
});
const situation = buildArchitectureImpactSituationObservations(withMissing);
assert.equal(situation.length, 3);
assert.equal(situation[0].role, "reference");
assert.equal(situation[0].authority, "canonical");
assert.equal(situation[0].state, "unavailable", "positively observed missing file maps to Situation unavailable");
assert.equal(situation[0].revision, undefined);
assert.equal(situation[1].state, "observed");
assert.equal(situation[1].revision, "sha256:beta");
assert.equal(situation[2].state, "unknown", "host inspection failure maps to bounded Situation uncertainty");
assert.equal(situation[2].revision, undefined);
for (const item of situation) {
  assert.equal(item.category, "architecture");
  assert.equal(item.evidenceClass, "observed");
  assert.equal(item.required, false);
  assert.ok(item.key.length <= 160);
  assert.ok(item.observer.length <= 240);
}
assert.equal(new Set(situation.map((item) => item.key)).size, 3, "each architecture file observation needs a distinct stable Situation key");

const longRef = `src/${"segment/".repeat(35)}file.ts`;
const longManifest = {
  schemaVersion: 1,
  architectures: [{ architectureId: "long-plane", authorityRef: "docs/long.md", impactRefs: [longRef] }],
};
const longEvidence = normalizeArchitectureImpactObservationEvidence(longManifest, {
  schemaVersion: 1,
  architectureId: "long-plane",
  authority: { ref: "docs/long.md", availability: "available", revision: "a" },
  impacts: [{ ref: longRef, availability: "available", revision: "b" }],
});
const longSituation = buildArchitectureImpactSituationObservations(longEvidence);
assert.ok(longSituation[1].sourceRef.startsWith("sha256:"), "oversized Situation sourceRef should be collision-resistant and bounded");
assert.ok(longSituation[1].sourceRef.length <= 240);

const observedPlans = [];
const hostResult = await observeArchitectureImpactManifest(manifest, async (plan) => {
  observedPlans.push(plan.architectureId);
  return {
    schemaVersion: 1,
    architectureId: plan.architectureId,
    authority: { ref: plan.authorityRef, availability: "available", revision: `authority:${plan.architectureId}` },
    impacts: [...plan.impactRefs].reverse().map((ref) => ({ ref, availability: "available", revision: `source:${ref}` })),
  };
});
assert.deepEqual(observedPlans, ["alpha-plane", "beta-plane"], "observer boundary should run deterministically in manifest order");
assert.deepEqual(hostResult.map((item) => item.architectureId), ["alpha-plane", "beta-plane"]);
assert.deepEqual(hostResult[0].observed.impacts.map((item) => item.ref), ["src/alpha-a.ts", "src/shared.ts"]);

let calls = 0;
await assert.rejects(
  () => observeArchitectureImpactManifest(manifest, async () => {
    calls += 1;
    throw new Error("host-read-failed");
  }),
  /host-read-failed/,
);
assert.equal(calls, 1, "portable MSSR must not retry or synthesize evidence after a host observer failure");

assert.equal("sourceSetFingerprint" in normalized, false, "C2f-B must not own C2f-C source-set fingerprinting");
assert.equal("possibleImpact" in normalized, false, "C2f-B must not classify possible-impact");
assert.equal("notice" in normalized, false, "C2f-B must not emit an Operational Notice");

const schemaText = await fs.readFile(new URL("../config/project-context/architecture-impact-observation.schema.json", import.meta.url), "utf8");
const jsonSchema = JSON.parse(schemaText);
const ajv = new Ajv2020({ allErrors: true, strict: true, validateSchema: true });
assert.equal(ajv.validateSchema(jsonSchema), true, JSON.stringify(ajv.errors));
const validateJson = ajv.compile(jsonSchema);
const validHostEvidence = {
  schemaVersion: 1,
  architectureId: "alpha-plane",
  authority: { ref: "docs/alpha.md", availability: "available", revision: "sha256:a" },
  impacts: [
    { ref: "src/alpha-a.ts", availability: "available", revision: "sha256:b" },
    { ref: "src/shared.ts", availability: "unavailable", reasonCode: "read-failed" },
  ],
};
assert.equal(validateJson(validHostEvidence), true, JSON.stringify(validateJson.errors));
assert.equal(validateJson({ ...validHostEvidence, extra: true }), false, "JSON evidence schema must reject unknown fields");
assert.equal(validateJson({ ...validHostEvidence, authority: { ref: "docs/alpha.md", availability: "available" } }), false, "JSON schema must require revision for available evidence");
assert.equal(validateJson({ ...validHostEvidence, authority: { ref: "docs/alpha.md", availability: "missing", revision: "invented" } }), false, "JSON schema must reject revision on missing evidence");
assert.equal(validateJson({ ...validHostEvidence, authority: { ref: "docs/alpha.md", availability: "unavailable", revision: "invented" } }), false, "JSON schema must reject revision on unavailable evidence");

console.log("MSSR architecture-impact C2f-B observation contract tests PASS");
