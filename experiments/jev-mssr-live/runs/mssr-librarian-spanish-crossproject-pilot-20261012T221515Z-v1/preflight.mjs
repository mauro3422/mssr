import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const parent = path.dirname(fileURLToPath(import.meta.url));
const cohortId = path.basename(parent);
const bridgeRoot = "D:\\Dev\\bridge-mcp-mssr-0.2.112-query-variants";
const projects = ["llm-rig", "ternary", "codecraft", "mannequin-animation-lab"];
const outputs = [];
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = async (p) => sha(await fs.readFile(p));
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();

for (const projectId of projects) {
  const runDir = path.join(parent, "projects", projectId);
  const manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8"));
  const cases = JSON.parse(await fs.readFile(path.join(runDir, "inputs/cases.json"), "utf8")).cases;
  const labels = JSON.parse(await fs.readFile(path.join(runDir, "inputs/labels.json"), "utf8"));
  const instrument = manifest.instrument;
  assert.equal(manifest.status, "prepared");
  assert.equal(cases.length, manifest.plan.expectedRequestCount);
  assert.equal(await hashFile(path.join(runDir, instrument.runnerPath)), instrument.runnerSha256);
  assert.equal(await hashFile(path.join(runDir, instrument.runnerSupportPath)), instrument.runnerSupportSha256);
  assert.equal(await hashFile(path.join(runDir, instrument.selectionRecordPath)), instrument.selectionRecordSha256);
  assert.equal(await hashFile(path.join(runDir, instrument.casesPath)), instrument.casesSha256);
  assert.equal(await hashFile(path.join(runDir, instrument.labelFile)), instrument.labelFileSha256);

  const supportUrl = pathToFileURL(path.join(runDir, instrument.runnerSupportPath)).href;
  const support = await import(supportUrl);
  support.validateRunInputs(cases, labels, manifest.corpus.sources.map((source) => source.sourceRef));
  const frozenSourceTextByRef = new Map();
  for (const source of manifest.corpus.sources) {
    const snapshot = path.join(runDir, source.snapshotPath);
    const actual = path.join(source.projectRoot, ...source.sourceRef.split("/"));
    assert.equal(await hashFile(snapshot), source.sha256, `${projectId}: snapshot hash mismatch`);
    assert.equal(await hashFile(actual), source.sha256, `${projectId}: live source differs from frozen hash`);
    assert.equal(git(source.projectRoot, "rev-parse", "HEAD"), source.gitHead, `${projectId}: source HEAD changed`);
    assert.equal(git(source.projectRoot, "branch", "--show-current"), source.branch, `${projectId}: source branch changed`);
    assert.equal(git(source.projectRoot, "status", "--porcelain=v1", "--", source.sourceRef), "", `${projectId}: target source became dirty`);
    frozenSourceTextByRef.set(source.sourceRef, (await fs.readFile(snapshot, "utf8")).replace(/\r\n?/gu, "\n"));
  }
  support.validateLabelHeadingPaths(cases, labels, frozenSourceTextByRef);
  const metadataConfig = support.resolveMetadataRunConfig(manifest, cases);
  assert.equal(metadataConfig.requiresProjectContextControls, false);
  const metadataControls = await support.validateProjectContextMetadataControls({ manifest, runDir, projectRoot: manifest.corpus.projectRoot, required: false });
  assert.deepEqual(metadataControls, []);
  for (const artifact of manifest.source.buildArtifacts) {
    assert.equal(await hashFile(path.join(bridgeRoot, ...artifact.path.split("/"))), artifact.sha256, `Bridge artifact changed: ${artifact.path}`);
  }
  for (const output of ["request-events.jsonl", "records.jsonl", "summary.json", "run-completion.json", "SHA256SUMS"]) {
    try { await fs.access(path.join(runDir, output)); throw new Error(`${projectId}: output already exists: ${output}`); }
    catch (e) { if (e?.code !== "ENOENT") throw e; }
  }
  outputs.push({
    projectId,
    runId: manifest.runId,
    caseCount: cases.length,
    sourceRef: manifest.corpus.sources[0].sourceRef,
    sourceSha256: manifest.corpus.sources[0].sha256,
    sourceHead: manifest.corpus.sources[0].gitHead,
    labelsParsedAndValidated: true,
    headingPathsValidated: true,
    metadataMode: "off",
    bridgeBuildArtifactsValidated: manifest.source.buildArtifacts.length,
    networkRequests: 0,
  });
}
const report = { schemaVersion: 1, cohortId, createdAt: new Date().toISOString(), status: "passed", networkRequests: 0, projects: outputs };
const reportPath = path.join(parent, "preflight-report.json");
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
const cohortPath = path.join(parent, "cohort.json");
const cohort = JSON.parse(await fs.readFile(cohortPath, "utf8"));
cohort.status = "preflight-passed";
cohort.preflight = {
  scriptPath: "preflight.mjs",
  scriptSha256: await hashFile(fileURLToPath(import.meta.url)),
  reportPath: "preflight-report.json",
  reportSha256: await hashFile(reportPath),
  networkRequests: 0,
};
await fs.writeFile(cohortPath, JSON.stringify(cohort, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
