import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../experiments/jev-metadata-integration/confidence-diagnostic.mjs");
const result = JSON.parse(execFileSync(process.execPath, [scriptPath], { encoding: "utf8" }));
assert.equal(result.calibrationClaim, false);
assert.equal(result.productionThreshold, null);
assert.equal(result.runs.length, 2);
assert.deepEqual(result.runs.map((run) => [
  run.requests, run.providerCalls, run.selected, run.abstained, run.strictExactMatches,
]), [
  [52, 52, 50, 2, 34],
  [52, 156, 49, 3, 31],
]);
assert.ok(result.runs.every((run) => run.binaryBrierAgainstStrictExactTargetAmongSelections >= 0
  && run.binaryBrierAgainstStrictExactTargetAmongSelections <= 1));
console.log("PASS confidence diagnostic: frozen hashes, paired denominators, and exploratory-only claims");
