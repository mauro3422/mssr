import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";
import { projectMssrProjectContextLibrarianMetadata } from "../dist/project-context-librarian.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mssrRoot = path.join(projectRoot, ".mssr");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), "utf8"));
const readOptionalJson = async (relativePath) => {
  try { return JSON.parse(await fs.readFile(path.join(projectRoot, relativePath), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
};
const projectContextManifestPath = ".mssr/project-context.json";
const librarianManifestPath = ".mssr/project-context-librarian.json";
const projectContextManifestBytes = await fs.readFile(path.join(projectRoot, projectContextManifestPath));
const librarianManifestBytes = await fs.readFile(path.join(projectRoot, librarianManifestPath));
const projectContextManifest = JSON.parse(projectContextManifestBytes.toString("utf8"));
const librarianManifest = JSON.parse(librarianManifestBytes.toString("utf8"));
const segmentsPath = ".mssr/project-context-segments.json";
const referencesPath = ".mssr/project-context-refs.json";
const segmentsManifest = await readOptionalJson(segmentsPath);
const referencesManifest = await readOptionalJson(referencesPath);
const sourceFiles = [];
const sourceHashes = {};
let totalSourceBytes = 0;
for (const sourcePath of [...new Set(librarianManifest.entries.map((entry) => entry.sourcePath))]) {
  const bytes = await fs.readFile(path.resolve(projectRoot, sourcePath));
  totalSourceBytes += bytes.byteLength;
  assert.ok(bytes.byteLength <= 2_000_000, `${sourcePath} exceeds the per-source smoke cap`);
  assert.ok(totalSourceBytes <= 4_000_000, "real-document smoke exceeds its aggregate source cap");
  sourceHashes[sourcePath] = hash(bytes);
  sourceFiles.push({ path: sourcePath, markdown: bytes.toString("utf8") });
}

const owner = projectRoot;
const projection = projectMssrProjectContextLibrarianMetadata({
  projectContextManifest,
  librarianManifest,
  segmentsManifest,
  referencesManifest,
  sourceFiles,
  owner,
  projectKey: path.basename(projectRoot),
});
assert.equal(projection.omitted, 0, "every current repository sidecar binding must project or this smoke fails");
assert.equal(projection.projected, librarianManifest.entries.length);

const documents = sourceFiles.map((source) => ({
  owner,
  sourceRef: source.path,
  markdown: source.markdown,
  records: projection.records.filter((record) => record.sourceRef === source.path),
  evidenceAtoms: projection.evidenceAtoms.filter((atom) => atom.source.ref === source.path),
  privacyClass: "project-metadata",
}));
const fieldNames = { domains: "domain", actions: "action", artifacts: "artifact", needs: "need", signals: "signal" };
const results = [];
for (const entry of librarianManifest.entries) {
  const projected = projection.items.find((item) => item.entryId === entry.entryId && item.status === "projected"
    && JSON.stringify(item.headingPath) === JSON.stringify(entry.headingPath));
  assert.ok(projected, `missing exact projected heading for ${entry.entryId}`);
  const selectorField = Object.keys(entry.selectors).find((field) => entry.selectors[field].length > 0);
  assert.ok(selectorField, `missing retrieval selector for ${entry.entryId}`);
  const selectorValue = entry.selectors[selectorField][0];
  const search = searchMssrLibrarianEvidence({
    documents,
    query: { query: selectorValue, metadata: { [fieldNames[selectorField]]: selectorValue }, maxResults: 20 },
  });
  const found = search.results.find((result) => result.handle.sourceRef === entry.sourcePath && result.handle.rangeId === projected.rangeId);
  assert.ok(found, `metadata search did not return exact declared range for ${entry.entryId}`);
  assert.ok(found.metadataProjectionMatches?.some((match) => match.matches.some((item) => item.field === fieldNames[selectorField] && item.value === selectorValue)));
  assert.equal(found.exactFetchable, true, `declared range ${entry.entryId} must fit exact-fetch cap`);
  const source = sourceFiles.find((item) => item.path === entry.sourcePath);
  const fetched = fetchMssrLibrarianEvidence({
    handle: found.handle,
    owner,
    sourceRef: entry.sourcePath,
    markdown: source.markdown,
    privacyClass: "project-metadata",
  });
  assert.equal(fetched.fingerprint, entry.expectedFingerprint);
  results.push({
    entryId: entry.entryId,
    selectorField,
    selectorValue,
    sourcePath: entry.sourcePath,
    sourceSha256: sourceHashes[entry.sourcePath],
    revision: found.handle.revision,
    rangeId: found.handle.rangeId,
    handleId: found.handle.id,
    fingerprint: fetched.fingerprint,
    exactFetchCodeUnits: fetched.text.length,
    metadataMatched: true,
    exactFetchPassed: true,
  });
}

const jevQuery = "Which MSSR section collects the 100 proposed Jev decision-system use cases?";
const jevSearch = searchMssrLibrarianEvidence({
  documents,
  query: { query: "agent-orchestration", metadata: { domain: "agent-orchestration" }, maxResults: 20 },
});
const jevRequest = {
  query: jevQuery,
  documents: documents.map(({ owner: documentOwner, sourceRef, markdown, privacyClass }) => ({
    owner: documentOwner,
    sourceRef,
    markdown,
    privacyClass,
  })),
  candidateHandles: jevSearch.results.map((item) => item.handle),
};
assert.ok(jevRequest.candidateHandles.length > 0, "metadata-filtered exact handles are required before the Jev smoke");
assert.ok(jevRequest.candidateHandles.every((handle) => handle.privacyClass === "project-metadata"));

const buildReceipt = await readJson("dist/.build-receipt.json");
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: projectRoot, encoding: "utf8" }).trim();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
const receipt = {
  schema: "mssr-project-context-librarian-real-doc-smoke-v1",
  createdAt: new Date().toISOString(),
  projectRoot,
  branch,
  commit,
  buildReceipt,
  inputs: {
    projectContextManifest: { path: projectContextManifestPath, sha256: hash(projectContextManifestBytes) },
    librarianManifest: { path: librarianManifestPath, sha256: hash(librarianManifestBytes) },
    segments: { path: segmentsPath, observed: segmentsManifest !== null },
    references: { path: referencesPath, observed: referencesManifest !== null },
    sources: sourceHashes,
  },
  result: {
    declared: projection.declared,
    projected: projection.projected,
    omitted: projection.omitted,
    metadataSearches: results.length,
    exactFetchesPassed: results.filter((item) => item.exactFetchPassed).length,
    records: results,
  },
  claim: "Integration smoke only: proves current sidecar projection, metadata-to-exact-range retrieval, and exact fetch integrity. It is not relevance adjudication, a quality benchmark, confidence calibration, or Bridge runtime adoption.",
};
const runtimeDir = path.join(mssrRoot, "runtime");
await fs.mkdir(runtimeDir, { recursive: true });
const timestamp = receipt.createdAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const receiptPath = path.join(runtimeDir, `project-context-librarian-real-doc-smoke-${timestamp}.json`);
await fs.writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
const readback = JSON.parse(await fs.readFile(receiptPath, "utf8"));
assert.equal(readback.result.exactFetchesPassed, librarianManifest.entries.length);
if (process.argv.includes("--emit-jev-request")) {
  console.log(JSON.stringify({ receiptPath, jevRequest }, null, 2));
} else {
  console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
}
