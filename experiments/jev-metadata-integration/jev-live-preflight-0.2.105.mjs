import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const expected = {
  commit: "0c1ca590d3dcf9a8ba721f6a2975c909e13972c2",
  version: "0.2.105",
  buildId: "mssr-build:sha256:58b3d5447d10b847",
  buildReceiptHash: "0cf8a3a83149509214766ace41f608934b2b0649eac083437d46e574a294dbd7",
  artifactRun: "jev-natural-query-diagnostic-20261004-0.2.105-v1",
  sidecarHash: "72fc7200a3e3360bee3fab6cab3ecfebbc24073a6222a554320bbdbdb6457928",
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const unquoteCode = (s) => s.charCodeAt(0) === 96 ? s.slice(1, -1) : s;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!["--artifact-root", "--runtime-root", "--run-root"].includes(key)) throw new Error("Unsupported argument: " + key);
    const value = argv[++i];
    if (!value || value.startsWith("--")) throw new Error("Missing argument value.");
    args[key.slice(2)] = path.resolve(value);
  }
  for (const key of ["artifact-root", "runtime-root", "run-root"]) if (!args[key]) throw new Error("Missing --" + key);
  return args;
}

async function verifySums(root) {
  const rows = (await fs.readFile(path.join(root, "SHA256SUMS"), "utf8")).split(/\r?\n/).filter(Boolean);
  let count = 0;
  for (const row of rows) {
    const match = row.match(/^([a-f0-9]{64})  (.+)$/i);
    assert.ok(match, "Malformed SHA256SUMS row.");
    const target = path.resolve(root, ...match[2].split(/[\\/]+/));
    assert.ok(target.startsWith(path.resolve(root) + path.sep), "Unsafe artifact path.");
    assert.equal(hash(await fs.readFile(target)), match[1].toLowerCase(), "Hash mismatch: " + match[2]);
    count += 1;
  }
  return count;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = args["artifact-root"];
  const runtimeRoot = args["runtime-root"];
  const runRoot = args["run-root"];
  assert.equal(path.basename(artifactRoot), expected.artifactRun, "Wrong frozen source artifact.");
  const receipt = JSON.parse(await fs.readFile(path.join(artifactRoot, "diagnostic.json"), "utf8"));
  assert.equal(receipt.candidate.commit, expected.commit);
  assert.equal(receipt.candidate.packageVersion, expected.version);
  assert.equal(receipt.candidate.build.id, expected.buildId);
  const sourceFilesVerified = await verifySums(artifactRoot);

  const pkg = JSON.parse(await fs.readFile(path.join(runtimeRoot, "package.json"), "utf8"));
  const buildBytes = await fs.readFile(path.join(runtimeRoot, "dist", ".build-receipt.json"));
  const build = JSON.parse(buildBytes.toString("utf8"));
  assert.equal(pkg.version, expected.version);
  assert.equal(build.id, expected.buildId);
  assert.equal(hash(buildBytes), expected.buildReceiptHash);
  const runtimeCommit = git(runtimeRoot, "rev-parse", "HEAD");
  assert.equal(git(runtimeRoot, "status", "--porcelain", "--untracked-files=all"), "", "Runtime checkout is dirty.");

  const snapshot = path.join(artifactRoot, "inputs", "snapshot");
  const bankPath = path.join(snapshot, "experiments", "jev-metadata-integration", "candidate-bank.md");
  const bank = await fs.readFile(bankPath, "utf8");
  const rows = bank.split(/\r?\n/).filter((line) => /^\| C\d+ \|/.test(line));
  const splitAnchor = (line) => {
    const cells = line.split("|").map((item) => item.trim());
    const anchor = unquoteCode(cells[2]);
    const split = anchor.lastIndexOf("#");
    assert.ok(split > 0, "Malformed source anchor.");
    const ref = anchor.slice(0, split);
    assert.ok(!path.isAbsolute(ref) && !ref.split(/[\\/]+/).includes(".."), "Unsafe source ref.");
    return { cells, ref, heading: anchor.slice(split + 1) };
  };
  const sourcePaths = [...new Set(rows.map((line) => splitAnchor(line).ref))].sort();
  assert.equal(sourcePaths.length, 27, "Candidate bank source count changed.");
  const c01Line = rows.find((line) => /^\| C01 \|/.test(line));
  assert.ok(c01Line, "C01 missing.");
  const c01 = splitAnchor(c01Line);
  const queries = [
    { caseId: "C01", language: "es", query: c01.cells[3] },
    { caseId: "C01", language: "en", query: c01.cells[4] },
  ];
  assert.ok(queries.every((item) => item.query.length > 0));

  const readJson = async (ref) => JSON.parse(await fs.readFile(path.join(snapshot, ...ref.split("/")), "utf8"));
  const projectContextManifest = await readJson(".mssr/project-context.json");
  const librarianManifest = await readJson(".mssr/project-context-librarian.json");
  const segmentsManifest = await readJson(".mssr/project-context-segments.json");
  assert.equal(hash(await fs.readFile(path.join(snapshot, ".mssr", "project-context-librarian.json"))), expected.sidecarHash);
  const sourceDocs = await Promise.all(sourcePaths.map(async (sourceRef) => ({
    sourceRef, markdown: await fs.readFile(path.join(snapshot, ...sourceRef.split("/")), "utf8"),
  })));
  const sidecarSources = [...new Set(librarianManifest.entries.map((entry) => entry.sourcePath))].sort().map((sourceRef) => {
    const doc = sourceDocs.find((item) => item.sourceRef === sourceRef);
    assert.ok(doc, "Sidecar source missing from corpus.");
    return { path: sourceRef, markdown: doc.markdown };
  });
  const owner = "mssr@" + expected.commit;
  const projector = await import(pathToFileURL(path.join(runtimeRoot, "dist", "project-context-librarian.js")).href);
  const retrieval = await import(pathToFileURL(path.join(runtimeRoot, "dist", "librarian-retrieval.js")).href);
  const projection = projector.projectMssrProjectContextLibrarianMetadata({
    projectContextManifest, librarianManifest, segmentsManifest, referencesManifest: null,
    sourceFiles: sidecarSources, owner, projectKey: "mssr",
  });
  assert.equal(projection.declared, 4);
  assert.equal(projection.projected, 4);
  assert.equal(projection.omitted, 0);
  const documents = sourceDocs.map((doc) => ({
    owner, sourceRef: doc.sourceRef, markdown: doc.markdown,
    records: projection.records.filter((item) => item.sourceRef === doc.sourceRef),
    evidenceAtoms: projection.evidenceAtoms.filter((atom) => atom.source.ref === doc.sourceRef),
    privacyClass: "project-metadata",
  }));
  const localCandidates = queries.map((item) => {
    const result = retrieval.searchMssrLibrarianEvidence({ documents, query: { query: item.query, maxResults: 20 } });
    return {
      caseId: item.caseId,
      language: item.language,
      resultCount: result.results.length,
      candidates: result.results.map((hit, index) => ({
        rank: index + 1, handle: hit.handle, score: hit.score, headingPath: hit.headingPath,
        rangeCodeUnits: hit.rangeCodeUnits, exactFetchable: hit.exactFetchable,
      })),
    };
  });

  for (const root of [runtimeRoot, path.dirname(artifactRoot)]) {
    const resolved = path.resolve(root);
    assert.ok(runRoot !== resolved && !runRoot.startsWith(resolved + path.sep), "Run root is inside protected source.");
  }
  assert.ok(!runRoot.split(/[\\/]+/).some((part) => part.toLowerCase() === "runs"), "Run root cannot be under a runs directory.");
  try { await fs.lstat(runRoot); throw new Error("Run root exists; overwrite refused."); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await fs.mkdir(path.join(runRoot, "inputs"), { recursive: true });

  const searchPayload = {
    documents,
    queries: queries.map((item) => ({ caseId: item.caseId, language: item.language, query: { query: item.query, maxResults: 20 } })),
  };
  await fs.writeFile(path.join(runRoot, "inputs", "mcp-search-payload.json"), JSON.stringify(searchPayload, null, 2) + "\n", { flag: "wx" });
  await fs.writeFile(path.join(runRoot, "inputs", "local-search-candidates.json"), JSON.stringify(localCandidates, null, 2) + "\n", { flag: "wx" });
  const runtimeInfo = {
    runtimeRoot, runtimeCommit, runtimeBranch: git(runtimeRoot, "branch", "--show-current"),
    packageVersion: pkg.version, build, buildReceiptSha256: hash(buildBytes),
  };
  await fs.writeFile(path.join(runRoot, "inputs", "runtime-build.json"), JSON.stringify(runtimeInfo, null, 2) + "\n", { flag: "wx" });
  const scriptBytes = await fs.readFile(fileURLToPath(import.meta.url));
  const suiteRoot = path.dirname(fileURLToPath(import.meta.url));
  await fs.writeFile(path.join(runRoot, "manifest.json"), JSON.stringify({
    schema: "mssr-jev-live-selection-preflight-v1",
    runId: path.basename(runRoot),
    status: "offline-preflight-ready-provider-not-called",
    createdAt: new Date().toISOString(),
    source: {
      artifactRunId: receipt.runId,
      artifactRoot,
      candidateCommit: receipt.candidate.commit,
      packageVersion: receipt.candidate.packageVersion,
      buildId: receipt.candidate.build.id,
      verifiedSourceArtifactFiles: sourceFilesVerified,
      sourceSumsSha256: hash(await fs.readFile(path.join(artifactRoot, "SHA256SUMS"))),
      sidecarSha256: expected.sidecarHash,
    },
    runtime: runtimeInfo,
    harness: {
      path: "experiments/jev-metadata-integration/jev-live-preflight-0.2.105.mjs",
      sha256: hash(scriptBytes),
      archiveCommit: git(suiteRoot, "rev-parse", "HEAD"),
    },
    design: {
      queries: queries.map(({ caseId, language }) => ({ caseId, language })),
      sourceFiles: sourcePaths.length,
      sidecarEntries: projection.declared,
      projectedEntries: projection.projected,
      metadataFilters: false,
      candidateLimitPerQuery: 20,
      labelStatus: "none; C01 candidate anchor is unadjudicated and excluded from request state",
      primaryObservation: "Jev selection and exact-fetch integrity over the actual .105 sidecar-aware search shortlist",
      qualityMetric: "none; exploratory smoke only",
      plannedDecisionJobs: 2,
      plannedMaxProviderCalls: 2,
      networkAccess: false,
      jevCallsMade: false,
      providerCallsMade: false,
    },
    nextGate: "Run read-only MSSR search for both frozen queries, verify exact handles, freeze Jev request inputs and reviewed provider receipt; exact START_JEV token is required before provider calls.",
  }, null, 2) + "\n", { flag: "wx" });
  await fs.writeFile(path.join(runRoot, "README.md"), [
    "# MSSR 0.2.105 Jev live-selection preflight",
    "",
    "Status: offline-preflight-ready-provider-not-called.",
    "This artifact prepares two C01 queries (Spanish and English) from the actual MSSR candidate corpus.",
    "It has no gold labels. The unadjudicated C01 anchor is excluded from request state.",
    "Full source Markdown and sidecar atoms are supplied only to read-only MSSR search; Jev will receive exact handles and their source snapshots.",
    "No Jev/provider/network call is made by this preflight. The live gate remains closed until the exact user token START_JEV.",
    "",
  ].join("\n"), { flag: "wx" });

  const paths = (await fs.readdir(runRoot, { withFileTypes: true })).filter((item) => item.isFile()).map((item) => item.name);
  const all = [];
  async function walk(dir, rel = "") {
    for (const item of await fs.readdir(path.join(dir, rel), { withFileTypes: true })) {
      const child = path.posix.join(rel.replaceAll("\\", "/"), item.name);
      if (item.isDirectory()) await walk(dir, child);
      else if (item.isFile()) all.push(child);
      else throw new Error("Unexpected output entry.");
    }
  }
  await walk(runRoot);
  const checksumRows = [];
  for (const rel of all.sort()) checksumRows.push(hash(await fs.readFile(path.join(runRoot, ...rel.split("/")))) + "  " + rel);
  await fs.writeFile(path.join(runRoot, "SHA256SUMS"), checksumRows.join("\n") + "\n", { flag: "wx" });
  const outputFilesVerified = await verifySums(runRoot);
  assert.equal(outputFilesVerified, all.length);
  process.stdout.write(JSON.stringify({
    status: "offline-preflight-ready-provider-not-called",
    runRoot,
    sourceArtifactFilesVerified: sourceFilesVerified,
    outputFilesVerified,
    candidateSourceFiles: sourcePaths.length,
    sidecarEntries: projection.declared,
    projectedEntries: projection.projected,
    omittedEntries: projection.omitted,
    localCandidates: localCandidates.map((item) => ({
      caseId: item.caseId,
      language: item.language,
      resultCount: item.resultCount,
      anchorPresent: item.candidates.some((candidate) => candidate.handle.sourceRef === c01.ref && candidate.headingPath.at(-1) === c01.heading),
      top3: item.candidates.slice(0, 3).map(({ rank, handle, exactFetchable }) => ({
        rank, sourceRef: handle.sourceRef, rangeId: handle.rangeId, exactFetchable,
      })),
    })),
    jevCallsMade: false,
    providerCallsMade: false,
  }, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ status: "preflight-failed", message: error.message }) + "\n");
  process.exitCode = 1;
});
