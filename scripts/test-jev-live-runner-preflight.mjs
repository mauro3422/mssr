import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateProjectContextManifestPreflight } from "../experiments/jev-mssr-live/runner-support.mjs";

const root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-jev-runner-preflight-"));
const manifestPath = path.join(root, ".mssr", "project-context.json");
const writeManifest = async (text) => {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, text, "utf8");
};

try {
  await assert.rejects(
    validateProjectContextManifestPreflight({ projectRoot: root }),
    /Every Librarian run requires the canonical \.mssr\/project-context\.json/u,
    "metadataMode=off must not bypass project initialization",
  );

  const validText = JSON.stringify({ schemaVersion: 1, core: [], modules: [] });
  await writeManifest(validText);
  const result = await validateProjectContextManifestPreflight({ projectRoot: root });
  assert.equal(result.path, ".mssr/project-context.json");
  assert.equal(result.status, "structural-preflight-passed");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.sha256, createHash("sha256").update(Buffer.from(validText, "utf8")).digest("hex"));

  await writeManifest("not-json");
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /valid JSON/u);

  await writeManifest(JSON.stringify({ schemaVersion: 2, core: [], modules: [] }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /schemaVersion 1/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: {}, modules: [] }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /core must be an array/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [], modules: [], legacy: true }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /unsupported top-level fields/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [], modules: Array.from({ length: 97 }, () => ({})) }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /exceeds 96 entries/u);

  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const templateRoot = path.join(repositoryRoot, "experiments", "jev-mssr-live");
  const runDir = path.join(root, "run");
  const uninitializedProjectRoot = path.join(root, "uninitialized-project");
  await fs.mkdir(runDir, { recursive: true });
  await fs.mkdir(uninitializedProjectRoot, { recursive: true });
  for (const file of ["runner-template.mjs", "runner-support.mjs", "selection-record.mjs"]) {
    await fs.copyFile(path.join(templateRoot, file), path.join(runDir, file));
  }
  await fs.mkdir(path.join(runDir, "inputs"), { recursive: true });
  await fs.writeFile(path.join(runDir, "inputs", "cases.json"), JSON.stringify({ cases: [
    { id: "missing-context", sourceRef: "README.md", query: "Does not reach Jev." },
  ] }), "utf8");
  await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify({
    status: "prepared",
    corpus: { projectRoot: uninitializedProjectRoot, sources: [] },
    runtime: { metadataMode: "off" },
    plan: { expectedRequestCount: 1, independentUnit: "one project" },
    source: { bridgeRoot: path.join(root, "missing-bridge"), buildArtifacts: [] },
    provider: { requestedModel: "jev-1.13.0" },
    instrument: {},
  }), "utf8");

  for (const args of [[], ["--allow-network"]]) {
    const child = spawnSync(process.execPath, [path.join(runDir, "runner-template.mjs"), ...args], {
      cwd: runDir,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(child.status, 1, `runner should reject missing project initialization before calls (args: ${args.join(" ")})`);
    assert.match(child.stderr, /Every Librarian run requires the canonical \.mssr\/project-context\.json/u);
    await assert.rejects(fs.access(path.join(runDir, "request-events.jsonl")), { code: "ENOENT" });
    await assert.rejects(fs.access(path.join(runDir, "records.jsonl")), { code: "ENOENT" });
    await assert.rejects(fs.access(path.join(runDir, ".runner.lock")), { code: "ENOENT" });
  }

  console.log("Jev live runner Project Context preflight checks passed.");
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
