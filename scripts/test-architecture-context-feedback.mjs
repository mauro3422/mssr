import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureContextFeedbackSchema,
  architectureImpactManifestSchema,
  architectureImpactProjectionSchema,
  buildArchitectureContextFeedback,
  projectContextManifestSchema,
  resolveMssrSituationContextAuthorityRef,
  resolveMssrSituationContextEntryId,
} from "../dist/index.js";

const fp = (char) => `sha256:${char.repeat(64)}`;
const rev = (char) => `sha256:${char.repeat(64)}`;

const architectureManifest = architectureImpactManifestSchema.parse({
  schemaVersion: 1,
  architectures: [{
    architectureId: "alpha-plane",
    authorityRef: "docs/decisions/0042-alpha.md",
    contextRef: "alpha-architecture-context",
    impactRefs: ["src/alpha.ts"],
  }],
});

const projectManifest = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [
    {
      id: "alpha-architecture-context",
      kind: "context",
      description: "Bounded Alpha architecture context",
      source: { path: ".mssr/knowledge/architecture/alpha.md" },
      topic: "architecture",
      area: "alpha",
      maxChars: 2400,
      actions: ["review"],
    },
    {
      id: "alpha-architecture-adr",
      kind: "context",
      description: "Alpha ADR authority",
      source: { path: "docs/decisions/0042-alpha.md" },
      topic: "architecture",
      area: "alpha",
      maxChars: 3200,
      actions: ["review"],
    },
  ],
});

const reviewProjection = architectureImpactProjectionSchema.parse({
  schemaVersion: 1,
  architectureId: "alpha-plane",
  status: "possible-impact",
  level: "review",
  relationshipClass: "declared",
  evidenceClass: "observed",
  declarationFingerprint: fp("a"),
  baselineFingerprint: fp("b"),
  baselineAuthorityRevision: rev("c"),
  currentAuthorityRevision: rev("c"),
  baselineSourceSetFingerprint: fp("d"),
  currentSourceSetFingerprint: fp("e"),
  reasonCodes: ["impact-revision-changed"],
  changes: [{
    role: "impact",
    ref: "src/alpha.ts",
    kind: "revision",
    baseline: { ref: "src/alpha.ts", availability: "available", revision: rev("1") },
    current: { ref: "src/alpha.ts", availability: "available", revision: rev("2") },
  }],
  unresolvedRefs: [],
  evidenceComplete: true,
  fingerprint: fp("f"),
  notifyOnWatch: false,
  advisoryOnly: true,
});

const feedback = buildArchitectureContextFeedback({
  architectureManifest,
  projection: reviewProjection,
  projectContextManifest: projectManifest,
});
assert.equal(feedback.requests.length, 2, "active architecture review should recommend contextRef + authority only");
assert.deepEqual(feedback.requests.map((item) => item.role), ["context", "authority"]);
assert.equal(feedback.requests[0].contextRef, "alpha-architecture-context");
assert.equal(feedback.requests[0].request.resolution, "exact-entry");
assert.equal(feedback.requests[0].request.entry?.id, "alpha-architecture-context");
assert.equal(feedback.requests[0].request.entry?.suggestedMaxChars, 2400);
assert.equal(feedback.requests[0].request.required, false, "feedback must remain advisory and normal-budgeted");
assert.equal(feedback.requests[1].request.authorityRef, "docs/decisions/0042-alpha.md");
assert.equal(feedback.requests[1].request.resolution, "exact-entry");
assert.equal(feedback.requests[1].request.entry?.id, "alpha-architecture-adr");
assert.equal(feedback.trigger, "natural-replan");
assert.equal(feedback.replanOnly, true);
assert.equal(feedback.semanticRetrievalRerun, false);
assert.equal(feedback.autoLoad, false);
assert.equal(feedback.budgetOverride, false);
assert.equal(feedback.selectionPolicy, "normal-budgeted-selection");
assert.equal(feedback.advisoryOnly, true);
assert.ok(feedback.requests.every((item) => item.request.reasonCodes.includes("architecture-review-active")));

const aligned = architectureImpactProjectionSchema.parse({
  ...reviewProjection,
  status: "aligned",
  level: "ok",
  reasonCodes: ["aligned"],
  changes: [],
  currentSourceSetFingerprint: reviewProjection.baselineSourceSetFingerprint,
  fingerprint: fp("9"),
});
const clean = buildArchitectureContextFeedback({ architectureManifest, projection: aligned, projectContextManifest: projectManifest });
assert.deepEqual(clean.requests, [], "aligned architecture must not inject context at replans");
assert.equal(clean.autoLoad, false);

const noIndexedAdr = projectContextManifestSchema.parse({
  schemaVersion: 1,
  core: [],
  modules: [projectManifest.modules[0]],
});
const authorityOnlyFallback = buildArchitectureContextFeedback({
  architectureManifest,
  projection: reviewProjection,
  projectContextManifest: noIndexedAdr,
});
assert.equal(authorityOnlyFallback.requests[1].request.kind, "canonical-authority");
assert.equal(authorityOnlyFallback.requests[1].request.resolution, "unindexed-authority");
assert.ok(authorityOnlyFallback.requests[1].request.reasonCodes.includes("authority-not-indexed"));

const directEntry = resolveMssrSituationContextEntryId("alpha-architecture-context", projectManifest);
assert.equal(directEntry.resolution, "exact-entry");
assert.equal(directEntry.entry?.id, "alpha-architecture-context");
const directAuthority = resolveMssrSituationContextAuthorityRef("docs/decisions/0042-alpha.md", projectManifest);
assert.equal(directAuthority.resolution, "exact-entry");
assert.equal(directAuthority.entry?.id, "alpha-architecture-adr");

const selfArchitectureManifest = architectureImpactManifestSchema.parse(JSON.parse(await fs.readFile(".mssr/architecture-impact.json", "utf8")));
const selfProjectManifest = projectContextManifestSchema.parse(JSON.parse(await fs.readFile(".mssr/project-context.json", "utf8")));
const selfProjection = architectureImpactProjectionSchema.parse({
  ...reviewProjection,
  architectureId: "architecture-impact-plane",
  fingerprint: fp("8"),
});
const selfFeedback = buildArchitectureContextFeedback({
  architectureManifest: selfArchitectureManifest,
  projection: selfProjection,
  projectContextManifest: selfProjectManifest,
});
assert.equal(selfFeedback.requests.length, 2);
assert.equal(selfFeedback.requests[0].role, "context");
assert.equal(selfFeedback.requests[0].contextRef, "mssr-architecture-impact-decision");
assert.equal(selfFeedback.requests[0].request.resolution, "exact-entry");
assert.equal(selfFeedback.requests[0].request.entry?.id, "mssr-architecture-impact-decision");
assert.equal(selfFeedback.requests[1].role, "authority");
assert.equal(selfFeedback.requests[1].request.authorityRef, "docs/decisions/0005-architecture-impact-drift-links.md");
assert.equal(selfFeedback.requests[1].request.kind, "canonical-authority");
assert.equal(selfFeedback.requests[1].request.resolution, "unindexed-authority");
assert.equal(selfFeedback.replanOnly, true);
assert.equal(selfFeedback.autoLoad, false);
assert.equal(selfFeedback.semanticRetrievalRerun, false);
assert.equal(selfFeedback.budgetOverride, false);

assert.throws(() => architectureContextFeedbackSchema.parse({ ...feedback, autoLoad: true }));
assert.throws(() => architectureContextFeedbackSchema.parse({ ...feedback, budgetOverride: true }));
assert.throws(() => architectureContextFeedbackSchema.parse({ ...feedback, semanticRetrievalRerun: true }));
assert.throws(() => architectureContextFeedbackSchema.parse({ ...feedback, trigger: "tool-response" }));

const schema = JSON.parse(await fs.readFile("config/project-context/architecture-context-feedback.schema.json", "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
assert.equal(validate(feedback), true, JSON.stringify(validate.errors));
assert.equal(validate({ ...feedback, autoLoad: true }), false);
assert.equal(validate({ ...feedback, unexpected: true }), false);

console.log("MSSR C2f-D architecture context feedback: PASS");
