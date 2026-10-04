import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertExternalRunRoot,
  assertPinnedInputMap,
  validateOptionalReferencesManifestPin,
  verifySha256Sums,
} from "./metadata-preflight-0.2.105.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SUITE_ROOT = path.dirname(SCRIPT_PATH);
const REPOSITORY_ROOT = path.resolve(SUITE_ROOT, "../..");
const PINS_PATH = path.join(SUITE_ROOT, "natural-query-diagnostic-0.2.105-pins.json");
const PREFLIGHT_PINS_PATH = path.join(SUITE_ROOT, "metadata-preflight-0.2.105-pins.json");
const CANDIDATE_BANK_PATH = path.join(REPOSITORY_ROOT, "experiments", "jev-metadata-integration", "candidate-bank.md");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export class NaturalQueryDiagnosticError extends Error {
  constructor(code, message) { super(message); this.name = "NaturalQueryDiagnosticError"; this.code = code; }
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function isSafeRelativePath(value) {
  return typeof value === "string" && !path.isAbsolute(value)
    && !value.split(/[\\/]+/).some((part) => part === "" || part === "." || part === "..");
}

export function parseCandidateBank(markdown, caseIds) {
  const rows = markdown.split(/\r?\n/).filter((line) => /^\| C\d+ \|/.test(line));
  const parsed = new Map();
  for (const line of rows) {
    const cells = line.split("|").map((cell) => cell.trim());
    if (cells.length < 7) throw new NaturalQueryDiagnosticError("malformed-candidate-bank", "A candidate-bank row has missing cells.");
    const id = cells[1];
    if (parsed.has(id)) throw new NaturalQueryDiagnosticError("duplicate-candidate-case", "Candidate-bank case id is duplicated: " + id);
    const anchor = cells[2].replace(/^`|`$/g, "");
    const split = anchor.lastIndexOf("#");
    if (split <= 0 || split === anchor.length - 1) throw new NaturalQueryDiagnosticError("malformed-anchor", "Candidate case has no source path and heading anchor: " + id);
    const sourcePath = anchor.slice(0, split);
    if (!isSafeRelativePath(sourcePath)) throw new NaturalQueryDiagnosticError("unsafe-source-path", "Candidate case source path is unsafe: " + id);
    parsed.set(id, {
      id,
      sourcePath,
      anchorHeading: anchor.slice(split + 1),
      queryEs: cells[3],
      queryEn: cells[4],
      candidateDimension: cells[5],
    });
  }
  return caseIds.map((id) => {
    const item = parsed.get(id);
    if (!item) throw new NaturalQueryDiagnosticError("candidate-case-missing", "Pinned candidate-bank case is missing: " + id);
    if (!item.queryEs || !item.queryEn) throw new NaturalQueryDiagnosticError("candidate-query-missing", "Candidate case needs Spanish and English query seeds: " + id);
    return item;
  });
}

export function classifyCaseSidecarTargets(cases, projectedItems) {
  return cases.map((candidateCase) => {
    const matches = projectedItems.filter((item) => item.status === "projected"
      && item.sourceRef === candidateCase.sourcePath
      && Array.isArray(item.headingPath)
      && item.headingPath.at(-1) === candidateCase.anchorHeading);
    if (matches.length > 1) {
      throw new NaturalQueryDiagnosticError("ambiguous-sidecar-target", "Candidate case matches multiple projected sidecar entries: " + candidateCase.id);
    }
    return {
      caseId: candidateCase.id,
      sidecarTargetDeclared: matches.length === 1,
      sidecarEntryId: matches[0]?.entryId ?? null,
    };
  });
}

export function evaluateExactFetchability(searchResult, { fetchEvidence, fetchLimitChars }) {
  const ranked = searchResult.results.map((item, index) => ({ ...item, rank: index + 1 }));
  for (const item of ranked) {
    if (!Number.isSafeInteger(item.rangeCodeUnits) || item.rangeCodeUnits < 0 || typeof item.exactFetchable !== "boolean") {
      throw new NaturalQueryDiagnosticError("fetchability-contract-missing", "Search result lacks exact-range size/fetchability metadata.");
    }
    if (item.exactFetchable !== (item.rangeCodeUnits <= fetchLimitChars)) {
      throw new NaturalQueryDiagnosticError("fetchability-contract-mismatch", "Search result fetchability disagrees with the pinned product limit.");
    }
  }
  const top = ranked[0];
  const candidate = ranked.find((item) => item.exactFetchable);
  const result = {
    topResult: top ? { rank: top.rank, rangeId: top.handle.rangeId, rangeCodeUnits: top.rangeCodeUnits, exactFetchable: top.exactFetchable } : null,
    highestRankedFetchable: null,
  };
  if (!candidate) return result;
  const fetched = fetchEvidence(candidate);
  if (fetched.fingerprint !== candidate.handle.fingerprint) {
    throw new NaturalQueryDiagnosticError("fetch-fingerprint-mismatch", "Highest-ranked fetchable result fingerprint differs.");
  }
  result.highestRankedFetchable = {
    rank: candidate.rank,
    rangeId: candidate.handle.rangeId,
    rangeCodeUnits: candidate.rangeCodeUnits,
    fingerprint: fetched.fingerprint,
    passed: true,
  };
  return result;
}

export function compareRankings(baseline, withAtoms) {
  const toMap = (items) => new Map(items.map((item, index) => [item.handle.id, { rank: index + 1, item }]));
  const base = toMap(baseline.results);
  const atoms = toMap(withAtoms.results);
  const ids = new Set([...base.keys(), ...atoms.keys()]);
  const rankChanges = [...ids].map((id) => {
    const before = base.get(id);
    const after = atoms.get(id);
    return {
      handleId: id,
      sourceRef: (after ?? before).item.handle.sourceRef,
      rangeId: (after ?? before).item.handle.rangeId,
      headingPath: (after ?? before).item.headingPath,
      baselineRank: before?.rank ?? null,
      atomRank: after?.rank ?? null,
      baselineScore: before?.item.score ?? null,
      atomScore: after?.item.score ?? null,
      change: !before ? "added-with-atoms" : !after ? "removed-with-atoms"
        : before.rank === after.rank ? "same-rank" : "rank-changed",
    };
  }).filter((item) => item.change !== "same-rank");
  const overlap = [...base.keys()].filter((id) => atoms.has(id)).length;
  return {
    baselineCount: baseline.results.length,
    atomCount: withAtoms.results.length,
    topKOverlap: overlap,
    baselineOnlyCount: baseline.results.filter((item) => !atoms.has(item.handle.id)).length,
    atomOnlyCount: withAtoms.results.filter((item) => !base.has(item.handle.id)).length,
    changedRanks: rankChanges,
  };
}

function distIdentity(distDir, expected) {
  const names = fsSync.readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => entry.name).sort();
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
    throw new NaturalQueryDiagnosticError("build-identity-mismatch", "Candidate dist differs from the pinned build identity.");
  }
  return { id, files: names.length, bytes };
}

async function snapshotInput(runRoot, relativePath, bytes, files) {
  const destination = path.join(runRoot, "inputs", "snapshot", ...relativePath.split("/"));
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes, { flag: "wx" });
  files.push({ path: "inputs/snapshot/" + relativePath, sha256: sha256(bytes), bytes: bytes.byteLength });
}

async function listFiles(root, relative = "") {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const child = path.posix.join(relative.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(root, child));
    else if (entry.isFile()) result.push(child);
    else throw new NaturalQueryDiagnosticError("unexpected-output-entry", "Output contains an unexpected non-file entry.");
  }
  return result;
}

async function writeChecksums(runRoot) {
  const names = (await listFiles(runRoot)).filter((name) => name !== "SHA256SUMS").sort();
  const rows = [];
  for (const name of names) rows.push(sha256(await fs.readFile(path.join(runRoot, ...name.split("/")))) + "  " + name);
  await fs.writeFile(path.join(runRoot, "SHA256SUMS"), rows.join("\n") + "\n", { flag: "wx" });
}

function resultPreview(result, limit = 10) {
  return result.results.slice(0, limit).map((item, index) => ({
    rank: index + 1,
    handleId: item.handle.id,
    sourceRef: item.handle.sourceRef,
    rangeId: item.handle.rangeId,
    headingPath: item.headingPath,
    score: item.score,
    rangeCodeUnits: item.rangeCodeUnits,
    exactFetchable: item.exactFetchable,
    projectedFieldsMatched: (item.metadataProjectionMatches ?? []).flatMap((projection) => projection.matches ?? [])
      .map(({ field, value }) => ({ field, value })),
  }));
}

async function runDiagnostic(candidateRootInput, runRootInput) {
  const candidateRoot = await fs.realpath(candidateRootInput);
  const pinsBytes = await fs.readFile(PINS_PATH);
  const pins = JSON.parse(pinsBytes.toString("utf8"));
  const productPins = JSON.parse(await fs.readFile(PREFLIGHT_PINS_PATH, "utf8"));
  const bankBytes = await fs.readFile(CANDIDATE_BANK_PATH);
  if (sha256(bankBytes) !== pins.candidateBank.sha256) throw new NaturalQueryDiagnosticError("candidate-bank-hash-mismatch", "The bilingual query-seed bank changed from its pin.");
  const archiveCommit = git(REPOSITORY_ROOT, "rev-parse", "HEAD");
  const archiveBranch = git(REPOSITORY_ROOT, "branch", "--show-current");
  if (archiveBranch !== "codex/benchmark-archive" || git(REPOSITORY_ROOT, "status", "--porcelain", "--untracked-files=all") !== "") {
    throw new NaturalQueryDiagnosticError("runner-tree-dirty", "Commit the diagnostic harness on the clean benchmark archive branch first.");
  }
  const rootTop = git(candidateRoot, "rev-parse", "--show-toplevel");
  if (path.resolve(rootTop).toLowerCase() !== candidateRoot.toLowerCase()) throw new NaturalQueryDiagnosticError("candidate-root-not-repository", "Candidate root must be the Git worktree root.");
  const candidateCommit = git(candidateRoot, "rev-parse", "HEAD");
  const candidateBranch = git(candidateRoot, "branch", "--show-current");
  if (git(candidateRoot, "status", "--porcelain", "--untracked-files=all") !== "") throw new NaturalQueryDiagnosticError("candidate-tree-dirty", "Candidate worktree must be clean.");
  if (candidateCommit !== pins.candidateCommit || candidateBranch !== pins.candidateBranch
    || candidateCommit !== productPins.candidate.commit) throw new NaturalQueryDiagnosticError("candidate-identity-mismatch", "Candidate branch or commit differs from the diagnostic pins.");

  const candidateInputMap = new Map();
  for (const [relativePath, expectedHash] of Object.entries(productPins.files)) {
    const filePath = path.join(candidateRoot, ...relativePath.split("/"));
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new NaturalQueryDiagnosticError("input-not-regular-file", "Pinned product input is not a regular file: " + relativePath);
    candidateInputMap.set(relativePath, await fs.readFile(filePath));
  }
  assertPinnedInputMap(candidateInputMap, productPins.files);
  validateOptionalReferencesManifestPin(productPins.optionalReferencesManifest);
  if (productPins.optionalReferencesManifest.present === false) {
    try {
      await fs.lstat(path.join(candidateRoot, ...productPins.optionalReferencesManifest.path.split(/[\\/]+/)));
      throw new NaturalQueryDiagnosticError("unexpected-references-manifest", "The pinned candidate requires the optional refs manifest to remain absent.");
    } catch (error) {
      if (error instanceof NaturalQueryDiagnosticError) throw error;
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const packageJson = JSON.parse(candidateInputMap.get("package.json").toString("utf8"));
  if (packageJson.version !== productPins.candidate.packageVersion) throw new NaturalQueryDiagnosticError("package-version-mismatch", "Candidate package version differs from its pin.");
  const build = distIdentity(path.join(candidateRoot, "dist"), productPins.candidate.build);
  const buildReceipt = JSON.parse(candidateInputMap.get("dist/.build-receipt.json").toString("utf8"));
  if (buildReceipt.id !== build.id || buildReceipt.version !== packageJson.version
    || buildReceipt.files !== build.files || buildReceipt.bytes !== build.bytes) {
    throw new NaturalQueryDiagnosticError("build-receipt-mismatch", "Candidate build receipt differs from recomputed dist bytes.");
  }
  const packageLock = JSON.parse(candidateInputMap.get("package-lock.json").toString("utf8"));
  const lockedZodVersion = packageLock.packages?.["node_modules/zod"]?.version;
  const installedZod = JSON.parse(await fs.readFile(path.join(candidateRoot, "node_modules", "zod", "package.json"), "utf8"));
  if (!lockedZodVersion || installedZod.version !== lockedZodVersion) throw new NaturalQueryDiagnosticError("dependency-version-mismatch", "Installed Zod differs from the candidate lockfile.");

  const cases = parseCandidateBank(bankBytes.toString("utf8"), pins.caseIds);
  if (cases.length !== pins.expectedConceptCases) throw new NaturalQueryDiagnosticError("case-count-mismatch", "Selected concept count differs from its pin.");
  const allRows = bankBytes.toString("utf8").split(/\r?\n/).filter((line) => /^\| C\d+ \|/.test(line));
  const allCases = parseCandidateBank(bankBytes.toString("utf8"), allRows.map((line) => line.split("|")[1].trim()));
  const sourcePaths = [...new Set(allCases.map((item) => item.sourcePath))].sort();
  if (sourcePaths.length !== pins.expectedUniqueSourceFiles) throw new NaturalQueryDiagnosticError("source-count-mismatch", "Candidate-bank source count differs from its pin.");
  const markdownByPath = new Map();
  for (const sourcePath of sourcePaths) {
    if (!isSafeRelativePath(sourcePath)) throw new NaturalQueryDiagnosticError("unsafe-source-path", "Candidate-bank source path is unsafe.");
    const filePath = path.join(candidateRoot, ...sourcePath.split("/"));
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new NaturalQueryDiagnosticError("source-not-regular-file", "Candidate source is not a regular file: " + sourcePath);
    markdownByPath.set(sourcePath, await fs.readFile(filePath, "utf8"));
  }

  const library = JSON.parse(candidateInputMap.get(".mssr/project-context-librarian.json").toString("utf8"));
  const sidecarSourcePaths = [...new Set(library.entries.map((entry) => entry.sourcePath))].sort();
  const sidecarSourceFiles = sidecarSourcePaths.map((sourcePath) => ({ path: sourcePath, markdown: markdownByPath.get(sourcePath) }));
  if (sidecarSourceFiles.some((item) => typeof item.markdown !== "string")) throw new NaturalQueryDiagnosticError("sidecar-source-outside-corpus", "A sidecar source is absent from the frozen corpus.");

  const runRoot = await assertExternalRunRoot(runRootInput, [candidateRoot, REPOSITORY_ROOT]);
  await fs.mkdir(runRoot, { recursive: true });
  const snapshotFiles = [];
  for (const [relativePath, bytes] of candidateInputMap) await snapshotInput(runRoot, relativePath, bytes, snapshotFiles);
  for (const [sourcePath, markdown] of markdownByPath) {
    if (!candidateInputMap.has(sourcePath)) await snapshotInput(runRoot, sourcePath, Buffer.from(markdown, "utf8"), snapshotFiles);
  }
  await snapshotInput(runRoot, "experiments/jev-metadata-integration/candidate-bank.md", bankBytes, snapshotFiles);
  snapshotFiles.sort((a, b) => a.path.localeCompare(b.path));

  const snapshotRoot = path.join(runRoot, "inputs", "snapshot");
  const snapshotDocs = sourcePaths.map((sourceRef) => ({ sourceRef, markdown: fsSync.readFileSync(path.join(snapshotRoot, ...sourceRef.split("/")), "utf8") }));
  const frozenSidecarSources = sidecarSourcePaths.map((sourceRef) => ({ sourceRef, markdown: snapshotDocs.find((doc) => doc.sourceRef === sourceRef).markdown }));
  const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(snapshotRoot, ...relativePath.split("/")), "utf8"));
  const projectContextManifest = await readJson(".mssr/project-context.json");
  const librarianManifest = await readJson(".mssr/project-context-librarian.json");
  const segmentsManifest = await readJson(".mssr/project-context-segments.json");
  const owner = "mssr@" + candidateCommit;
  const common = {
    projectContextManifest, librarianManifest, segmentsManifest, referencesManifest: null,
    sourceFiles: frozenSidecarSources.map(({ sourceRef, markdown }) => ({ path: sourceRef, markdown })), owner, projectKey: productPins.candidate.projectKey,
  };
  const projectorUrl = pathToFileURL(path.join(candidateRoot, "dist", "project-context-librarian.js")).href;
  const retrievalUrl = pathToFileURL(path.join(candidateRoot, "dist", "librarian-retrieval.js")).href;
  const { projectMssrProjectContextLibrarianMetadata } = await import(projectorUrl);
  const { MSSR_LIBRARIAN_RETRIEVAL_LIMITS, fetchMssrLibrarianEvidence, searchMssrLibrarianEvidence } = await import(retrievalUrl);
  const projection = projectMssrProjectContextLibrarianMetadata(common);
  assert.equal(projection.projected, library.entries.length);
  assert.equal(projection.omitted, 0);
  const caseSidecarTargets = classifyCaseSidecarTargets(cases, projection.items);
  const sidecarCaseIds = caseSidecarTargets.filter((item) => item.sidecarTargetDeclared).map((item) => item.caseId).sort();
  const untaggedCaseIds = caseSidecarTargets.filter((item) => !item.sidecarTargetDeclared).map((item) => item.caseId).sort();
  if (JSON.stringify(sidecarCaseIds) !== JSON.stringify([...pins.expectedSidecarCaseIds].sort())) {
    throw new NaturalQueryDiagnosticError("sidecar-case-coverage-mismatch", "Projected sidecar-target case ids differ from their pin.");
  }
  if (JSON.stringify(untaggedCaseIds) !== JSON.stringify([...pins.expectedUntaggedCaseIds].sort())) {
    throw new NaturalQueryDiagnosticError("untagged-case-control-mismatch", "Untagged behavior-control case ids differ from their pin.");
  }

  const baseDocuments = snapshotDocs.map((doc) => ({ owner, ...doc, records: [], evidenceAtoms: [], privacyClass: "project-metadata" }));
  const atomDocuments = snapshotDocs.map((doc) => ({
    owner, ...doc,
    records: projection.records.filter((record) => record.sourceRef === doc.sourceRef),
    evidenceAtoms: projection.evidenceAtoms.filter((atom) => atom.source.ref === doc.sourceRef),
    privacyClass: "project-metadata",
  }));
  const selectedResults = [];
  for (const candidateCase of cases) {
    for (const [language, queryText] of [["es", candidateCase.queryEs], ["en", candidateCase.queryEn]]) {
      const query = { query: queryText, maxResults: pins.topK };
      const baseline = searchMssrLibrarianEvidence({ documents: baseDocuments, query });
      const withAtoms = searchMssrLibrarianEvidence({ documents: atomDocuments, query });
      const delta = compareRankings(baseline, withAtoms);
      const anchor = (result) => {
        const hit = result.results.find((item) => item.handle.sourceRef === candidateCase.sourcePath
          && item.headingPath.at(-1) === candidateCase.anchorHeading);
        return hit ? result.results.indexOf(hit) + 1 : null;
      };
      const fetchEvaluation = (result) => evaluateExactFetchability(result, {
        fetchLimitChars: MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars,
        fetchEvidence: (candidate) => {
          const source = snapshotDocs.find((doc) => doc.sourceRef === candidate.handle.sourceRef);
          if (!source) throw new NaturalQueryDiagnosticError("fetch-source-missing", "Fetchable result source is absent from the frozen corpus.");
          return fetchMssrLibrarianEvidence({
            handle: candidate.handle, owner, sourceRef: source.sourceRef, markdown: source.markdown, privacyClass: "project-metadata",
          });
        },
      });
      const caseSidecarTarget = caseSidecarTargets.find((item) => item.caseId === candidateCase.id);
      selectedResults.push({
        caseId: candidateCase.id, language, queryText,
        sourceCluster: candidateCase.sourcePath,
        candidateAnchorHeading: candidateCase.anchorHeading,
        sidecarTargetDeclared: caseSidecarTarget.sidecarTargetDeclared,
        sidecarEntryId: caseSidecarTarget.sidecarEntryId,
        queryMetadataFilter: null,
        baseline: { resultCount: baseline.results.length, top: resultPreview(baseline), fetchEvaluation: fetchEvaluation(baseline), unadjudicatedAnchorRank: anchor(baseline) },
        withAtoms: { resultCount: withAtoms.results.length, top: resultPreview(withAtoms), fetchEvaluation: fetchEvaluation(withAtoms), unadjudicatedAnchorRank: anchor(withAtoms) },
        rankingDelta: delta,
      });
    }
  }

  const receipt = {
    schema: "mssr-librarian-natural-query-retrieval-diagnostic-v1",
    runId: path.basename(runRoot), createdAt: new Date().toISOString(),
    status: "offline-natural-query-ranking-diagnostic-complete",
    mode: "offline-only-baseline-vs-sidecar-atoms-no-metadata-filter",
    networkAccess: false, providerCallsMade: false, jevCallsMade: false, mcpCallsMade: false,
    labelsRead: false, qualityScoringPerformed: false, confidenceCalibrationPerformed: false,
    candidate: { branch: candidateBranch, commit: candidateCommit, packageVersion: packageJson.version, build, zodVersion: installedZod.version },
    harness: {
      branch: archiveBranch, commit: archiveCommit,
      scriptSha256: sha256(await fs.readFile(SCRIPT_PATH)),
      pinsSha256: sha256(pinsBytes), candidateBankSha256: sha256(bankBytes),
    },
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    corpus: { candidateBankSourceFiles: sourcePaths.length, documentsSearched: snapshotDocs.length, sidecarSourceFiles: sidecarSourcePaths.length,
      declaredEntries: projection.declared, projectedEntries: projection.projected, omittedEntries: projection.omitted, topK: pins.topK,
      exactFetchLimitChars: MSSR_LIBRARIAN_RETRIEVAL_LIMITS.fetchChars },
    design: {
      cases: pins.caseIds, concepts: cases.length, queryVariants: selectedResults.length,
      sidecarTargetCaseIds: sidecarCaseIds, untaggedCaseIds,
      sourceClusterCount: new Set(cases.map((item) => item.sourcePath)).size,
      bilingualVariantsGrouped: true, baselineAndAtomsUseSameDocumentsQueriesAndTopK: true,
      candidateBankAnchorsAreUnadjudicated: true, anchorRanksUsedAsQualityScore: false,
      excludedCases: pins.excludedCases,
    },
    inputs: { fileCount: snapshotFiles.length, files: snapshotFiles },
    results: selectedResults,
    interpretation: "Small exploratory retrieval diagnostic. The selected query seeds and candidate anchors are unadjudicated. Rank/candidate changes show only the deterministic effect of projecting these pinned atoms over this corpus; they do not establish acceptable-range recall, relevance, precision, Jev/Noul quality, contradiction or synthesis quality, calibration, or production adoption.",
  };
  const manifest = { schema: "mssr-librarian-natural-query-diagnostic-inputs-v1", candidateCommit, buildId: build.id,
    pinsSha256: sha256(pinsBytes), candidateBankSha256: sha256(bankBytes), files: snapshotFiles };
  await fs.writeFile(path.join(runRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
  await fs.writeFile(path.join(runRoot, "diagnostic.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  const readme = [
    "# MSSR Librarian natural-query retrieval diagnostic", "",
    "Status: " + receipt.status, "",
    "This offline run compares the same candidate corpus and bilingual query seeds with no EvidenceAtoms versus the pinned .105 sidecar projection. No metadata query filters are used.",
    "The query seeds and their heading anchors are unadjudicated. Anchor ranks are shown only as diagnostics and are not treated as correctness labels.",
    "C03 was excluded from this slice pending owner review of a possible query/selector premise mismatch. C24 is an untagged sidecar-behavior control.",
    "No Jev/provider/MCP/network call, labels, confidence calibration, or quality score were used. This result is a small rank-change diagnostic, not a quality benchmark.", "",
    "Verify all outputs against SHA256SUMS.", "",
  ].join("\n");
  await fs.writeFile(path.join(runRoot, "README.md"), readme, { flag: "wx" });
  await writeChecksums(runRoot);
  await verifySha256Sums(runRoot);
  const readback = JSON.parse(await fs.readFile(path.join(runRoot, "diagnostic.json"), "utf8"));
  assert.equal(readback.results.length, cases.length * 2);
  assert.equal(readback.design.anchorRanksUsedAsQualityScore, false);
  return { runRoot, receipt };
}

function parseArgs(argv) {
  const args = { diagnostic: false, candidateRoot: null, runRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--diagnostic") { args.diagnostic = true; continue; }
    if (key !== "--candidate-root" && key !== "--run-root") throw new NaturalQueryDiagnosticError("unsupported-flag", "Only offline --diagnostic is supported.");
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new NaturalQueryDiagnosticError("missing-argument-value", "Absolute path required after " + key + ".");
    index += 1;
    if (key === "--candidate-root") args.candidateRoot = value; else args.runRoot = value;
  }
  if (!args.diagnostic) throw new NaturalQueryDiagnosticError("diagnostic-required", "This runner has no live mode.");
  if (!args.candidateRoot || !path.isAbsolute(args.candidateRoot)) throw new NaturalQueryDiagnosticError("candidate-root-required", "--candidate-root must be absolute.");
  if (!args.runRoot || !path.isAbsolute(args.runRoot)) throw new NaturalQueryDiagnosticError("run-root-required", "--run-root must be absolute.");
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runDiagnostic(args.candidateRoot, args.runRoot);
  process.stdout.write(JSON.stringify({ status: result.receipt.status, runRoot: result.runRoot, receipt: result.receipt }, null, 2) + "\n");
}
if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    const code = error instanceof NaturalQueryDiagnosticError ? error.code : "diagnostic-failed";
    process.stderr.write(JSON.stringify({ status: "diagnostic-failed", code, message: error.message }) + "\n");
    process.exitCode = 1;
  });
}
