import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertCandidateIdentity,
  assertPinnedInputHashes,
  assertPreProviderLifecycleGate,
  assertStartJevApproval,
  buildRunCompletionReceipt,
  finalizeFatalRun,
  observeSelectionProviderCalls,
  resolveExternalRunRoot,
  summarizeProviderCalls,
  validateCompletionArtifacts,
  verifySha256Inventory,
  writeSha256Inventory,
} from "../experiments/jev-mssr-live/runner-contracts.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const rootFixture = mkdtempSync(join(tmpdir(), "jev-root-guard-"));
try {
  const repoRoot = join(rootFixture, "repo");
  const externalRunRoot = join(rootFixture, "bench-runs", "run-v1");
  const externalRunsTree = join(rootFixture, "archive", "runs", "run-v2");
  const nestedRunsRoot = join(repoRoot, "experiments", "suite", "runs", "run-v1");
  mkdirSync(repoRoot, { recursive: true });
  mkdirSync(externalRunRoot, { recursive: true });
  mkdirSync(externalRunsTree, { recursive: true });
  mkdirSync(nestedRunsRoot, { recursive: true });
  assert.equal(resolveExternalRunRoot(repoRoot, externalRunRoot), externalRunRoot);
  assert.throws(() => resolveExternalRunRoot(repoRoot, externalRunsTree), /outside any runs/);
  assert.throws(() => resolveExternalRunRoot(repoRoot, undefined), /explicit --run-root/);
  assert.throws(() => resolveExternalRunRoot(repoRoot, repoRoot), /outside the repository/);
  assert.throws(() => resolveExternalRunRoot(repoRoot, nestedRunsRoot), /outside the repository/);
  assert.throws(() => resolveExternalRunRoot(repoRoot, rootFixture), /parent of the repository/);
} finally {
  rmSync(rootFixture, { recursive: true, force: true });
}

assert.throws(() => assertStartJevApproval(undefined), /exact START_JEV/);
assert.throws(() => assertStartJevApproval("START"), /exact START_JEV/);
assert.throws(() => assertStartJevApproval(" START_JEV"), /exact START_JEV/);
assert.throws(() => assertStartJevApproval("START_JEV "), /exact START_JEV/);
assert.equal(assertStartJevApproval("START_JEV"), true);

const completeLifecycleGate = {
  contextChain: "complete",
  nextRequiredAction: "execute-active-phase-then-record-phase-and-replan",
  postContextAction: null,
};
assert.equal(assertPreProviderLifecycleGate(completeLifecycleGate), completeLifecycleGate);
assert.throws(() => assertPreProviderLifecycleGate({
  ...completeLifecycleGate,
  postContextAction: { toolName: "mssr_librarian_jev_select", arguments: {} },
}), /refuses dynamic post-context actions/);

const candidate = {
  candidateRoot: "D:/candidate",
  bridgeVersion: "0.6.156",
  hashes: { bridgeConfig: "abc", mssrSelector: "def" },
};
assert.equal(assertCandidateIdentity(structuredClone(candidate), candidate), true);
for (const mutate of [
  (value) => { value.hashes.bridgeConfig = "changed"; },
  (value) => { value.bridgeVersion = "0.6.999"; },
  (value) => { value.candidateRoot = "D:/other"; },
]) {
  const changed = structuredClone(candidate);
  mutate(changed);
  assert.throws(() => assertCandidateIdentity(candidate, changed));
}

const inputBytes = Object.fromEntries([
  "cases.json",
  "corpus.json",
  "control-support-inventory.json",
  "source-inventory.json",
  "staged-project-identity.json",
].map((name) => [name, Buffer.from(`fixture:${name}`)]));
const expectedInputHashes = Object.fromEntries(Object.entries(inputBytes).map(([name, bytes]) => [name, sha256(bytes)]));
assert.equal(assertPinnedInputHashes(inputBytes, expectedInputHashes), true);
for (const name of Object.keys(inputBytes)) {
  const changed = { ...inputBytes, [name]: Buffer.from(`${inputBytes[name].toString("utf8")}:changed`) };
  assert.throws(() => assertPinnedInputHashes(changed, expectedInputHashes), new RegExp(name.replaceAll(".", "\\.")));
}

assert.deepEqual(observeSelectionProviderCalls({ jevCallMade: false, providerCalls: 0 }), {
  status: "known",
  providerCalls: 0,
});
assert.deepEqual(observeSelectionProviderCalls({ jevCallMade: true, providerCalls: 2 }), {
  status: "known",
  providerCalls: 2,
});
assert.deepEqual(observeSelectionProviderCalls({ jevCallMade: true }), {
  status: "unknown",
  providerCalls: null,
});
assert.deepEqual(summarizeProviderCalls(2, true), {
  providerCallCountStatus: "unknown",
  providerCallCount: null,
  providerCalls: null,
  providerCallsReported: 2,
});

const manifestBytes = Buffer.from('{"runId":"fixture"}\n');
const recordsBytes = Buffer.from('{"caseId":"01:en","status":"complete"}\n');
const summaryBytes = Buffer.from('{"status":"partial-exploratory"}\n');
const completion = buildRunCompletionReceipt({
  runId: "fixture-run",
  status: "partial-exploratory",
  manifestBytes,
  recordsBytes,
  summaryBytes,
  requestCounts: { expected: 10, attempted: 3, completed: 2, failed: 1, excluded: 1 },
  providerCallsReported: 2,
  hasAmbiguousSelectionFailure: true,
  finishedAt: "2026-10-04T00:00:00.000Z",
});
assert.equal(completion.manifestSha256, sha256(manifestBytes));
assert.equal(completion.recordsSha256, sha256(recordsBytes));
assert.equal(completion.summarySha256, sha256(summaryBytes));
assert.deepEqual(completion.requestCounts, {
  expected: 10,
  attempted: 3,
  completed: 2,
  failed: 1,
  excluded: 1,
  notStarted: 7,
});
assert.equal(completion.providerCallCountStatus, "unknown");
assert.equal(completion.providerCallCount, null);
assert.equal(completion.providerCalls, null);
assert.equal(completion.providerCallsReported, 2);
assert.equal(completion.labelsExposedToProvider, false);

const validationManifestBytes = Buffer.from(JSON.stringify({
  schemaVersion: 1,
  runId: "validation-run",
  expectedRequests: 3,
  excludedRequests: 1,
  expectedRequestIds: ["01:en", "01:es", "02:en"],
  excludedRequestIds: ["excluded:en"],
  stagedProject: { queryCorpusSourceRefs: ["docs/a.md"] },
}));
const validationRecordsBytes = Buffer.from([
  JSON.stringify({ schemaVersion: 1, caseId: "01", language: "en", status: "complete", requestStartedAt: "2026-10-04T00:00:00.000Z", elapsedMs: 1, sourceRefs: ["docs/a.md"], queryFingerprint: "a".repeat(64), search: { candidates: [] }, selection: { status: "selected", jevCallMade: true } }),
  JSON.stringify({ schemaVersion: 1, caseId: "01", language: "es", status: "failed", requestStartedAt: "2026-10-04T00:00:00.000Z", elapsedMs: 1, failureClass: "timeout", failureStage: "selection", rawErrorPersisted: false }),
].join("\n") + "\n");
const validationSummary = {
  schemaVersion: 1,
  runId: "validation-run",
  status: "partial-exploratory",
  expectedRequests: 3,
  attemptedRequests: 2,
  completedRequests: 1,
  failedRequests: 1,
  excludedRequests: 1,
  providerCalls: 1,
  providerCallsReported: 1,
  providerCallCountStatus: "known",
};
const validationSummaryBytes = Buffer.from(JSON.stringify(validationSummary));
const validationCompletion = buildRunCompletionReceipt({
  runId: "validation-run",
  status: validationSummary.status,
  manifestBytes: validationManifestBytes,
  recordsBytes: validationRecordsBytes,
  summaryBytes: validationSummaryBytes,
  requestCounts: { expected: 3, attempted: 2, completed: 1, failed: 1, excluded: 1 },
  providerCallsReported: 1,
  finishedAt: "2026-10-04T00:00:00.000Z",
});
const validationCompletionBytes = Buffer.from(JSON.stringify(validationCompletion));
assert.deepEqual(validateCompletionArtifacts({
  manifestBytes: validationManifestBytes,
  recordsBytes: validationRecordsBytes,
  summaryBytes: validationSummaryBytes,
  completionBytes: validationCompletionBytes,
}), { expected: 3, attempted: 2, completed: 1, failed: 1, excluded: 1, notStarted: 1 });
const excludedRecordBytes = Buffer.from(`${validationRecordsBytes.toString("utf8")}${JSON.stringify({ schemaVersion: 1, caseId: "excluded", language: "en", status: "complete" })}\n`);
assert.throws(() => validateCompletionArtifacts({
  manifestBytes: validationManifestBytes,
  recordsBytes: excludedRecordBytes,
  summaryBytes: validationSummaryBytes,
  completionBytes: validationCompletionBytes,
}), /not in the frozen eligible set/);

const inventoryRoot = mkdtempSync(join(tmpdir(), "jev-sha256-inventory-"));
try {
  mkdirSync(join(inventoryRoot, "inputs"), { recursive: true });
  writeFileSync(join(inventoryRoot, "manifest.json"), manifestBytes);
  writeFileSync(join(inventoryRoot, "inputs", "cases.json"), Buffer.from("frozen cases"));
  const inventory = writeSha256Inventory(inventoryRoot);
  assert.equal(inventory.files, 2);
  assert.deepEqual(verifySha256Inventory(inventoryRoot), { files: 2 });
  writeFileSync(join(inventoryRoot, "inputs", "cases.json"), Buffer.from("mutated cases"));
  assert.throws(() => verifySha256Inventory(inventoryRoot), /hash differs/);
} finally {
  rmSync(inventoryRoot, { recursive: true, force: true });
}

const gated = buildRunCompletionReceipt({
  runId: "gated-run",
  status: "provider-phase-not-started",
  manifestBytes,
  summaryBytes,
  requestCounts: { expected: 10, attempted: 0, completed: 0, failed: 0, excluded: 1 },
  providerCallsReported: 0,
  hasAmbiguousSelectionFailure: false,
  finishedAt: "2026-10-04T00:00:00.000Z",
});
assert.equal(gated.providerCallCountStatus, "known");
assert.equal(gated.providerCallCount, 0);
assert.equal(gated.recordsSha256, null);

for (const stage of ["mcp-connect", "mcp-catalog"]) {
  const runRoot = mkdtempSync(join(tmpdir(), "jev-" + stage + "-"));
  try {
    const expectedRequestIds = ["A:en", "A:es", "B:en", "B:es"];
    writeFileSync(join(runRoot, "manifest.json"), JSON.stringify({
      schemaVersion: 1,
      runId: stage + "-fixture",
      expectedRequests: expectedRequestIds.length,
      excludedRequests: 0,
      expectedRequestIds,
      excludedRequestIds: [],
    }));
    const finalized = finalizeFatalRun({
      runRoot,
      runId: stage + "-fixture",
      stage,
      error: new Error("provider secret body must not be persisted"),
      expectedRequests: 4,
      attemptedRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      excludedRequests: 0,
      providerCallsReported: 7,
      finishedAt: "2026-10-04T00:00:00.000Z",
    });
    assert.equal(finalized.written, true);
    assert.equal(finalized.completion.providerCallCountStatus, "known");
    assert.equal(finalized.completion.providerCallCount, 0);
    assert.equal(finalized.completion.requestCounts.notStarted, 4);
    assert.equal(finalized.completion.bootstrapFailure.failureMessage.includes("provider secret body"), false);
    const before = readFileSync(join(runRoot, "run-completion.json"));
    assert.equal(finalizeFatalRun({ runRoot, runId: "duplicate", stage, error: new Error("x") }).written, false);
    assert.deepEqual(readFileSync(join(runRoot, "run-completion.json")), before);
    const serialized = ["summary.json", "bootstrap-failure.json", "run-completion.json"]
      .map((name) => readFileSync(join(runRoot, name), "utf8")).join("\n");
    assert.equal(serialized.includes("provider secret body"), false);
    assert.deepEqual(verifySha256Inventory(runRoot), { files: 4 });
  } finally {
    rmSync(runRoot, { recursive: true, force: true });
  }
}

const fatalProviderRun = mkdtempSync(join(tmpdir(), "jev-provider-fatal-"));
try {
  const expectedRequestIds = ["01:en", "01:es", "02:en", "02:es", "03:en", "03:es", "04:en", "04:es", "05:en", "05:es"];
  const fatalRecordsBytes = Buffer.from([
    JSON.stringify({ schemaVersion: 1, caseId: "01", language: "en", status: "complete", requestStartedAt: "2026-10-04T00:00:00.000Z", elapsedMs: 1, sourceRefs: ["docs/a.md"], queryFingerprint: "a".repeat(64), search: { candidates: [] }, selection: { status: "selected", jevCallMade: true } }),
    JSON.stringify({ schemaVersion: 1, caseId: "01", language: "es", status: "complete", requestStartedAt: "2026-10-04T00:00:00.000Z", elapsedMs: 1, sourceRefs: ["docs/a.md"], queryFingerprint: "b".repeat(64), search: { candidates: [] }, selection: { status: "selected", jevCallMade: true } }),
    JSON.stringify({ schemaVersion: 1, caseId: "02", language: "en", status: "failed", requestStartedAt: "2026-10-04T00:00:00.000Z", elapsedMs: 1, failureClass: "timeout", failureStage: "selection", rawErrorPersisted: false }),
  ].join("\n") + "\n");
  writeFileSync(join(fatalProviderRun, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    runId: "provider-fatal-fixture",
    expectedRequests: expectedRequestIds.length,
    excludedRequests: 1,
    expectedRequestIds,
    excludedRequestIds: ["excluded:en"],
    stagedProject: { queryCorpusSourceRefs: ["docs/a.md"] },
  }));
  writeFileSync(join(fatalProviderRun, "records.jsonl"), fatalRecordsBytes);
  const finalized = finalizeFatalRun({
    runRoot: fatalProviderRun,
    runId: "provider-fatal-fixture",
    stage: "provider",
    error: new Error("ambiguous provider response body"),
    expectedRequests: 10,
    attemptedRequests: 3,
    completedRequests: 2,
    failedRequests: 1,
    excludedRequests: 1,
    providerCallsReported: 2,
    selectionRequestsAttempted: 3,
    selectionResponsesObserved: 2,
    hasAmbiguousSelectionFailure: true,
    finishedAt: "2026-10-04T00:00:00.000Z",
  });
  assert.equal(finalized.completion.providerCallCountStatus, "unknown");
  assert.equal(finalized.completion.providerCallCount, null);
  assert.equal(finalized.completion.providerCallsReported, 2);
  assert.deepEqual(finalized.completion.requestCounts, {
    expected: 10, attempted: 3, completed: 2, failed: 1, excluded: 1, notStarted: 7,
  });
  assert.equal(readFileSync(join(fatalProviderRun, "summary.json"), "utf8").includes("ambiguous provider response body"), false);
  assert.deepEqual(verifySha256Inventory(fatalProviderRun), { files: 4 });
} finally {
  rmSync(fatalProviderRun, { recursive: true, force: true });
}

console.log("PASS runner contracts: exact approval, fail-closed lifecycle, pinned identities, and completion receipts");
