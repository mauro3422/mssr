import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(runDirectory, "../../../..");
const parentInputs = path.join(root, "experiments/jev-mssr-live/runs/mssr-librarian-jev-full-heading-choice-20260930-v1/inputs");
const summary = JSON.parse(await fs.readFile(path.join(runDirectory, "summary.json"), "utf8"));
const targetFileBytes = await fs.readFile(path.join(parentInputs, "target-index.json"));
const targetIndex = JSON.parse(targetFileBytes.toString("utf8"));
const expected = targetIndex.targetIndex[summary.source.queryCaseId];
assert.ok(expected, "The post-run target annotation must exist.");
const exactTargetMatch = summary.execution.selected.sourceRef === expected.sourceRef
  && summary.execution.selected.headingPath.join(" / ") === expected.targetHeadingPath.join(" / ");

const score = {
  schemaVersion: 1,
  runId: summary.runId,
  scoringMode: "post-run exact-target comparison",
  selectionRunnerReadTargets: false,
  labelProvenance: "dual Luna review; not human document-owner adjudication",
  acceptableAlternativesExhaustivelyReviewed: false,
  selectedSourceRef: summary.execution.selected.sourceRef,
  selectedHeadingPath: summary.execution.selected.headingPath,
  expectedSourceRef: expected.sourceRef,
  expectedHeadingPath: expected.targetHeadingPath,
  exactTargetMatch,
  interpretation: "One exploratory expected-target match is a wiring check, not a quality estimate, calibrated score, or proof that no other section is acceptable.",
  targetIndexSha256: createHash("sha256").update(targetFileBytes).digest("hex"),
};
await fs.writeFile(path.join(runDirectory, "scoring.json"), `${JSON.stringify(score, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ exactTargetMatch, labelProvenance: score.labelProvenance, expectedHeadingPath: score.expectedHeadingPath }));
