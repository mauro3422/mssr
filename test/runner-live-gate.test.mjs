import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

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

console.log("PASS live mode refuses to start without --pause-after-bootstrap and creates no run outputs");
