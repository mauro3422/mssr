#!/usr/bin/env node
/**
 * Development-only composed Librarian harness.
 * Live provider calls stay blocked until the connected Bridge build/catalog can
 * be pinned and verified by this runner.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateLibrarianCompositionReview } from "./lib/evaluate-librarian-composition-review.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = path.join(ROOT, "experiments/jev-mssr-live/runs");
const RUNNER = fileURLToPath(import.meta.url);
const COMPOSITION_EVALUATOR = path.join(ROOT, "scripts/lib/evaluate-librarian-composition-review.mjs");
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const hash = (data) => createHash("sha256").update(data).digest("hex");
const fail = (message) => { throw new Error(message); };
const record = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const sha = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const samePath = (a, b) => process.platform === "win32"
  ? path.resolve(a).replace(/\\/g, "/").toLowerCase() === path.resolve(b).replace(/\\/g, "/").toLowerCase()
  : path.resolve(a) === path.resolve(b);
const within = (root, target) => {
  const rel = path.relative(path.resolve(root), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
};

async function rejectReparseComponents(target, allowMissingTail = false) {
  const absolute = path.resolve(target);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try { stat = await fs.lstat(current); }
    catch (error) { if (allowMissingTail && error.code === "ENOENT") return; throw error; }
    if (stat.isSymbolicLink()) fail("Symlink/junction/reparse component refused: " + current);
    const real = await fs.realpath(current);
    if (!samePath(real, current)) fail("Resolved reparse alias refused: " + current);
  }
}
async function contained(root, target, allowMissingTail = false) {
  const base = path.resolve(root), absolute = path.resolve(target);
  if (!within(base, absolute)) fail("Path is outside approved root: " + target);
  await rejectReparseComponents(base);
  await rejectReparseComponents(absolute, allowMissingTail);
  const baseReal = await fs.realpath(base);
  const targetReal = allowMissingTail ? absolute : await fs.realpath(absolute);
  if (!within(baseReal, targetReal)) fail("Resolved path escaped approved root: " + target);
  return absolute;
}
function sourceParts(ref) {
  if (typeof ref !== "string" || !ref || ref !== ref.trim() || ref.includes("\\") || ref.startsWith("/") || /^[A-Za-z]:/.test(ref)) fail("sourceRef must be repository-relative POSIX.");
  const parts = ref.split("/");
  if (parts.some((x) => !x || x === "." || x === ".." || /sealed|holdout|private|secret/i.test(x)) || !/\.md$/i.test(ref)) fail("Unknown, sealed, or non-Markdown source refused.");
  return parts;
}
async function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) fail("Git command failed: " + args.join(" "));
  return result.stdout.trim();
}
async function readSource(ref, expected) {
  const file = await contained(ROOT, path.resolve(ROOT, ...sourceParts(ref)));
  const st = await fs.lstat(file);
  if (!st.isFile() || st.isSymbolicLink()) fail("Source is not a regular file: " + ref);
  const bytes = await fs.readFile(file);
  const actual = hash(bytes);
  if (!sha(expected) || actual !== expected) fail("Source hash is unknown or stale: " + ref);
  const indexed = spawnSync("git", ["ls-files", "--error-unmatch", "--", ref], { cwd: ROOT, encoding: "utf8", windowsHide: true });
  if (indexed.status !== 0) fail("Source is not tracked by Git: " + ref);
  let markdown;
  try { markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { fail("Source is not UTF-8: " + ref); }
  return { sourceRef: ref, bytes, markdown, sha256: actual, lines: markdown.replace(/\r\n?/g, "\n").split("\n").length };
}
function validatePlan(plan, sources) {
  if (!record(plan) || plan.schemaVersion !== 1 || plan.classification?.kind !== "exploratory-development-diagnostic" || plan.classification.benchmark !== false || plan.classification.holdoutUsed !== false) fail("Plan must be non-benchmark and non-holdout exploratory work.");
  if (plan.corpus?.priorExposure !== "known-exposed" || !String(plan.corpus.priorExposureNote || "").trim()) fail("Known exposure and rationale are required.");
  if (!Array.isArray(plan.corpus?.sources) || plan.corpus.sources.length < 1 || plan.corpus.sources.length > 16 || !Array.isArray(plan.facets) || plan.facets.length < 1 || plan.facets.length > 16) fail("Plan source/facet counts are outside bounds.");
  const refs = new Set();
  for (const source of plan.corpus.sources) {
    if (!record(source) || !sources.has(source.sourceRef) || refs.has(source.sourceRef)) fail("Plan has duplicate or undeclared sources.");
    refs.add(source.sourceRef);
  }
  const ids = new Set();
  for (const facet of plan.facets) {
    if (!record(facet) || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(facet.id || "") || ids.has(facet.id)) fail("Facet ids must be unique lowercase identifiers.");
    ids.add(facet.id);
    if (!refs.has(facet.sourceRef) || typeof facet.query !== "string" || !facet.query.trim() || facet.query.length > 500) fail("Facet source/query is invalid.");
    const expectedEvidenceStatus = facet.expectedEvidenceStatus ?? "present";
    if (!["present", "absent"].includes(expectedEvidenceStatus)) fail("Facet expectedEvidenceStatus must be present or absent.");
    if (!Array.isArray(facet.expectedLines) || (expectedEvidenceStatus === "present" && !facet.expectedLines.length) || (expectedEvidenceStatus === "absent" && facet.expectedLines.length !== 0)) {
      fail("Present facets need source-declared expectedLines; absent facets need an empty expectedLines array.");
    }
    const lineCount = sources.get(facet.sourceRef).lines;
    for (const span of facet.expectedLines) if (!record(span) || !Number.isInteger(span.start) || !Number.isInteger(span.end) || span.start < 1 || span.end < span.start || span.end > lineCount) fail("Expected line span is outside source bounds 1-" + lineCount + ".");
    const orderedSpans = [...facet.expectedLines].sort((a, b) => a.start - b.start || a.end - b.end);
    for (let index = 1; index < orderedSpans.length; index += 1) {
      if (orderedSpans[index].start <= orderedSpans[index - 1].end) fail("Expected line spans overlap for facet " + facet.id + ".");
    }
  }
}
function ownerForRepo() {
  const normalized = ROOT.replace(/\\/g, "/");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
function exactKeys(value, keys, label) {
  if (!record(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) fail(label + " does not match strict schema.");
}
function validateReceipt(r, facet, source, retrieval) {
  exactKeys(r, ["schemaVersion", "facetId", "sourceRef", "sourceSha256", "query", "candidateSource", "status", "candidates", "selection", "selectedHandle", "fetch", "safeError"], "Receipt");
  if (r.schemaVersion !== 1 || r.facetId !== facet.id || r.sourceRef !== facet.sourceRef || r.sourceSha256 !== source.sha256 || r.query !== facet.query) fail("Receipt identity mismatch for " + facet.id);
  if (!["search-handles", "implicit-headings"].includes(r.candidateSource)) fail("Receipt candidate source is unknown for " + facet.id);
  if (!Array.isArray(r.candidates) || r.candidates.length > 100 || r.safeError !== null) fail("Invalid candidates/error in receipt " + facet.id);
  if ((r.candidateSource === "search-handles" && r.candidates.length === 0) || (r.candidateSource === "implicit-headings" && r.candidates.length !== 0)) fail("Receipt candidate source does not match candidate list for " + facet.id);
  const candidateIds = new Set();
  for (const raw of r.candidates) {
    const h = retrieval.mssrLibrarianEvidenceHandleSchema.parse(raw);
    if (candidateIds.has(h.id) || h.sourceRef !== facet.sourceRef || h.owner !== ownerForRepo()) fail("Candidate identity mismatch for " + facet.id);
    candidateIds.add(h.id);
    retrieval.fetchMssrLibrarianEvidence({ handle: h, owner: h.owner, sourceRef: h.sourceRef, markdown: source.markdown, privacyClass: h.privacyClass });
  }
  const s = r.selection;
  if (!record(s) || !["selected", "abstained"].includes(s.status) || s.jevCallMade !== true || s.advisoryOnly !== true || s.truthAuthority !== false || s.exactFetchRequired !== true || s.autoApplyAllowed !== false || typeof s.provider !== "string" || !s.provider.trim() || typeof s.model !== "string" || !s.model.trim() || !sha(s.requestFingerprint) || !Number.isInteger(s.candidateCount) || s.candidateCount < 1 || !Number.isInteger(s.providerCalls) || s.providerCalls < 1) fail("Unknown or incomplete Jev selection receipt for " + facet.id);
  const selectionKeys = new Set(["status", "candidateCount", "candidateRangeDiagnostics", "rangeOverlapDiagnostics", "finalistCount", "selectionMode", "selectionPasses", "providerCalls", "providerConfidence", "evidenceSufficiency", "provider", "model", "providersUsed", "modelsUsed", "usage", "requestFingerprint", "elapsedMs", "jevCallMade", "batchAssessments", "selected", "advisoryOnly", "truthAuthority", "verification", "confidenceCalibration", "evidenceSufficiencyCalibration", "exactFetchRequired", "autoApplyAllowed"]);
  if (Object.keys(s).some((key) => !selectionKeys.has(key))) fail("Jev selection receipt contains unrecognized fields for " + facet.id);
  if ((r.candidateSource === "search-handles" && s.candidateCount > r.candidates.length) || (r.candidateSource === "implicit-headings" && s.candidateCount < 1)) fail("Jev candidate count does not match receipt candidate source for " + facet.id);
  if (r.status === "abstained") {
    if (s.status !== "abstained" || s.selected !== null || r.selectedHandle !== null || r.fetch !== null) fail("Abstention receipt is inconsistent for " + facet.id);
    return null;
  }
  if (r.status !== "selected" || s.status !== "selected" || !record(s.selected) || !record(s.selected.handle) || !record(r.selectedHandle) || !record(r.fetch)) fail("Unknown receipt outcome for " + facet.id);
  const h = retrieval.mssrLibrarianEvidenceHandleSchema.parse(r.selectedHandle);
  const chosen = retrieval.mssrLibrarianEvidenceHandleSchema.parse(s.selected.handle);
  const handleKeys = Object.keys(h).sort();
  if (handleKeys.join("|") !== Object.keys(chosen).sort().join("|") || handleKeys.some((key) => h[key] !== chosen[key])) fail("Selected handle differs from Jev selection for " + facet.id);
  if (h.sourceRef !== facet.sourceRef || h.owner !== ownerForRepo()) fail("Selected handle owner/source mismatch for " + facet.id);
  if (r.candidates.length && !candidateIds.has(h.id)) fail("Selected handle was not among offered search candidates for " + facet.id);
  exactKeys(r.fetch, ["status", "handleFingerprint", "fetchedFingerprint", "textSha256", "expectedTextSha256", "textChars", "exactText", "startLineFromSource", "endLineFromSource"], "Fetch receipt");
  const f = r.fetch;
  if (f.status !== "verified" || f.handleFingerprint !== h.fingerprint || !sha(f.fetchedFingerprint) || !sha(f.textSha256) || !sha(f.expectedTextSha256) || !Number.isInteger(f.textChars) || typeof f.exactText !== "string") fail("Invalid exact-fetch receipt for " + facet.id);
  const fetched = retrieval.fetchMssrLibrarianEvidence({ handle: h, owner: h.owner, sourceRef: h.sourceRef, markdown: source.markdown, privacyClass: h.privacyClass });
  const textHash = hash(Buffer.from(fetched.text, "utf8"));
  if (f.exactText !== fetched.text || f.fetchedFingerprint !== fetched.fingerprint || f.textSha256 !== textHash || f.expectedTextSha256 !== textHash || f.textChars !== fetched.text.length || f.startLineFromSource !== h.startLine || f.endLineFromSource !== h.endLine) fail("Replay exact fetch validation failed for " + facet.id);
  return h;
}
function coverageRows(plan, receipts) {
  return plan.facets.map((facet) => {
    const r = receipts.find((item) => item.facetId === facet.id);
    const h = r?.selectedHandle;
    const expectedEvidenceStatus = facet.expectedEvidenceStatus ?? "present";
    const spans = facet.expectedLines.map((span) => {
      const start = h ? Math.max(span.start, h.startLine) : null;
      const end = h ? Math.min(span.end, h.endLine) : null;
      const covered = start !== null && end !== null && end >= start;
      return { ...span, covered, coveredStart: covered ? start : null, coveredEnd: covered ? end : null };
    });
    const expected = spans.reduce((n, x) => n + x.end - x.start + 1, 0);
    const covered = spans.reduce((n, x) => n + (x.covered ? x.coveredEnd - x.coveredStart + 1 : 0), 0);
    const lineSpanCoverage = expected ? covered / expected : null;
    return {
      facetId: facet.id,
      status: r?.status || "missing",
      expectedEvidenceStatus,
      selectionOutcomeMatchesDeclaredExpectation: expectedEvidenceStatus === "absent" ? r?.status === "abstained" : r?.status === "selected",
      metric: "line-span-coverage-only",
      semanticCoverage: false,
      ownerGold: false,
      expectedLineCount: expected,
      coveredLineCount: covered,
      lineSpanCoverage,
      expectedSpanCoverageStatus: expectedEvidenceStatus === "absent"
        ? "not-applicable"
        : lineSpanCoverage === 1 ? "complete" : lineSpanCoverage > 0 ? "partial" : "missing",
      spans,
    };
  });
}
function compositionGate(plan, receipts, coverage) {
  const facets = plan.facets.map((facet) => {
    const receipt = receipts.find((item) => item.facetId === facet.id);
    const expectedEvidenceStatus = facet.expectedEvidenceStatus ?? "present";
    const spanCoverage = coverage.find((item) => item.facetId === facet.id);
    const exactFetchVerified = expectedEvidenceStatus === "present" && receipt?.status === "selected" && receipt.fetch?.status === "verified";
    const expectedSpanFullyCovered = expectedEvidenceStatus === "present" && spanCoverage?.lineSpanCoverage === 1;
    return { facetId: facet.id, exactFetchVerified, expectedSpanFullyCovered, exactEvidence: exactFetchVerified && expectedSpanFullyCovered };
  });
  const incompleteFacetIds = facets.filter((facet) => !facet.exactEvidence).map((facet) => facet.facetId);
  const exactFetchedFacetCount = facets.filter((facet) => facet.exactFetchVerified).length;
  const fullyCoveredFacetCount = facets.filter((facet) => facet.exactEvidence).length;
  const expectedSpanIncompleteFacetIds = facets.filter((facet) => !facet.expectedSpanFullyCovered && coverage.find((row) => row.facetId === facet.facetId)?.expectedEvidenceStatus === "present").map((facet) => facet.facetId);
  const positiveFacetCount = plan.facets.filter((facet) => (facet.expectedEvidenceStatus ?? "present") === "present").length;
  const selectionOutcomeMismatches = plan.facets.filter((facet) => {
    const receipt = receipts.find((item) => item.facetId === facet.id);
    const expectedEvidenceStatus = facet.expectedEvidenceStatus ?? "present";
    return expectedEvidenceStatus === "absent" ? receipt?.status !== "abstained" : receipt?.status !== "selected";
  }).map((facet) => facet.id);
  return {
    schemaVersion: 1,
    exactEvidenceStatus: incompleteFacetIds.length === 0 ? "complete" : "incomplete",
    requiredFacetCount: facets.length,
    exactFetchedFacetCount,
    fullyCoveredFacetCount,
    incompleteFacetIds,
    expectedPositiveSpanCoverageStatus: positiveFacetCount === 0 ? "not-applicable" : expectedSpanIncompleteFacetIds.length === 0 ? "complete" : "incomplete",
    expectedSpanIncompleteFacetIds,
    selectionOutcomeMismatches,
    semanticCoverageStatus: "unknown",
    ownerGold: false,
    answerSynthesisStatus: incompleteFacetIds.length > 0
      ? "blocked-incomplete-facet-evidence"
      : "pending-independent-semantic-review",
    answerSynthesisAllowed: false,
  };
}
async function distIdentity(root, requireMssrReceipt = false) {
  await rejectReparseComponents(path.resolve(root));
  const realRoot = await fs.realpath(root);
  await rejectReparseComponents(realRoot);
  const pkgBytes = await fs.readFile(await contained(realRoot, path.join(realRoot, "package.json")));
  const pkg = JSON.parse(pkgBytes.toString("utf8"));
  const dist = await contained(realRoot, path.join(realRoot, "dist"));
  const js = (await fs.readdir(dist, { withFileTypes: true })).filter((e) => e.isFile() && e.name.endsWith(".js")).map((e) => e.name).sort();
  if (!js.length) fail("No dist JavaScript modules under " + dist);
  const modules = [];
  for (const name of js) modules.push({ path: "dist/" + name, sha256: hash(await fs.readFile(await contained(dist, path.join(dist, name)))) });
  let receipt = null;
  try { receipt = JSON.parse(await fs.readFile(path.join(dist, ".build-receipt.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  let buildId = null;
  if (requireMssrReceipt) {
    if (receipt?.schema !== "mssr-build-receipt-v1") fail("MSSR finished build receipt is missing or invalid.");
    const { readMssrServerBuildId } = await import(pathToFileURL(path.join(dist, "server-build.js")).href);
    const identity = readMssrServerBuildId(dist);
    if (identity.status !== "known" || identity.id !== receipt.id) fail("MSSR finished build receipt does not match dist bytes.");
    buildId = identity.id;
  }
  const repoHeadResult = spawnSync("git", ["rev-parse", "HEAD"], { cwd: realRoot, encoding: "utf8", windowsHide: true });
  const sourceRevision = repoHeadResult.status === 0 ? repoHeadResult.stdout.trim() : null;
  const dirtyResult = spawnSync("git", ["status", "--porcelain", "--", "src", "package.json", "package-lock.json"], { cwd: realRoot, encoding: "utf8", windowsHide: true });
  const dirtySourcePaths = dirtyResult.status === 0 ? dirtyResult.stdout.split(/\r?\n/u).filter(Boolean).map((line) => line.slice(3)).slice(0, 200) : null;
  let mssrDependency = null;
  const dependencySpec = pkg.dependencies?.["@mauroprime/mssr"];
  if (typeof dependencySpec === "string") {
    mssrDependency = { spec: dependencySpec, artifactSha256: null };
    if (dependencySpec.startsWith("file:")) {
      const artifactPath = await contained(realRoot, path.resolve(realRoot, dependencySpec.slice(5)));
      mssrDependency.artifactSha256 = hash(await fs.readFile(artifactPath));
    }
  }
  return { root: realRoot, repositoryHead: sourceRevision, dirtySourcePaths, packageVersion: pkg.version || "unknown", packageSha256: hash(pkgBytes), buildId, buildReceipt: receipt, mssrDependency, modules };
}
async function outputPath(raw) {
  if (!raw) fail("A fresh --output-dir is required.");
  const result = await contained(RUNS, path.resolve(raw), true);
  if (samePath(result, RUNS)) fail("Output must be a new child of the runs directory.");
  try { await fs.lstat(result); fail("Refusing to overwrite existing run directory: " + result); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return result;
}
async function writeOnce(file, bytes) { await fs.writeFile(file, bytes, { flag: "wx" }); }
async function checksums(dir, virtualFiles = []) {
  const rows = [];
  async function walk(folder, prefix = "") {
    for (const entry of (await fs.readdir(folder, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(folder, entry.name), rel = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isSymbolicLink()) fail("Unexpected link in run artifacts: " + rel);
      if (entry.isDirectory()) await walk(full, rel);
      else if (entry.isFile() && rel !== "SHA256SUMS") rows.push(hash(await fs.readFile(full)) + "  " + rel);
    }
  }
  await walk(dir);
  for (const item of virtualFiles) rows.push(hash(item.bytes) + "  " + item.name);
  await writeOnce(path.join(dir, "SHA256SUMS"), rows.sort().join("\n") + "\n");
}
async function freezeRun(dir, manifest, planBytes, runnerBytes, sources, extra = []) {
  await fs.mkdir(dir, { recursive: false });
  await writeOnce(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  await fs.mkdir(path.join(dir, "inputs"));
  await writeOnce(path.join(dir, "inputs", "plan.json"), planBytes);
  await writeOnce(path.join(dir, "inputs", "runner.mjs"), runnerBytes);
  for (const [i, source] of [...sources.values()].entries()) await writeOnce(path.join(dir, "inputs", String(i + 1).padStart(2, "0") + ".md"), source.bytes);
  for (const item of extra) await writeOnce(path.join(dir, "inputs", item.name), item.bytes);
}
async function completeRun(dir, completion, outputs = []) {
  for (const item of outputs) await writeOnce(path.join(dir, item.name), item.bytes);
  const completionBytes = JSON.stringify(completion, null, 2) + "\n";
  // Include the exact future completion bytes in the manifest first. If the
  // process stops before the final write, there is no false completed marker.
  await checksums(dir, [{ name: "run-completion.json", bytes: completionBytes }]);
  await writeOnce(path.join(dir, "run-completion.json"), completionBytes);
}
async function leaveFailureState(dir, mode, error) {
  try {
    await fs.lstat(path.join(dir, "run-completion.json"));
  } catch (missing) {
    if (missing.code === "ENOENT") {
      const completionBytes = JSON.stringify({
        schemaVersion: 1, status: "failed-incomplete", mode, benchmark: false,
        error: error?.message || "Run persistence failed.",
        checksumsCover: "all artifacts except SHA256SUMS; missing completion means interrupted before this receipt",
      }, null, 2) + "\n";
      await fs.rm(path.join(dir, "SHA256SUMS"), { force: true }).catch(() => undefined);
      await checksums(dir, [{ name: "run-completion.json", bytes: completionBytes }]).catch(() => undefined);
      await writeOnce(path.join(dir, "run-completion.json"), completionBytes).catch(() => undefined);
    }
  }
}
async function main() {
  const planPath = option("--plan");
  if (!planPath) fail("Usage: node scripts/run-composed-librarian-experiment.mjs --plan <plan.json> [--replay <receipts.jsonl> [--composition-review <review.json>] | --allow-network --output-dir <new-dir>]");
  const absolutePlanPath = path.resolve(planPath);
  await rejectReparseComponents(absolutePlanPath);
  const planBytes = await fs.readFile(absolutePlanPath);
  const plan = JSON.parse(planBytes.toString("utf8"));
  if (!record(plan) || !Array.isArray(plan?.corpus?.sources)) fail("Plan has no source list.");
  const sources = new Map();
  for (const item of plan.corpus.sources) {
    if (!record(item) || typeof item.sourceRef !== "string" || sources.has(item.sourceRef)) fail("Invalid or duplicate plan source.");
    sources.set(item.sourceRef, await readSource(item.sourceRef, item.sha256));
  }
  validatePlan(plan, sources);
  const runnerBytes = await fs.readFile(RUNNER);
  const mssr = await distIdentity(ROOT, true);
  const head = await git(["rev-parse", "HEAD"]);
  const replayPath = option("--replay");
  const compositionReviewPath = option("--composition-review");
  const hasCompositionReview = Boolean(compositionReviewPath);
  if (compositionReviewPath && !replayPath) fail("--composition-review is allowed only with --replay; it never enables a live/provider path.");
  if (replayPath) {
    const replayFile = path.resolve(replayPath);
    await rejectReparseComponents(replayFile);
    const replayBytes = await fs.readFile(replayFile);
    const raw = replayBytes.toString("utf8");
    const receipts = raw.trim().startsWith("[") ? JSON.parse(raw) : raw.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
    if (!Array.isArray(receipts)) fail("Replay must be a JSON array or JSONL.");
    let compositionReviewBytes = null;
    let compositionReview = null;
    let compositionEvaluatorBytes = null;
    if (compositionReviewPath) {
      const reviewFile = path.resolve(compositionReviewPath);
      await rejectReparseComponents(reviewFile);
      compositionReviewBytes = await fs.readFile(reviewFile);
      compositionReview = JSON.parse(compositionReviewBytes.toString("utf8"));
      if (!record(compositionReview)) fail("Composition review must be a JSON object matching the strict review schema.");
      compositionEvaluatorBytes = await fs.readFile(COMPOSITION_EVALUATOR);
    }
    const byFacet = new Map();
    for (const r of receipts) {
      if (!record(r) || typeof r.facetId !== "string" || byFacet.has(r.facetId)) fail("Replay has an invalid or duplicate facet receipt.");
      byFacet.set(r.facetId, r);
    }
    if (byFacet.size !== plan.facets.length || plan.facets.some((f) => !byFacet.has(f.id))) fail("Replay must contain exactly one receipt per declared facet.");
    const [{ buildMssrLibrarianEvidencePack }, retrieval] = await Promise.all([
      import(pathToFileURL(path.join(ROOT, "dist/librarian-evidence-pack.js")).href),
      import(pathToFileURL(path.join(ROOT, "dist/librarian-retrieval.js")).href),
    ]);
    const handles = [];
    for (const facet of plan.facets) {
      const h = validateReceipt(byFacet.get(facet.id), facet, sources.get(facet.sourceRef), retrieval);
      if (h) handles.push(h);
    }
    const orderedReceipts = plan.facets.map((f) => byFacet.get(f.id));
    const coverage = coverageRows(plan, orderedReceipts);
    const composition = compositionGate(plan, orderedReceipts, coverage);
    const compositionEvaluation = hasCompositionReview
      ? evaluateLibrarianCompositionReview({ plan, receipts: orderedReceipts, review: compositionReview })
      : null;
    let union = null;
    if (handles.length) {
      const docs = [...new Set(handles.map((h) => h.owner + "\u0000" + h.sourceRef))].map((key) => {
        const [owner, ref] = key.split("\u0000");
        return { owner, sourceRef: ref, markdown: sources.get(ref).markdown, privacyClass: "project-metadata" };
      });
      union = buildMssrLibrarianEvidencePack({ documents: docs, handles, dedupeContainedRanges: true });
    }
    let dir = null;
    if (option("--output-dir")) {
      dir = await outputPath(option("--output-dir"));
      const manifest = {
        schemaVersion: 1, status: "running", mode: "provider-off-replay", benchmark: false, holdoutUsed: false,
        frozenAt: new Date().toISOString(), gitHead: head, planSha256: hash(planBytes), runnerSha256: hash(runnerBytes),
        sourceClusterCount: sources.size,
        sources: [...sources.values()].map((s, i) => ({ sourceRef: s.sourceRef, sha256: s.sha256, snapshot: "inputs/" + String(i + 1).padStart(2, "0") + ".md" })),
        mssrBuild: mssr, bridgeBuild: { status: "not-used-provider-off-replay" },
        coverageMetric: "line-span-coverage-only; semanticCoverage=false; ownerGold=false",
        compositionReview: hasCompositionReview ? {
          sha256: hash(compositionReviewBytes),
          evaluatorSha256: hash(compositionEvaluatorBytes),
          labelProvenance: compositionReview.labelProvenance,
          reviewerBlindness: "caller-asserted",
          ownerGold: false,
          benchmark: false,
        } : null,
      };
      try {
        await freezeRun(dir, manifest, planBytes, runnerBytes, sources, [
          { name: "facet-receipts.input", bytes: replayBytes },
          ...(hasCompositionReview ? [
            { name: "composition-review.input.json", bytes: compositionReviewBytes },
            { name: "composition-review-evaluator.mjs", bytes: compositionEvaluatorBytes },
          ] : []),
        ]);
        await completeRun(dir, {
          schemaVersion: 1, status: "completed", mode: "provider-off-replay", benchmark: false, providerCalls: 0,
          unionParagraphCount: union?.paragraphs.length || 0, coverageMetric: "line-span-coverage-only", semanticCoverage: false, ownerGold: false, confidenceCalibration: "none",
          compositionGate: composition,
          compositionEvaluation: compositionEvaluation ? { metrics: compositionEvaluation.metrics, labelProvenance: compositionEvaluation.labelProvenance, ownerGold: false, synthesisAuthority: false } : null,
        }, [
          ...(union ? [{ name: "evidence-pack.json", bytes: JSON.stringify(union, null, 2) + "\n" }] : []),
          { name: "coverage.json", bytes: JSON.stringify({ schemaVersion: 1, metric: "line-span-coverage-only", semanticCoverage: false, ownerGold: false, benchmark: false, facets: coverage, compositionGate: composition }, null, 2) + "\n" },
          ...(compositionEvaluation ? [{ name: "composition-evaluation.json", bytes: JSON.stringify(compositionEvaluation, null, 2) + "\n" }] : []),
        ]);
      } catch (error) {
        await leaveFailureState(dir, "provider-off-replay", error);
        throw error;
      }
    }
    process.stdout.write(JSON.stringify({ status: "provider-off-replay", networkRequests: 0, providerCalls: 0, outputDir: dir, unionParagraphCount: union?.paragraphs.length || 0, metric: "line-span-coverage-only", semanticCoverage: false, ownerGold: false, compositionGate: composition, compositionEvaluation, facets: coverage }, null, 2) + "\n");
    return;
  }
  if (!flag("--allow-network")) {
    process.stdout.write(JSON.stringify({ status: "dry-run", networkRequests: 0, outputWrites: 0, liveGate: "blocked-until-Bridge-and-MSSR-build-freeze", facets: plan.facets.map(({ id, sourceRef, query }) => ({ id, sourceRef, query })), labelsRead: false, corpusSourcesVerified: sources.size }, null, 2) + "\n");
    return;
  }
  const dir = await outputPath(option("--output-dir"));
  const bridgeRoot = process.env.MSSR_BRIDGE_ROOT;
  let bridge = { status: "unavailable-or-unverified", configuredRoot: bridgeRoot ? path.resolve(bridgeRoot) : null };
  if (bridgeRoot) {
    try { bridge = { status: "snapshotted-but-live-gate-unverified", ...(await distIdentity(path.resolve(bridgeRoot))) }; }
    catch (error) { bridge = { status: "snapshot-failed", error: error.message }; }
  }
  const reason = "Live is blocked: this harness cannot verify the connected Bridge process/catalog against the captured local module build. No Jev/provider/network calls were made.";
  const manifest = {
    schemaVersion: 1, status: "blocked", mode: "live-request-blocked", benchmark: false, holdoutUsed: false,
    frozenAt: new Date().toISOString(), gitHead: head, planSha256: hash(planBytes), runnerSha256: hash(runnerBytes),
    sourceClusterCount: sources.size,
    sources: [...sources.values()].map((s, i) => ({ sourceRef: s.sourceRef, sha256: s.sha256, snapshot: "inputs/" + String(i + 1).padStart(2, "0") + ".md" })),
    mssrBuild: mssr, bridgeBuild: bridge, liveGate: { status: "blocked", reason },
    coverageMetric: "line-span-coverage-only; semanticCoverage=false; ownerGold=false",
  };
  try {
    await freezeRun(dir, manifest, planBytes, runnerBytes, sources);
    await completeRun(dir, { schemaVersion: 1, status: "blocked", mode: "live-request-blocked", benchmark: false, providerCalls: 0, networkRequests: 0, reason });
  } catch (error) {
    await leaveFailureState(dir, "live-request-blocked", error);
    throw error;
  }
  process.stdout.write(JSON.stringify({ status: "blocked", outputDir: dir, providerCalls: 0, networkRequests: 0, reason }, null, 2) + "\n");
}
main().catch((error) => { process.stderr.write((error?.message || "Harness failed.") + "\n"); process.exitCode = 1; });
