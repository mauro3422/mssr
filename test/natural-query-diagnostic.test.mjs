import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  NaturalQueryDiagnosticError,
  classifyCaseSidecarTargets,
  compareRankings,
  evaluateExactFetchability,
  parseCandidateBank,
} from "../experiments/jev-metadata-integration/natural-query-diagnostic.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bank = await fs.readFile(path.join(repositoryRoot, "experiments", "jev-metadata-integration", "candidate-bank.md"), "utf8");
const pins = JSON.parse(await fs.readFile(path.join(repositoryRoot, "experiments", "jev-metadata-integration", "natural-query-diagnostic-pins.json"), "utf8"));

const cases = parseCandidateBank(bank, pins.caseIds);
assert.deepEqual(cases.map((item) => item.id), ["C01", "C02", "C04", "C24"]);
assert.equal(cases.length, pins.expectedConceptCases);
assert.equal(cases[0].queryEs.startsWith("Si dos señales"), true);
assert.equal(cases[0].queryEn.startsWith("When repository evidence"), true);
assert.equal(cases[3].sourcePath, ".mssr/knowledge/architecture/project-context-librarian-metadata.md");
assert.equal(parseCandidateBank(bank, ["C03"]).length, 1, "excluded cases remain parsable but are not selected by the pinned diagnostic");
const projectedItems = cases.filter((item) => pins.expectedSidecarCaseIds.includes(item.id)).map((item) => ({
  status: "projected", sourceRef: item.sourcePath, headingPath: [item.anchorHeading], entryId: item.id,
}));
const targetClassification = classifyCaseSidecarTargets(cases, projectedItems);
assert.deepEqual(targetClassification.filter((item) => item.sidecarTargetDeclared).map((item) => item.caseId).sort(), pins.expectedSidecarCaseIds.slice().sort());
assert.deepEqual(targetClassification.filter((item) => !item.sidecarTargetDeclared).map((item) => item.caseId).sort(), pins.expectedUntaggedCaseIds.slice().sort());

const range = (id, sourceRef, rangeId) => ({ handle: { id, sourceRef, rangeId }, headingPath: [rangeId], score: 0.5 });
const baseline = { results: [range("a", "doc-a.md", "r1"), range("b", "doc-b.md", "r2")] };
const atoms = { results: [range("b", "doc-b.md", "r2"), range("c", "doc-c.md", "r3")] };
const delta = compareRankings(baseline, atoms);
assert.deepEqual({
  baselineCount: delta.baselineCount,
  atomCount: delta.atomCount,
  topKOverlap: delta.topKOverlap,
  baselineOnlyCount: delta.baselineOnlyCount,
  atomOnlyCount: delta.atomOnlyCount,
}, { baselineCount: 2, atomCount: 2, topKOverlap: 1, baselineOnlyCount: 1, atomOnlyCount: 1 });
assert.ok(delta.changedRanks.some((item) => item.handleId === "b" && item.change === "rank-changed"));
assert.ok(delta.changedRanks.some((item) => item.handleId === "a" && item.change === "removed-with-atoms"));
assert.ok(delta.changedRanks.some((item) => item.handleId === "c" && item.change === "added-with-atoms"));
assert.deepEqual(delta.changedRanks.find((item) => item.handleId === "c").headingPath, ["r3"]);

const fetchItem = (id, rangeCodeUnits, exactFetchable) => ({
  handle: { id, rangeId: id, fingerprint: "fingerprint-" + id }, rangeCodeUnits, exactFetchable,
});
let fetchedCandidate = null;
const fetchEvaluation = evaluateExactFetchability({ results: [
  fetchItem("oversize-top", 20_001, false), fetchItem("fetchable-next", 20_000, true),
] }, {
  fetchLimitChars: 20_000,
  fetchEvidence: (item) => { fetchedCandidate = item.handle.id; return { fingerprint: item.handle.fingerprint }; },
});
assert.equal(fetchEvaluation.topResult.exactFetchable, false);
assert.equal(fetchEvaluation.highestRankedFetchable.rank, 2);
assert.equal(fetchedCandidate, "fetchable-next");
const noFetchable = evaluateExactFetchability({ results: [fetchItem("oversize-only", 20_001, false)] }, {
  fetchLimitChars: 20_000,
  fetchEvidence: () => { throw new Error("Unfetchable result must not be fetched."); },
});
assert.equal(noFetchable.highestRankedFetchable, null);
assert.throws(() => evaluateExactFetchability({ results: [fetchItem("inconsistent", 20_001, true)] }, {
  fetchLimitChars: 20_000, fetchEvidence: () => ({ fingerprint: "unreachable" }),
}), (error) => error instanceof NaturalQueryDiagnosticError && error.code === "fetchability-contract-mismatch");

assert.throws(
  () => parseCandidateBank("| C01 | `../outside.md#Heading` | Pregunta | Question | Dimension |", ["C01"]),
  (error) => error instanceof NaturalQueryDiagnosticError && error.code === "unsafe-source-path",
);

process.stdout.write("PASS natural-query diagnostic: bilingual seed selection, excluded cases, and rank-delta accounting\n");
