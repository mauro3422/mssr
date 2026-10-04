import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const START_JEV_TOKEN = "START_JEV";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function containsPath(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function resolveExternalRunRoot(repoRoot, requestedRunRoot) {
  assert.ok(typeof requestedRunRoot === "string" && requestedRunRoot.trim().length > 0,
    "An explicit --run-root outside the repository is required.");
  const canonicalRepoRoot = realpathSync(resolve(repoRoot));
  const requestedPath = resolve(requestedRunRoot);
  assert.ok(existsSync(requestedPath), `Run root does not exist: ${requestedPath}`);
  assert.ok(statSync(requestedPath).isDirectory(), `Run root is not a directory: ${requestedPath}`);
  const canonicalRunRoot = realpathSync(requestedPath);
  assert.ok(!containsPath(canonicalRepoRoot, canonicalRunRoot),
    "Run root must be outside the repository and all repository subdirectories.");
  assert.ok(!containsPath(canonicalRunRoot, canonicalRepoRoot),
    "Run root cannot be a parent of the repository.");
  const pathSegments = canonicalRunRoot.split(/[\\/]+/).filter(Boolean);
  assert.ok(!pathSegments.some((segment) => segment.toLowerCase() === "runs"),
    "Run root must be outside any runs/ tree.");
  return canonicalRunRoot;
}

export function assertStartJevApproval(line) {
  if (!isStartJevApproval(line)) {
    throw new Error("Live Jev gate is closed: exact START_JEV input is required.");
  }
  return true;
}

export function isStartJevApproval(line) {
  return line === START_JEV_TOKEN;
}

export function assertPreProviderLifecycleGate(lifecycleGate) {
  assert.equal(lifecycleGate?.contextChain, "complete", "MSSR context chain must complete before the provider gate.");
  assert.equal(lifecycleGate?.postContextAction ?? null, null,
    "Benchmark runner refuses dynamic post-context actions before the human provider gate.");
  assert.equal(lifecycleGate?.nextRequiredAction, "execute-active-phase-then-record-phase-and-replan",
    "Lifecycle gate requires an unsupported action before the human provider gate.");
  return lifecycleGate;
}

export function assertCandidateIdentity(preflightCandidate, candidate) {
  assert.deepEqual(preflightCandidate, candidate,
    "Preflight candidate identity or any pinned build hash differs from the current candidate.");
  return true;
}

export function assertPinnedInputHashes(inputBytes, expectedHashes) {
  for (const [name, expectedHash] of Object.entries(expectedHashes)) {
    const bytes = inputBytes[name];
    assert.ok(bytes !== undefined, `Pinned input is missing: ${name}`);
    assert.equal(sha256(bytes), expectedHash, `Frozen input bytes differ from the pinned hash: ${name}`);
  }
  return true;
}

export function summarizeProviderCalls(providerCallsReported, hasAmbiguousSelectionFailure) {
  assert.ok(Number.isSafeInteger(providerCallsReported) && providerCallsReported >= 0,
    "Reported provider calls must be a non-negative safe integer.");
  return {
    providerCallCountStatus: hasAmbiguousSelectionFailure ? "unknown" : "known",
    providerCallCount: hasAmbiguousSelectionFailure ? null : providerCallsReported,
    providerCalls: hasAmbiguousSelectionFailure ? null : providerCallsReported,
    providerCallsReported,
  };
}

export function observeSelectionProviderCalls(selection) {
  if (selection?.jevCallMade === false
    && (selection.providerCalls === undefined || selection.providerCalls === 0)) {
    return { status: "known", providerCalls: 0 };
  }
  if (selection?.jevCallMade === true
    && Number.isSafeInteger(selection.providerCalls)
    && selection.providerCalls > 0) {
    return { status: "known", providerCalls: selection.providerCalls };
  }
  return { status: "unknown", providerCalls: null };
}

export function buildRunCompletionReceipt({
  runId,
  status,
  manifestBytes,
  recordsBytes = null,
  summaryBytes,
  requestCounts,
  providerCallsReported = 0,
  hasAmbiguousSelectionFailure = false,
  traceId = null,
  labelsExposedToProvider = false,
  reason = null,
  bootstrapFailure = null,
  finishedAt = new Date().toISOString(),
}) {
  assert.equal(typeof runId, "string");
  assert.equal(typeof status, "string");
  assert.ok(Buffer.isBuffer(manifestBytes), "Exact manifest bytes are required.");
  assert.ok(Buffer.isBuffer(summaryBytes), "Exact summary bytes are required.");
  assert.ok(recordsBytes === null || Buffer.isBuffer(recordsBytes), "Records must be exact bytes or null when absent.");

  const counts = {
    expected: requestCounts.expected,
    attempted: requestCounts.attempted,
    completed: requestCounts.completed,
    failed: requestCounts.failed,
    excluded: requestCounts.excluded,
  };
  for (const [name, value] of Object.entries(counts)) {
    assert.ok(Number.isSafeInteger(value) && value >= 0, `Request count ${name} must be a non-negative integer.`);
  }
  assert.ok(counts.attempted <= counts.expected, "Attempted requests cannot exceed expected requests.");
  assert.equal(counts.completed + counts.failed, counts.attempted,
    "Every attempted request must have either a completed or failed record.");
  const providerCalls = summarizeProviderCalls(providerCallsReported, hasAmbiguousSelectionFailure);
  return {
    schemaVersion: 1,
    runId,
    status,
    manifestSha256: sha256(manifestBytes),
    requestCounts: {
      ...counts,
      notStarted: counts.expected - counts.attempted,
    },
    ...providerCalls,
    labelsExposedToProvider,
    ...(reason ? { reason } : {}),
    ...(bootstrapFailure ? { bootstrapFailure } : {}),
    traceId,
    finishedAt,
    recordsSha256: recordsBytes === null ? null : sha256(recordsBytes),
    summarySha256: sha256(summaryBytes),
  };
}

export function validateCompletionArtifacts({
  manifestBytes,
  recordsBytes = null,
  summaryBytes,
  completionBytes,
}) {
  assert.ok(Buffer.isBuffer(manifestBytes), "Exact manifest bytes are required.");
  assert.ok(recordsBytes === null || Buffer.isBuffer(recordsBytes), "Records must be exact bytes or null when absent.");
  assert.ok(Buffer.isBuffer(summaryBytes), "Exact summary bytes are required.");
  assert.ok(Buffer.isBuffer(completionBytes), "Exact completion receipt bytes are required.");

  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  const summary = JSON.parse(summaryBytes.toString("utf8"));
  const completion = JSON.parse(completionBytes.toString("utf8"));
  assert.equal(manifest.schemaVersion, 1, "Manifest schema version is unsupported.");
  assert.equal(summary.schemaVersion, 1, "Summary schema version is unsupported.");
  assert.equal(completion.schemaVersion, 1, "Run-completion schema version is unsupported.");
  assert.equal(summary.runId, manifest.runId, "Summary run ID differs from the frozen manifest.");
  assert.equal(completion.runId, manifest.runId, "Completion run ID differs from the frozen manifest.");
  const expectedRequestIds = manifest.expectedRequestIds;
  const excludedRequestIds = manifest.excludedRequestIds;
  const frozenSourceRefs = manifest.stagedProject?.queryCorpusSourceRefs;
  assert.ok(Array.isArray(expectedRequestIds), "Manifest must freeze eligible request IDs.");
  assert.ok(Array.isArray(excludedRequestIds), "Manifest must freeze excluded request IDs.");
  assert.equal(new Set(expectedRequestIds).size, expectedRequestIds.length, "Manifest repeats eligible request IDs.");
  assert.equal(new Set(excludedRequestIds).size, excludedRequestIds.length, "Manifest repeats excluded request IDs.");
  assert.ok(expectedRequestIds.every((id) => typeof id === "string" && id.length > 0));
  assert.ok(excludedRequestIds.every((id) => typeof id === "string" && id.length > 0));
  const expectedIds = new Set(expectedRequestIds);
  for (const id of excludedRequestIds) assert.ok(!expectedIds.has(id), `Request is both eligible and excluded: ${id}`);

  const expected = expectedRequestIds.length;
  const excluded = excludedRequestIds.length;
  assert.equal(manifest.expectedRequests, expected, "Manifest eligible count differs from its frozen IDs.");
  assert.equal(manifest.excludedRequests, excluded, "Manifest exclusion count differs from its frozen IDs.");
  const recordsText = recordsBytes?.toString("utf8") ?? "";
  const lines = recordsText === "" ? [] : recordsText.split(/\r?\n/).filter((line) => line.length > 0);
  const seen = new Set();
  let failed = 0;
  for (let index = 0; index < lines.length; index += 1) {
    let record;
    try { record = JSON.parse(lines[index]); } catch { throw new Error(`Run record ${index + 1} is not valid JSON.`); }
    assert.equal(record.schemaVersion, 1, `Run record ${index + 1} has an unsupported schema version.`);
    const requestId = `${record.caseId}:${record.language}`;
    assert.ok(expectedIds.has(requestId), `Run record ${index + 1} is not in the frozen eligible set: ${requestId}`);
    assert.ok(!excludedRequestIds.includes(requestId), `Excluded request was attempted: ${requestId}`);
    assert.ok(!seen.has(requestId), `Duplicate request record: ${requestId}`);
    seen.add(requestId);
    assert.ok(["complete", "selector-not-run", "failed"].includes(record.status), `Unknown request status for ${requestId}.`);
    assert.ok(typeof record.requestStartedAt === "string" && Number.isFinite(Date.parse(record.requestStartedAt)),
      `Run record ${requestId} is missing a valid start timestamp.`);
    assert.ok(Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0, `Run record ${requestId} has invalid latency.`);
    if (record.status === "failed") {
      assert.ok(typeof record.failureClass === "string" && typeof record.failureStage === "string",
        `Failed run record ${requestId} is missing its classified failure.`);
      assert.equal(record.rawErrorPersisted, false, `Run record ${requestId} must not persist raw error content.`);
      failed += 1;
    } else {
      assert.ok(Array.isArray(record.sourceRefs) && record.sourceRefs.every((ref) => typeof ref === "string"),
        `Run record ${requestId} is missing its exact source refs.`);
      if (Array.isArray(frozenSourceRefs)) assert.deepEqual(record.sourceRefs, frozenSourceRefs,
        `Run record ${requestId} source refs differ from the frozen manifest.`);
      assert.ok(typeof record.queryFingerprint === "string" && /^[a-f0-9]{64}$/.test(record.queryFingerprint),
        `Run record ${requestId} is missing its query fingerprint.`);
      assert.ok(record.search && Array.isArray(record.search.candidates), `Run record ${requestId} has no search result shape.`);
      assert.ok(record.selection && typeof record.selection.status === "string"
        && typeof record.selection.jevCallMade === "boolean", `Run record ${requestId} has no selection result shape.`);
      assert.equal(record.status === "complete", record.selection.jevCallMade,
        `Run record ${requestId} status disagrees with whether Jev selection ran.`);
    }
  }
  const attempted = lines.length;
  const completed = attempted - failed;
  assert.equal(summary.expectedRequests, expected, "Summary eligible count differs from manifest.");
  assert.equal(summary.excludedRequests, excluded, "Summary excluded count differs from manifest.");
  assert.equal(summary.attemptedRequests, attempted, "Summary attempted count differs from records.");
  assert.equal(summary.completedRequests, completed, "Summary completed count differs from records.");
  assert.equal(summary.failedRequests, failed, "Summary failed count differs from records.");
  assert.equal(summary.completedRequests + summary.failedRequests, summary.attemptedRequests);
  assert.equal(summary.status, completion.status, "Summary and completion status disagree.");
  assert.equal(completion.manifestSha256, sha256(manifestBytes));
  assert.equal(completion.recordsSha256, recordsBytes === null ? null : sha256(recordsBytes));
  assert.equal(completion.summarySha256, sha256(summaryBytes));
  assert.deepEqual(completion.requestCounts, {
    expected,
    attempted,
    completed,
    failed,
    excluded,
    notStarted: expected - attempted,
  });
  assert.equal(summary.providerCallsReported, completion.providerCallsReported,
    "Summary and completion receipt provider-call lower bounds disagree.");
  assert.equal(summary.providerCallCountStatus, completion.providerCallCountStatus,
    "Summary and completion receipt provider-call status disagree.");
  assert.equal(summary.providerCalls, completion.providerCalls,
    "Summary and completion receipt provider-call totals disagree.");
  assert.equal(completion.labelsExposedToProvider, false, "This benchmark must not expose labels to the provider.");
  return { expected, attempted, completed, failed, excluded, notStarted: expected - attempted };
}

export function writeSha256Inventory(runRoot) {
  const canonicalRoot = realpathSync(resolve(runRoot));
  const files = [];
  const visit = (directory) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = resolve(directory, entry.name);
      const info = lstatSync(absolute);
      assert.ok(!info.isSymbolicLink(), `Run artifact inventory refuses symbolic links: ${absolute}`);
      if (info.isDirectory()) visit(absolute);
      else {
        assert.ok(info.isFile(), `Run artifact inventory found a non-regular file: ${absolute}`);
        const path = relative(canonicalRoot, absolute).split(sep).join("/");
        if (path !== "SHA256SUMS") files.push({ path, sha256: sha256(readFileSync(absolute)) });
      }
    }
  };
  visit(canonicalRoot);
  files.sort((left, right) => left.path.localeCompare(right.path));
  const contents = files.map((item) => `${item.sha256}  ${item.path}`).join("\n") + "\n";
  const inventoryPath = resolve(canonicalRoot, "SHA256SUMS");
  writeFileSync(inventoryPath, contents, { flag: "wx" });
  return { path: inventoryPath, files: files.length, sha256: sha256(Buffer.from(contents, "utf8")) };
}

export function verifySha256Inventory(runRoot) {
  const canonicalRoot = realpathSync(resolve(runRoot));
  const inventoryPath = resolve(canonicalRoot, "SHA256SUMS");
  assert.ok(existsSync(inventoryPath), "Run artifact SHA256SUMS inventory is missing.");
  const listed = readFileSync(inventoryPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    assert.ok(match, `Invalid SHA256SUMS row: ${line}`);
    return { sha256: match[1], path: match[2] };
  });
  const actual = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const info = lstatSync(absolute);
      assert.ok(!info.isSymbolicLink(), `Run artifact inventory refuses symbolic links: ${absolute}`);
      if (info.isDirectory()) visit(absolute);
      else {
        assert.ok(info.isFile(), `Run artifact inventory found a non-regular file: ${absolute}`);
        const path = relative(canonicalRoot, absolute).split(sep).join("/");
        if (path !== "SHA256SUMS") actual.push(path);
      }
    }
  };
  visit(canonicalRoot);
  actual.sort((left, right) => left.localeCompare(right));
  assert.deepEqual(listed.map((item) => item.path).sort((left, right) => left.localeCompare(right)), actual,
    "SHA256SUMS does not inventory every run artifact exactly once.");
  for (const item of listed) {
    const artifactPath = resolve(canonicalRoot, item.path);
    assert.ok(containsPath(canonicalRoot, artifactPath), `SHA256SUMS path escapes the run root: ${item.path}`);
    assert.equal(sha256(readFileSync(artifactPath)), item.sha256, `Run artifact hash differs: ${item.path}`);
  }
  return { files: listed.length };
}

export function finalizeFatalRun({
  runRoot,
  runId,
  stage,
  error,
  expectedRequests,
  attemptedRequests,
  completedRequests,
  failedRequests,
  excludedRequests,
  providerCallsReported,
  selectionRequestsAttempted = 0,
  selectionResponsesObserved = 0,
  hasAmbiguousSelectionFailure = false,
  traceId = null,
  finishedAt = new Date().toISOString(),
}) {
  const completionPath = resolve(runRoot, "run-completion.json");
  if (existsSync(completionPath)) return { written: false, reason: "completion-already-exists" };

  const stageStatuses = {
    "mcp-connect": ["mcp-startup-failed", "MCP client connection failed before Jev selection started."],
    "mcp-catalog": ["mcp-catalog-failed", "MCP tool catalog validation failed before Jev selection started."],
    bootstrap: ["bootstrap-failed", "MSSR bootstrap failed before Jev selection started."],
    provider: ["partial-fatal", "The live run stopped unexpectedly; completed request records are preserved."],
  };
  const [status, failureMessage] = stageStatuses[stage] ?? ["live-run-failed", "The live run stopped unexpectedly before completion."];
  const effectiveProviderCallsReported = selectionRequestsAttempted === 0 ? 0 : providerCallsReported;
  const failureClass = stage === "provider" ? "provider-or-tool-error" : stage;
  const safeFailure = {
    schemaVersion: 1,
    status,
    failureClass,
    failureCode: `${stage}-fatal`.slice(0, 100),
    failureMessage,
    errorName: String(error?.name ?? "Error").replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) || "Error",
    providerCallsMade: selectionRequestsAttempted > 0,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    failedAt: finishedAt,
  };
  const summary = {
    schemaVersion: 1,
    runId,
    status,
    expectedRequests,
    attemptedRequests,
    completedRequests,
    failedRequests,
    excludedRequests,
    providerCallCountStatus: selectionRequestsAttempted === 0
      ? "known"
      : hasAmbiguousSelectionFailure || selectionResponsesObserved < selectionRequestsAttempted ? "unknown" : "known",
    providerCalls: selectionRequestsAttempted === 0 || (!hasAmbiguousSelectionFailure && selectionResponsesObserved === selectionRequestsAttempted)
      ? effectiveProviderCallsReported
      : null,
    providerCallsReported: effectiveProviderCallsReported,
    serverInfo: null,
    traceId,
    labelsRead: false,
    targetIndexRead: false,
    scoringPerformed: false,
    fatalFailure: safeFailure,
    finishedAt,
  };
  if (!existsSync(resolve(runRoot, "bootstrap-failure.json")) && stage !== "provider") {
    writeFileSync(resolve(runRoot, "bootstrap-failure.json"), `${JSON.stringify(safeFailure, null, 2)}\n`, { flag: "wx" });
  }
  if (!existsSync(resolve(runRoot, "summary.json"))) {
    writeFileSync(resolve(runRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  }
  const manifestBytes = readFileSync(resolve(runRoot, "manifest.json"));
  const recordsPath = resolve(runRoot, "records.jsonl");
  const summaryBytes = readFileSync(resolve(runRoot, "summary.json"));
  const recordsBytes = existsSync(recordsPath) ? readFileSync(recordsPath) : null;
  const completion = buildRunCompletionReceipt({
    runId,
    status,
    manifestBytes,
    recordsBytes,
    summaryBytes,
    requestCounts: {
      expected: expectedRequests,
      attempted: attemptedRequests,
      completed: completedRequests,
      failed: failedRequests,
      excluded: excludedRequests,
    },
    providerCallsReported: effectiveProviderCallsReported,
    hasAmbiguousSelectionFailure: selectionRequestsAttempted > 0
      && (hasAmbiguousSelectionFailure || selectionResponsesObserved < selectionRequestsAttempted),
    traceId,
    labelsExposedToProvider: false,
    reason: "fatal-run-finalizer",
    bootstrapFailure: stage === "provider" ? null : safeFailure,
    finishedAt,
  });
  writeFileSync(completionPath, `${JSON.stringify(completion, null, 2)}\n`, { flag: "wx" });
  const finalRecordsBytes = existsSync(recordsPath) ? readFileSync(recordsPath) : null;
  const finalSummaryBytes = readFileSync(resolve(runRoot, "summary.json"));
  const finalManifestBytes = readFileSync(resolve(runRoot, "manifest.json"));
  const completionBytes = readFileSync(completionPath);
  validateCompletionArtifacts({
    manifestBytes: finalManifestBytes,
    recordsBytes: finalRecordsBytes,
    summaryBytes: finalSummaryBytes,
    completionBytes,
  });
  const inventory = writeSha256Inventory(runRoot);
  verifySha256Inventory(runRoot);
  return { written: true, summary, completion, inventory };
}
