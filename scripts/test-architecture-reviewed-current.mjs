import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import {
  architectureImpactProjectionSchema,
  architectureReviewedCurrentEvaluationSchema,
  architectureReviewedCurrentReceiptSchema,
  createArchitectureReviewedCurrentReceipt,
  evaluateArchitectureReviewedCurrent,
} from "../dist/index.js";

const fp = (c) => `sha256:${c.repeat(64)}`;
const rev = (c) => `sha256:${c.repeat(64)}`;

function projection(overrides = {}) {
  return architectureImpactProjectionSchema.parse({
    schemaVersion: 1,
    architectureId: "alpha-plane",
    status: "possible-impact",
    level: "review",
    relationshipClass: "declared",
    evidenceClass: "observed",
    declarationFingerprint: fp("a"),
    baselineFingerprint: fp("b"),
    baselineAuthorityRevision: rev("c"),
    currentAuthorityRevision: rev("d"),
    baselineSourceSetFingerprint: fp("e"),
    currentSourceSetFingerprint: fp("f"),
    reasonCodes: ["architecture-authority-revision-changed"],
    changes: [{
      role: "authority",
      ref: "docs/alpha.md",
      kind: "revision",
      baseline: { ref: "docs/alpha.md", availability: "available", revision: rev("c") },
      current: { ref: "docs/alpha.md", availability: "available", revision: rev("d") },
    }],
    unresolvedRefs: [],
    evidenceComplete: true,
    fingerprint: fp("9"),
    notifyOnWatch: false,
    advisoryOnly: true,
    ...overrides,
  });
}

const current = projection();
const receipt = createArchitectureReviewedCurrentReceipt(current, {
  decision: "reviewed-current",
  reviewedAt: "2026-08-19T01:45:00.000Z",
});
assert.equal(receipt.metadataOnly, true);
assert.equal(receipt.reviewClass, "reviewed-current");
assert.equal(receipt.reviewedAuthorityRevision, current.currentAuthorityRevision);
assert.equal(receipt.reviewedSourceSetFingerprint, current.currentSourceSetFingerprint);
assert.equal(receipt.reviewedProjectionFingerprint, current.fingerprint);
assert.equal(receipt.advisoryOnly, true);

const exact = evaluateArchitectureReviewedCurrent(current, receipt);
assert.equal(exact.state, "reviewed-current");
assert.equal(exact.level, "ok");
assert.equal(exact.suppressRepeatedReview, true);
assert.equal(exact.receiptValid, true);
assert.equal(exact.canonicalRewriteAllowed, false);
const corrupt = evaluateArchitectureReviewedCurrent(current, { ...receipt, receiptFingerprint: fp("0") });
assert.equal(corrupt.state, "receipt-invalidated");
assert.ok(corrupt.reasonCodes.includes("receipt-fingerprint-invalid"));
assert.equal(corrupt.suppressRepeatedReview, false);

const missing = evaluateArchitectureReviewedCurrent(current, null);
assert.equal(missing.state, "review-required");
assert.equal(missing.suppressRepeatedReview, false);

for (const [name, changed, reason] of [
  ["declaration", { declarationFingerprint: fp("1"), fingerprint: fp("1") }, "declaration-fingerprint-changed"],
  ["baseline", { baselineFingerprint: fp("2"), fingerprint: fp("2") }, "reviewed-baseline-changed"],
  ["authority", { currentAuthorityRevision: rev("3"), fingerprint: fp("3") }, "authority-revision-changed"],
  ["source-set", { currentSourceSetFingerprint: fp("4"), fingerprint: fp("4") }, "source-set-fingerprint-changed"],
  ["projection-only", { fingerprint: fp("5") }, "projection-fingerprint-changed"],
]) {
  const result = evaluateArchitectureReviewedCurrent(projection(changed), receipt);
  assert.equal(result.state, "receipt-invalidated", `${name} must invalidate receipt`);
  assert.equal(result.suppressRepeatedReview, false);
  assert.ok(result.reasonCodes.includes(reason), `${name} must report ${reason}`);
}

const incomplete = evaluateArchitectureReviewedCurrent(projection({
  status: "unresolved",
  currentAuthorityRevision: null,
  currentSourceSetFingerprint: null,
  evidenceComplete: false,
  unresolvedRefs: [{ ref: "docs/alpha.md", availability: "unavailable", reasonCode: "fs-eacces" }],
  reasonCodes: ["architecture-authority-unavailable"],
  changes: [],
  fingerprint: fp("6"),
}), receipt);
assert.equal(incomplete.state, "review-required");
assert.equal(incomplete.reasonCodes[0], "review-evidence-incomplete");
assert.equal(incomplete.suppressRepeatedReview, false);
assert.throws(() => createArchitectureReviewedCurrentReceipt(projection({ status: "aligned", level: "ok", reasonCodes: ["aligned"], changes: [], currentAuthorityRevision: rev("c"), currentSourceSetFingerprint: fp("e"), fingerprint: fp("7") }), { decision: "reviewed-current", reviewedAt: "2026-08-19T01:45:00.000Z" }), /active possible-impact review/);
assert.throws(() => architectureReviewedCurrentReceiptSchema.parse({ ...receipt, proceduralContent: "do not store me" }));
assert.throws(() => architectureReviewedCurrentEvaluationSchema.parse({ ...exact, canonicalRewriteAllowed: true }));

const ajv = new Ajv2020({ allErrors: true, strict: false, formats: { "date-time": true } });
for (const [path, value] of [
  ["config/project-context/architecture-reviewed-current-receipt.schema.json", receipt],
  ["config/project-context/architecture-reviewed-current-evaluation.schema.json", exact],
]) {
  const schema = JSON.parse(await fs.readFile(path, "utf8"));
  const validate = ajv.compile(schema);
  assert.equal(validate(value), true, `${path}: ${JSON.stringify(validate.errors)}`);
  assert.equal(validate({ ...value, unexpected: true }), false);
}

console.log("MSSR C2f-E reviewed-current receipts: PASS");
