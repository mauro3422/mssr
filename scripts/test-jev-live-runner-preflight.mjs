import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertFrozenProjectContextManifest,
  fingerprintMssrPackageTree,
  fingerprintProjectContextManifestSchema,
  validateMssrPackageTreeFreeze,
  validateProjectContextManifestPreflight,
} from "../experiments/jev-mssr-live/runner-support.mjs";

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
  assert.equal(result.status, "canonical-schema-preflight-passed");
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.sha256, createHash("sha256").update(Buffer.from(validText, "utf8")).digest("hex"));
  const schemaFingerprint = await fingerprintProjectContextManifestSchema();
  assert.equal(result.schemaSha256, schemaFingerprint.sha256);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [{}], modules: [] }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /does not match its repository schema/u,
    "preflight must reject malformed nested entries before any run can begin");

  await writeManifest(JSON.stringify({
    schemaVersion: 1,
    core: [{ id: "same-id", kind: "state", description: "fixture", source: { path: "PROJECT_STATE.md" } }],
    modules: [{ id: "same-id", kind: "context", description: "fixture", source: { path: "PROJECT_CONTEXT.md" } }],
  }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /duplicate project-context id/u,
    "preflight must reject duplicate ids across core and module entries");

  await writeManifest(validText);
  const frozenHash = createHash("sha256").update(Buffer.from(validText, "utf8")).digest("hex");
  assert.equal(await assertFrozenProjectContextManifest({ projectRoot: root, sha256: frozenHash }), true);
  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [], modules: [{ id: "new-module", kind: "context", description: "fixture", source: { path: "PROJECT_CONTEXT.md" } }] }));
  await assert.rejects(assertFrozenProjectContextManifest({ projectRoot: root, sha256: frozenHash }), /changed during the Librarian run/u,
    "the frozen project context must be checked again at tool-call boundaries");

  const bridgeRoot = path.join(root, "bridge");
  const packageRoot = path.join(bridgeRoot, "node_modules", "@mauroprime", "mssr");
  await fs.mkdir(path.join(packageRoot, "dist"), { recursive: true });
  await fs.writeFile(path.join(packageRoot, "package.json"), JSON.stringify({ name: "@mauroprime/mssr", version: "0.2.130" }), "utf8");
  await fs.writeFile(path.join(packageRoot, "dist", "index.js"), "export const fixture = true;\n", "utf8");
  const packageFingerprint = await fingerprintMssrPackageTree({ bridgeRoot });
  assert.equal(packageFingerprint.version, "0.2.130");
  assert.equal(packageFingerprint.fileCount, 2);
  const packageFreeze = await validateMssrPackageTreeFreeze({
    bridgeRoot,
    source: {
      mssrVersion: "0.2.130",
      mssrPackagePath: packageFingerprint.path,
      mssrPackageTreeSha256: packageFingerprint.sha256,
    },
  });
  assert.equal(packageFreeze.sha256, packageFingerprint.sha256);
  await fs.writeFile(path.join(packageRoot, "dist", "index.js"), "export const fixture = false;\n", "utf8");
  await assert.rejects(validateMssrPackageTreeFreeze({
    bridgeRoot,
    source: {
      mssrVersion: "0.2.130",
      mssrPackagePath: packageFingerprint.path,
      mssrPackageTreeSha256: packageFingerprint.sha256,
    },
  }), /package tree changed since freeze/u, "a changed installed package must invalidate the frozen runner packet");

  await writeManifest("not-json");
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /valid JSON/u);

  await writeManifest(JSON.stringify({ schemaVersion: 2, core: [], modules: [] }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /does not match its repository schema/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: {}, modules: [] }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /does not match its repository schema/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [], modules: [], legacy: true }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /does not match its repository schema/u);

  await writeManifest(JSON.stringify({ schemaVersion: 1, core: [], modules: Array.from({ length: 97 }, () => ({})) }));
  await assert.rejects(validateProjectContextManifestPreflight({ projectRoot: root }), /does not match its repository schema/u);

  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const templateRoot = path.join(repositoryRoot, "experiments", "jev-mssr-live");
  const runnerTemplate = await fs.readFile(path.join(templateRoot, "runner-template.mjs"), "utf8");
  assert.equal((runnerTemplate.match(/registry\.call\(/gu) ?? []).length, 1,
    "all registry tool calls must pass through the frozen Project Context boundary wrapper");
  assert.equal((runnerTemplate.match(/callTool\("mssr_librarian_/gu) ?? []).length, 4,
    "search, selection, fetch, and evidence-pack calls must all use the guarded tool-call wrapper");
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
