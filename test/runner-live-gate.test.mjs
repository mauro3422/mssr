import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";

const runRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(runRoot, "runner.mjs");
const outputPaths = [
  "manifest.json",
  "records.jsonl",
  "summary.json",
  "bootstrap-receipt.json",
  "bootstrap-failure.json",
  "run-completion.json",
  "preflight.json",
  "SHA256SUMS",
];

assert.ok(outputPaths.every((relativePath) => !existsSync(path.join(runRoot, relativePath))),
  "The gate regression test needs a clean runner output directory.");

const child = spawnSync(process.execPath, [runnerPath, "--live"], {
  cwd: runRoot,
  encoding: "utf8",
  timeout: 5_000,
});

assert.equal(child.error, undefined, child.error?.message);
assert.notEqual(child.status, 0, "Live mode must refuse to start without its mandatory parent pause.");
assert.match(child.stderr, /--pause-after-bootstrap/);
assert.ok(outputPaths.every((relativePath) => !existsSync(path.join(runRoot, relativePath))),
  "The missing-pause guard must exit before creating run output or starting MCP/provider work.");

const wrongConfirmation = spawnSync(process.execPath, [runnerPath, "--live", "--pause-after-bootstrap", "--confirmation", "wrong"], {
  cwd: runRoot,
  encoding: "utf8",
  timeout: 5_000,
});

assert.equal(wrongConfirmation.error, undefined, wrongConfirmation.error?.message);
assert.notEqual(wrongConfirmation.status, 0, "Live mode must refuse an incorrect coordinator confirmation.");
assert.match(wrongConfirmation.stderr, /exact coordinator confirmation/);
assert.ok(outputPaths.every((relativePath) => !existsSync(path.join(runRoot, relativePath))),
  "An incorrect confirmation must exit before creating run output or starting MCP/provider work.");

const runnerSource = readFileSync(runnerPath, "utf8");
assert.match(runnerSource,
  /const fatal = finalizeFatalRun\([\s\S]*?process\.stderr\.write\([\s\S]*?\n    return;\n  \} finally \{/,
  "After writing a fatal receipt, runLive must return before normal summary/receipt writes; finally still closes MCP and cleans the environment.");
const completionWriterStart = runnerSource.indexOf("function writeRunCompletion(");
const completionWriterEnd = runnerSource.indexOf("\nasync function runLive(", completionWriterStart);
const completionWriter = completionWriterStart >= 0 && completionWriterEnd > completionWriterStart
  ? runnerSource.slice(completionWriterStart, completionWriterEnd)
  : null;
assert.ok(completionWriter, "The runner must keep one shared terminal-receipt writer.");
assert.match(completionWriter, /validateCompletionArtifacts\([\s\S]*?\)/,
  "Every ordinary terminal path must validate request records and receipt hashes before closing.");
assert.match(completionWriter, /writeSha256Inventory\(RUN_ROOT\)/,
  "Every ordinary terminal path must emit an artifact checksum inventory.");
assert.match(completionWriter, /verifySha256Inventory\(RUN_ROOT\)/,
  "The emitted artifact checksum inventory must be verified before exit.");
assert.match(runnerSource, /expectedRequestIds,[\s\S]*?excludedRequestIds,/,
  "The prepared manifest must freeze both eligible and excluded request IDs.");
assert.doesNotMatch(runnerSource, /succeededRequests/,
  "Summary fields must use completedRequests for successes and attemptedRequests for all terminal records.");

const missingRunRoot = spawnSync(process.execPath, [runnerPath, "--preflight"], {
  cwd: runRoot,
  encoding: "utf8",
  timeout: 5_000,
});
assert.notEqual(missingRunRoot.status, 0, "Preflight requires an explicit external run root.");
assert.match(missingRunRoot.stderr, /explicit --run-root/);

const repoRunRoot = spawnSync(process.execPath, [runnerPath, "--preflight", "--run-root", runRoot], {
  cwd: runRoot,
  encoding: "utf8",
  timeout: 5_000,
});
assert.notEqual(repoRunRoot.status, 0, "The repository cannot be used as its own run root.");
assert.match(repoRunRoot.stderr, /outside the repository/);

const externalRunRoot = mkdtempSync(path.join(tmpdir(), "jev-runner-root-test-"));
try {
  const externalPreflight = spawnSync(process.execPath, [runnerPath, "--preflight", "--run-root", externalRunRoot], {
    cwd: runRoot,
    encoding: "utf8",
    timeout: 5_000,
  });
  assert.notEqual(externalPreflight.status, 0, "An unstaged external run root must fail closed before preflight output.");
  assert.doesNotMatch(externalPreflight.stderr, /outside the repository/,
    "An existing external directory must pass root validation before frozen-input validation.");
  assert.ok(outputPaths.every((relativePath) => !existsSync(path.join(runRoot, relativePath))),
    "Preflight outputs must never be written into the repository root.");
  assert.ok(outputPaths.every((relativePath) => !existsSync(path.join(externalRunRoot, relativePath))),
    "Missing frozen inputs must fail before writing outputs into the external run root.");
} finally {
  rmSync(externalRunRoot, { recursive: true, force: true });
}

console.log("PASS live gate, fatal finalizer, and external run-root guards fail closed without provider startup");
