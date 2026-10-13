import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  fingerprintMssrPackageTree,
  fingerprintProjectContextManifestSchema,
} from "../experiments/jev-mssr-live/runner-support.mjs";

const bridgeRoot = process.argv[2];
assert.ok(typeof bridgeRoot === "string" && bridgeRoot.trim().length > 0,
  "Usage: node scripts/fingerprint-jev-live-build.mjs <Bridge code root>");

const packageTree = await fingerprintMssrPackageTree({ bridgeRoot });
const projectContextSchema = await fingerprintProjectContextManifestSchema();
const hashFile = async (filePath) => createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
const bridgeArtifacts = [];
for (const file of ["dist/tool-registry.js", "dist/tools/mssr-semantic-evidence-tools.js"]) {
  const fullPath = path.join(bridgeRoot, ...file.split("/"));
  bridgeArtifacts.push({ path: file, sha256: await hashFile(fullPath) });
}

console.log(JSON.stringify({
  source: {
    mssrVersion: packageTree.version,
    mssrPackagePath: packageTree.path,
    mssrPackageTreeSha256: packageTree.sha256,
    buildArtifacts: bridgeArtifacts,
  },
  instrument: {
    projectContextManifestSchemaSha256: projectContextSchema.sha256,
  },
  measured: {
    mssrPackageFileCount: packageTree.fileCount,
    projectContextManifestSchemaSha256: projectContextSchema.sha256,
  },
}, null, 2));
