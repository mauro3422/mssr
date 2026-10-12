import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const runDir = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(runDir, "manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = async (filePath) => hash(await fs.readFile(filePath));
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
assert.equal(manifest.status, "prepared");
assert.equal(manifest.provider.mode, "live");
assert.equal(manifest.provider.networkOptIn, true);
assert.equal(manifest.projectContextPreflight.healthLevel, "ok");
assert.equal(manifest.projectContextPreflight.manifestStatus, "valid");

const source = manifest.corpus.sources[0];
const contextPath = path.join(source.projectRoot, ".mssr", "project-context.json");
assert.equal(await hashFile(contextPath), manifest.projectContextPreflight.sha256, "canonical MSSR manifest changed");
const context = JSON.parse(await fs.readFile(contextPath, "utf8"));
assert.ok(context && typeof context === "object", "canonical MSSR manifest is unreadable");
assert.equal(await hashFile(path.join(runDir, source.snapshotPath)), source.sha256, "frozen source snapshot changed");
const liveSourcePath = path.join(source.projectRoot, ...source.sourceRef.split("/"));
assert.equal(await hashFile(liveSourcePath), source.sha256, "live source differs from frozen snapshot");
assert.equal(git(source.projectRoot, "rev-parse", "HEAD"), source.gitHead, "source HEAD changed");
assert.equal(git(source.projectRoot, "branch", "--show-current"), source.branch, "source branch changed");
assert.equal(git(source.projectRoot, "status", "--porcelain=v1", "--", source.sourceRef), "", "target source is dirty");

for (const artifact of manifest.source.buildArtifacts) {
  assert.equal(await hashFile(path.join(manifest.source.bridgeRoot, ...artifact.path.split("/"))), artifact.sha256, "Bridge artifact changed: " + artifact.path);
}
const support = await import(new URL(manifest.instrument.runnerSupportPath, "file://" + runDir.replaceAll("\\", "/") + "/").href);
const cases = JSON.parse(await fs.readFile(path.join(runDir, manifest.instrument.casesPath), "utf8")).cases;
const labels = JSON.parse(await fs.readFile(path.join(runDir, manifest.instrument.labelFile), "utf8"));
assert.equal(await hashFile(path.join(runDir, manifest.instrument.runnerPath)), manifest.instrument.runnerSha256);
assert.equal(await hashFile(path.join(runDir, manifest.instrument.runnerSupportPath)), manifest.instrument.runnerSupportSha256);
assert.equal(await hashFile(path.join(runDir, manifest.instrument.selectionRecordPath)), manifest.instrument.selectionRecordSha256);
assert.equal(await hashFile(path.join(runDir, manifest.instrument.casesPath)), manifest.instrument.casesSha256);
assert.equal(await hashFile(path.join(runDir, manifest.instrument.labelFile)), manifest.instrument.labelFileSha256);
support.validateRunInputs(cases, labels, manifest.corpus.sources.map((item) => item.sourceRef));
const frozenText = new Map([[source.sourceRef, (await fs.readFile(path.join(runDir, source.snapshotPath), "utf8")).replace(/\r\n?/gu, "\n")]]);
support.validateLabelHeadingPaths(cases, labels, frozenText);

for (const output of ["request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json", "SHA256SUMS"]) {
  try {
    await fs.access(path.join(runDir, output));
    throw new Error("Output already exists: " + output);
  } catch (error) {
    if (error && error.code !== "ENOENT") throw error;
  }
}

const report = {
  schemaVersion: 1,
  runId: manifest.runId,
  status: "passed",
  createdAt: new Date().toISOString(),
  networkRequests: 0,
  canonicalProjectContext: { path: ".mssr/project-context.json", status: "valid", sha256: manifest.projectContextPreflight.sha256 },
  source: { sourceRef: source.sourceRef, sha256: source.sha256, gitHead: source.gitHead, branch: source.branch, targetFileClean: true },
  cases: cases.length,
  labelsParsedAndHeadingPathsValidated: true,
  bridgeBuildArtifactsValidated: manifest.source.buildArtifacts.length,
  metadataMode: "off"
};
const reportPath = path.join(runDir, "preflight-report.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
manifest.preflight = {
  scriptPath: "preflight.mjs",
  scriptSha256: await hashFile(fileURLToPath(import.meta.url)),
  reportPath: "preflight-report.json",
  reportSha256: await hashFile(reportPath),
  networkRequests: 0
};
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
