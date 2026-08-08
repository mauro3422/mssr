import assert from "node:assert/strict";
import { normalizeMssrIntent } from "../dist/index.js";

const canonical = normalizeMssrIntent({
  domains: ["coding"],
  actions: ["edit"],
  signals: ["nominal"],
  risk: "write",
});
assert.equal(canonical.status, "canonical");
assert.equal(canonical.intent?.domains[0], "coding");

const normalized = normalizeMssrIntent({
  domains: ["development"],
  actions: ["inspect"],
  signals: ["nominal"],
  risk: "bounded-write",
});
assert.equal(normalized.status, "normalized");
assert.deepEqual(normalized.intent?.domains, ["coding"]);
assert.deepEqual(normalized.intent?.actions, ["review"]);
assert.equal(normalized.intent?.risk, "write");

const invalid = normalizeMssrIntent({
  domains: ["not-a-domain"],
  actions: ["edit"],
  signals: ["nominal"],
});
assert.equal(invalid.status, "correction-required");
assert.equal(invalid.issues.some((issue) => issue.field === "domains"), true);

console.log("intent normalizer tests passed");
