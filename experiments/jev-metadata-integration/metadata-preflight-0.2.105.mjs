import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SUITE_ROOT = path.dirname(SCRIPT_PATH);
const REPOSITORY_ROOT = path.resolve(SUITE_ROOT, "../..");
const PINS_PATH = path.join(SUITE_ROOT, "metadata-preflight-0.2.105-pins.json");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class MetadataPreflightError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "MetadataPreflightError";
    this.code = code;
  }
}

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
}

async function canonicalPotentialPath(inputPath) {
  let cursor = path.resolve(inputPath);
  const suffix = [];
  while (true) {
    try {
      // suffix is assembled parent-first with unshift(), so preserve that order.
      return path.resolve(await fs.realpath(cursor), ...suffix);
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new MetadataPreflightError("invalid-run-root", "Could not resolve output path.");
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function nearestExistingPath(inputPath) {
  let cursor = path.resolve(inputPath);
  while (true) {
    try {
      return { path: cursor, stat: await fs.stat(cursor) };
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) throw new MetadataPreflightError("invalid-run-root", "Could not find existing output-path ancestor.");
      cursor = parent;
    }
  }
}

export async function assertExternalRunRoot(runRoot, repositoryRoots) {
  if (typeof runRoot !== "string" || !path.isAbsolute(runRoot)) {
    throw new MetadataPreflightError("invalid-run-root", "Output root must be an absolute path.");
  }
  if (path.resolve(runRoot).split(/[\\/]+/).filter(Boolean).some((part) => part.toLowerCase() === "runs")) {
    throw new MetadataPreflightError("runs-path-forbidden", "Output root cannot be inside a directory named runs.");
  }
  const canonicalRoot = await canonicalPotentialPath(runRoot);
  if (canonicalRoot.split(/[\\/]+/).filter(Boolean).some((part) => part.toLowerCase() === "runs")) {
    throw new MetadataPreflightError("runs-path-forbidden", "Resolved output root cannot be inside a directory named runs.");
  }
  const canonicalRepos = [];
  for (const repositoryRoot of repositoryRoots) canonicalRepos.push(await fs.realpath(repositoryRoot));
  for (const repositoryRoot of canonicalRepos) {
    if (isWithin(repositoryRoot, canonicalRoot) || isWithin(canonicalRoot, repositoryRoot)) {
      throw new MetadataPreflightError("repository-path-forbidden", "Output root and repository roots must be disjoint.");
    }
  }
  const existing = await nearestExistingPath(canonicalRoot);
  if (!existing.stat.isDirectory()) throw new MetadataPreflightError("invalid-run-root", "Output path ancestor is not a directory.");
  let cursor = existing.path;
  while (true) {
    try {
      await fs.lstat(path.join(cursor, ".git"));
      throw new MetadataPreflightError("git-worktree-forbidden", "Output root is inside a Git worktree.");
    } catch (error) {
      if (error instanceof MetadataPreflightError) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  try {
    const stat = await fs.stat(canonicalRoot);
    if (!stat.isDirectory()) throw new MetadataPreflightError("invalid-run-root", "Output root exists and is not a directory.");
    if ((await fs.readdir(canonicalRoot)).length > 0) {
      throw new MetadataPreflightError("run-root-not-empty", "Output root contains files; choose a new run root.");
    }
  } catch (error) {
    if (error instanceof MetadataPreflightError) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
  return canonicalRoot;
}

export function assertPinnedInputMap(inputMap, expectedHashes) {
  for (const [relativePath, expectedHash] of Object.entries(expectedHashes)) {
    const bytes = inputMap.get(relativePath);
    if (!bytes) throw new MetadataPreflightError("pinned-input-missing", "Required pinned input is missing: " + relativePath);
    if (sha256(bytes) !== expectedHash) {
      throw new MetadataPreflightError("pinned-input-hash-mismatch", "Pinned input hash differs: " + relativePath);
    }
  }
  return true;
}

export function validateOptionalReferencesManifestPin(refs) {
  if (!refs || typeof refs.path !== "string" || typeof refs.present !== "boolean"
    || path.isAbsolute(refs.path) || refs.path.split(/[\\/]+/).some((part) => part === "" || part === "." || part === "..")) {
    throw new MetadataPreflightError("invalid-references-manifest-pin", "Optional references-manifest pin must use a safe repository-relative path.");
  }
  if (refs.present === true && !/^[a-f0-9]{64}$/i.test(refs.sha256 ?? "")) {
    throw new MetadataPreflightError("references-manifest-hash-required", "A present references manifest must have a pinned SHA-256.");
  }
  return true;
}

export function parseArgs(argv) {
  const args = { preflight: false, candidateRoot: null, runRoot: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--preflight") { args.preflight = true; continue; }
    if (key !== "--candidate-root" && key !== "--run-root") {
      throw new MetadataPreflightError("unsupported-flag", "Only offline --preflight is supported.");
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) throw new MetadataPreflightError("missing-argument-value", "Absolute path required after " + key + ".");
    i += 1;
    if (key === "--candidate-root") args.candidateRoot = value;
    else args.runRoot = value;
  }
  if (!args.preflight) throw new MetadataPreflightError("preflight-required", "This runner has no live mode.");
  if (!args.candidateRoot || !path.isAbsolute(args.candidateRoot)) throw new MetadataPreflightError("candidate-root-required", "--candidate-root must be absolute.");
  if (!args.runRoot || !path.isAbsolute(args.runRoot)) throw new MetadataPreflightError("run-root-required", "--run-root must be absolute.");
  return args;
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function readPinnedFiles(candidateRoot, pins) {
  const inputMap = new Map();
  for (const relativePath of Object.keys(pins.files)) {
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]+/).some((part) => part === ".." || part === "")) {
      throw new MetadataPreflightError("unsafe-pinned-path", "Pinned path is not repository-relative.");
    }
    const sourcePath = path.join(candidateRoot, ...relativePath.split(/[\\/]+/));
    const stat = await fs.lstat(sourcePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new MetadataPreflightError("pinned-input-not-regular-file", "Pinned input is not a regular file.");
    inputMap.set(relativePath.replaceAll("\\", "/"), await fs.readFile(sourcePath));
  }
  assertPinnedInputMap(inputMap, pins.files);
  const refs = pins.optionalReferencesManifest;
  validateOptionalReferencesManifestPin(refs);
  try {
    await fs.lstat(path.join(candidateRoot, ...refs.path.split("/")));
    if (refs.present === false) throw new MetadataPreflightError("unexpected-references-manifest", "Pinned optional references manifest must be absent.");
    const bytes = await fs.readFile(path.join(candidateRoot, ...refs.path.split("/")));
    if (refs.sha256 && sha256(bytes) !== refs.sha256) throw new MetadataPreflightError("references-manifest-hash-mismatch", "Optional references manifest hash differs.");
    inputMap.set(refs.path, bytes);
  } catch (error) {
    if (error instanceof MetadataPreflightError) throw error;
    if (error?.code !== "ENOENT") throw error;
    if (refs.present !== false) throw new MetadataPreflightError("references-manifest-missing", "Pinned references manifest is missing.");
  }
  return inputMap;
}

function distIdentity(distDir, expected) {
  const names = fsSync.readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name)
    .sort();
  if (!names.length) throw new MetadataPreflightError("build-empty", "Candidate dist has no JavaScript modules.");
  const hash = createHash("sha256");
  let bytes = 0;
  for (const name of names) {
    const data = fsSync.readFileSync(path.join(distDir, name));
    bytes += data.length;
    hash.update(name);
    hash.update(data);
  }
  const id = "mssr-build:sha256:" + hash.digest("hex").slice(0, 16);
  if (id !== expected.id || names.length !== expected.files || bytes !== expected.bytes) {
    throw new MetadataPreflightError("build-identity-mismatch", "Candidate dist bytes differ from pinned build identity.");
  }
  return { id, files: names.length, bytes };
}

async function copySnapshot(runRoot, inputMap, pinsBytes) {
  const snapshotRoot = path.join(runRoot, "inputs", "snapshot");
  const files = [];
  for (const [relativePath, bytes] of inputMap) {
    const normalized = relativePath.replaceAll("\\", "/");
    const destination = path.join(snapshotRoot, ...normalized.split("/"));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, bytes, { flag: "wx" });
    files.push({ path: "inputs/snapshot/" + normalized, sha256: sha256(bytes), bytes: bytes.byteLength });
  }
  const pinsPath = path.join(runRoot, "inputs", "metadata-preflight-pins.json");
  await fs.writeFile(pinsPath, pinsBytes, { flag: "wx" });
  files.push({ path: "inputs/metadata-preflight-pins.json", sha256: sha256(pinsBytes), bytes: pinsBytes.byteLength });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { snapshotRoot, files };
}

async function listFiles(root, relative = "") {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(root, child));
    else if (entry.isFile()) files.push(child);
    else throw new MetadataPreflightError("unexpected-output-entry", "Output contains an unexpected entry.");
  }
  return files;
}

async function writeJsonExclusive(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}

async function writeChecksums(runRoot) {
  const paths = (await listFiles(runRoot)).filter((item) => item !== "SHA256SUMS").sort();
  const rows = [];
  for (const relativePath of paths) {
    const bytes = await fs.readFile(path.join(runRoot, ...relativePath.split("/")));
    rows.push(sha256(bytes) + "  " + relativePath);
  }
  await fs.writeFile(path.join(runRoot, "SHA256SUMS"), rows.join("\n") + "\n", { flag: "wx" });
}

export async function verifySha256Sums(runRoot) {
  const rows = (await fs.readFile(path.join(runRoot, "SHA256SUMS"), "utf8")).split(/\r?\n/).filter(Boolean);
  const entries = new Map();
  for (const row of rows) {
    const match = row.match(/^([a-f0-9]{64})  (.+)$/i);
    if (!match || path.isAbsolute(match[2]) || match[2].split(/[\\/]+/).includes("..") || entries.has(match[2])) {
      throw new MetadataPreflightError("malformed-checksums", "SHA256SUMS has an invalid or duplicate row.");
    }
    entries.set(match[2], match[1].toLowerCase());
  }
  const files = (await listFiles(runRoot)).filter((item) => item !== "SHA256SUMS").sort();
  assert.deepEqual([...entries.keys()].sort(), files, "SHA256SUMS must cover every output file once.");
  for (const [relativePath, expected] of entries) {
    const bytes = await fs.readFile(path.join(runRoot, ...relativePath.split("/")));
    if (sha256(bytes) !== expected) throw new MetadataPreflightError("checksum-mismatch", "Output hash differs: " + relativePath);
  }
  return true;
}

async function runPreflight(candidateRootInput, runRootInput) {
  const candidateRoot = await fs.realpath(candidateRootInput);
  const pinsBytes = await fs.readFile(PINS_PATH);
  const pins = JSON.parse(pinsBytes.toString("utf8"));
  const archiveCommit = git(REPOSITORY_ROOT, "rev-parse", "HEAD");
  const archiveBranch = git(REPOSITORY_ROOT, "branch", "--show-current");
  if (git(REPOSITORY_ROOT, "status", "--porcelain", "--untracked-files=all") !== "") {
    throw new MetadataPreflightError("runner-tree-dirty", "Commit the preflight harness before producing a receipt.");
  }
  const rootTop = git(candidateRoot, "rev-parse", "--show-toplevel");
  if (path.resolve(rootTop).toLowerCase() !== candidateRoot.toLowerCase()) {
    throw new MetadataPreflightError("candidate-root-not-repository", "Candidate root must be the Git worktree root.");
  }
  const candidateCommit = git(candidateRoot, "rev-parse", "HEAD");
  const candidateBranch = git(candidateRoot, "branch", "--show-current");
  if (git(candidateRoot, "status", "--porcelain", "--untracked-files=all") !== "") {
    throw new MetadataPreflightError("candidate-tree-dirty", "Candidate worktree must be clean.");
  }
  if (candidateCommit !== pins.candidate.commit || candidateBranch !== pins.candidate.branch) {
    throw new MetadataPreflightError("candidate-identity-mismatch", "Candidate branch or commit differs from pins.");
  }
  const packageJson = JSON.parse(await fs.readFile(path.join(candidateRoot, "package.json"), "utf8"));
  if (packageJson.version !== pins.candidate.packageVersion) throw new MetadataPreflightError("package-version-mismatch", "Package version differs from pins.");
  const inputMap = await readPinnedFiles(candidateRoot, pins);
  const packageLock = JSON.parse(inputMap.get("package-lock.json").toString("utf8"));
  const lockedZodVersion = packageLock.packages?.["node_modules/zod"]?.version;
  const installedZod = JSON.parse(await fs.readFile(path.join(candidateRoot, "node_modules", "zod", "package.json"), "utf8"));
  if (!lockedZodVersion || installedZod.version !== lockedZodVersion) {
    throw new MetadataPreflightError("dependency-version-mismatch", "Installed zod version differs from package-lock.json.");
  }
  const distDir = path.join(candidateRoot, "dist");
  const build = distIdentity(distDir, pins.candidate.build);
  const buildReceipt = JSON.parse(await fs.readFile(path.join(distDir, ".build-receipt.json"), "utf8"));
  if (buildReceipt.id !== build.id || buildReceipt.version !== packageJson.version
    || buildReceipt.files !== build.files || buildReceipt.bytes !== build.bytes) {
    throw new MetadataPreflightError("build-receipt-mismatch", "Build receipt differs from recomputed dist bytes.");
  }
  const sidecar = JSON.parse(inputMap.get(".mssr/project-context-librarian.json").toString("utf8"));
  const pinnedSources = Object.keys(pins.files).filter((item) => item.endsWith(".md")).sort();
  assert.deepEqual([...new Set(sidecar.entries.map((entry) => entry.sourcePath))].sort(), pinnedSources);

  const runRoot = await assertExternalRunRoot(runRootInput, [candidateRoot, REPOSITORY_ROOT]);
  await fs.mkdir(runRoot, { recursive: true });
  const snapshot = await copySnapshot(runRoot, inputMap, pinsBytes);
  const readJson = async (...parts) => JSON.parse(await fs.readFile(path.join(snapshot.snapshotRoot, ...parts), "utf8"));
  const projectContextManifest = await readJson(".mssr", "project-context.json");
  const librarianManifest = await readJson(".mssr", "project-context-librarian.json");
  const segmentsManifest = await readJson(".mssr", "project-context-segments.json");
  const sourceFiles = [...new Set(librarianManifest.entries.map((entry) => entry.sourcePath))].map((sourcePath) => ({
    path: sourcePath,
    markdown: fsSync.readFileSync(path.join(snapshot.snapshotRoot, ...sourcePath.split("/")), "utf8"),
  }));
  assert.equal(sourceFiles.length, pins.expected.sourceFiles);

  const projectUrl = pathToFileURL(path.join(distDir, "project-context-librarian.js")).href;
  const retrievalUrl = pathToFileURL(path.join(distDir, "librarian-retrieval.js")).href;
  const { projectMssrProjectContextLibrarianMetadata } = await import(projectUrl);
  const { fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } = await import(retrievalUrl);
  const owner = "mssr@" + candidateCommit;
  const common = {
    projectContextManifest,
    librarianManifest,
    segmentsManifest,
    referencesManifest: null,
    sourceFiles,
    owner,
    projectKey: pins.candidate.projectKey,
  };
  const projection = projectMssrProjectContextLibrarianMetadata(common);
  assert.equal(projection.declared, pins.expected.declaredEntries);
  assert.equal(projection.projected, pins.expected.declaredEntries);
  assert.equal(projection.omitted, 0);

  let projectionRejectsOmittedSidecar = false;
  try {
    projectMssrProjectContextLibrarianMetadata({
    projectContextManifest,
    segmentsManifest,
    referencesManifest: null,
    sourceFiles,
    owner,
    projectKey: pins.candidate.projectKey,
    });
  } catch {
    projectionRejectsOmittedSidecar = true;
  }
  assert.equal(projectionRejectsOmittedSidecar, true);

  const staleSidecar = structuredClone(librarianManifest);
  staleSidecar.entries[0].expectedFingerprint = "0".repeat(64);
  const staleProjection = projectMssrProjectContextLibrarianMetadata({ ...common, librarianManifest: staleSidecar });
  const staleItem = staleProjection.items.find((item) => item.entryId === staleSidecar.entries[0].entryId);
  assert.equal(staleItem?.issue, "stale-fingerprint");
  assert.equal(staleProjection.records.some((record) => record.metadata.entryId === staleSidecar.entries[0].entryId), false);

  const fieldNames = { domains: "domain", actions: "action", artifacts: "artifact", needs: "need", signals: "signal" };
  const documents = sourceFiles.map((source) => ({
    owner, sourceRef: source.path, markdown: source.markdown,
    records: projection.records.filter((record) => record.sourceRef === source.path),
    evidenceAtoms: projection.evidenceAtoms.filter((atom) => atom.source.ref === source.path),
    privacyClass: "project-metadata",
  }));
  const noMetadataDocuments = sourceFiles.map((source) => ({
    owner, sourceRef: source.path, markdown: source.markdown,
    records: [], evidenceAtoms: [], privacyClass: "project-metadata",
  }));
  const records = [];
  let noMetadataExactTargetHits = 0;
  for (const entry of librarianManifest.entries) {
    const projected = projection.items.find((item) => item.entryId === entry.entryId && item.status === "projected"
      && JSON.stringify(item.headingPath) === JSON.stringify(entry.headingPath));
    assert.ok(projected);
    const selectorField = Object.keys(entry.selectors).find((field) => entry.selectors[field]?.length > 0);
    assert.ok(selectorField && fieldNames[selectorField]);
    const selectorValue = entry.selectors[selectorField][0];
    const fieldName = fieldNames[selectorField];
    const query = { query: selectorValue, metadata: { [fieldName]: selectorValue }, maxResults: 20 };
    const result = searchMssrLibrarianEvidence({ documents, query });
    const found = result.results.find((item) => item.handle.sourceRef === entry.sourcePath && item.handle.rangeId === projected.rangeId);
    assert.ok(found, "Metadata search did not return the exact declared range: " + entry.entryId);
    assert.ok(found.metadataProjectionMatches?.some((match) => match.matches.some((item) => item.field === fieldName && item.value === selectorValue)));
    const noMetadata = searchMssrLibrarianEvidence({ documents: noMetadataDocuments, query });
    if (noMetadata.results.some((item) => item.handle.sourceRef === entry.sourcePath && item.handle.rangeId === projected.rangeId)) {
      noMetadataExactTargetHits += 1;
    }
    const source = sourceFiles.find((item) => item.path === entry.sourcePath);
    const fetched = fetchMssrLibrarianEvidence({
      handle: found.handle, owner, sourceRef: entry.sourcePath, markdown: source.markdown, privacyClass: "project-metadata",
    });
    assert.equal(fetched.fingerprint, entry.expectedFingerprint);
    records.push({
      entryId: entry.entryId, selectorField, selectorValue, sourcePath: entry.sourcePath,
      sourceSha256: sha256(Buffer.from(source.markdown, "utf8")), revision: found.handle.revision,
      rangeId: found.handle.rangeId, handleId: found.handle.id, fingerprint: fetched.fingerprint,
      exactFetchCodeUnits: fetched.text.length, metadataMatched: true, exactFetchPassed: true,
    });
  }
  assert.equal(noMetadataExactTargetHits, 0, "Typed metadata filters must not match without atoms.");

  const scriptHash = sha256(await fs.readFile(SCRIPT_PATH));
  const pinsHash = sha256(pinsBytes);
  const receipt = {
    schema: "mssr-librarian-sidecar-preflight-v1",
    runId: path.basename(runRoot),
    createdAt: new Date().toISOString(),
    status: "preflight-passed-sidecar-verified-provider-gate-closed",
    mode: "offline-only",
    runtime: { node: process.version, platform: process.platform, architecture: process.arch, zodVersion: installedZod.version },
    networkAccess: false, providerCallsMade: false, jevCallsMade: false, mcpCallsMade: false,
    labelsRead: false, scoringPerformed: false,
    candidate: { branch: candidateBranch, commit: candidateCommit, packageVersion: packageJson.version,
      build, buildReceiptSha256: pins.files["dist/.build-receipt.json"] },
    harness: { branch: archiveBranch, commit: archiveCommit, scriptSha256: scriptHash, pinsSha256: pinsHash },
    inputs: {
      fileCount: inputMap.size + 1,
      projectContextManifestSha256: pins.files[".mssr/project-context.json"],
      librarianSidecarSha256: pins.files[".mssr/project-context-librarian.json"],
      segmentsManifestSha256: pins.files[".mssr/project-context-segments.json"],
      referencesManifestPresent: false,
      boundSourceFiles: pinnedSources.map((sourcePath) => ({ path: sourcePath, sha256: pins.files[sourcePath] })),
    },
    result: {
      declaredEntries: projection.declared, projectedEntries: projection.projected, omittedEntries: projection.omitted,
      metadataSearches: records.length, metadataExactTargetHitsWithoutAtoms: noMetadataExactTargetHits,
      exactFetchesPassed: records.filter((item) => item.exactFetchPassed).length,
      totalExactFetchCodeUnits: records.reduce((sum, item) => sum + item.exactFetchCodeUnits, 0),
      projectionRejectsOmittedSidecar,
      staleSidecarRejected: staleItem?.issue === "stale-fingerprint"
        && !staleProjection.records.some((record) => record.metadata.entryId === staleSidecar.entries[0].entryId),
      records,
    },
    interpretation: "Structural preflight only. Typed selector values are echoed from the sidecar. This is not natural-query relevance, ranking quality, Jev/Noul quality, confidence calibration, contradiction recall, synthesis quality, or Bridge runtime adoption.",
  };
  const manifest = {
    schema: "mssr-librarian-sidecar-preflight-inputs-v1",
    candidateCommit, buildId: build.id, pinsSha256: pinsHash, files: snapshot.files,
  };
  await writeJsonExclusive(path.join(runRoot, "manifest.json"), manifest);
  await writeJsonExclusive(path.join(runRoot, "preflight.json"), receipt);
  const readme = [
    "# MSSR Librarian sidecar offline preflight", "",
    "Status: " + receipt.status, "",
    "Offline structural gate over a frozen copy of the 0.2.105 project-context manifest, Librarian sidecar, segments manifest, and three bound Markdown sources.",
    "The runner recomputed the MSSR build identity, projected all declared entries, found each exact range using its echoed typed selector, confirmed filters return no exact target without atoms, and fetched each range with the expected fingerprint.", "",
    "No provider, Jev, or MCP calls were made. No labels were read and no quality score was computed. This does not measure natural-query relevance or calibrate confidence.", "",
    "Verify all files with the adjacent SHA256SUMS.", "",
  ].join("\n");
  await fs.writeFile(path.join(runRoot, "README.md"), readme, { flag: "wx" });
  await writeChecksums(runRoot);
  await verifySha256Sums(runRoot);
  const readback = JSON.parse(await fs.readFile(path.join(runRoot, "preflight.json"), "utf8"));
  assert.equal(readback.status, receipt.status);
  assert.equal(JSON.parse(await fs.readFile(path.join(runRoot, "manifest.json"), "utf8")).files.length, snapshot.files.length);
  return { runRoot, receipt };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runPreflight(args.candidateRoot, args.runRoot);
  process.stdout.write(JSON.stringify({ status: result.receipt.status, runRoot: result.runRoot, receipt: result.receipt }, null, 2) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    const code = error instanceof MetadataPreflightError ? error.code : "preflight-failed";
    process.stderr.write(JSON.stringify({ status: "preflight-failed", code, message: error.message }) + "\n");
    process.exitCode = 1;
  });
}
