import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMssrMarkdownDocumentSurface } from "../../../../dist/document-surface.js";

const root = dirname(fileURLToPath(import.meta.url));
const repository = resolve(root, "../../../../");
const runId = "mssr-librarian-jev-full-heading-choice-20260930-v1";
const parentPath = resolve(root, "../mssr-librarian-jev-candidate-selection-20260930-v1");
const parentManifest = JSON.parse(readFileSync(resolve(parentPath, "manifest.json"), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bytes = (path) => readFileSync(resolve(root, path));
const json = (path) => JSON.parse(bytes(path).toString("utf8"));
const hashFile = (path) => sha256(bytes(path));
const summary = json("summary.json");
const requests = json("requests.json");
const responses = json("responses.json");
if (summary.runId !== runId || requests.runId !== runId || responses.runId !== runId) throw new Error("Run identity mismatch.");
if (summary.status !== "complete" || responses.responses.length !== 52 || responses.responses.some((item) => item.status !== "success")) throw new Error("Live responses are incomplete.");
if (requests.sourceLabelFileRead !== false || requests.requests.length !== 52) throw new Error("Request provenance is invalid.");
if (requests.requests.some((item) => Object.keys(item.request.questions.selection.options).length !== 201)) throw new Error("Full-catalog option count mismatch.");
for (const file of ["cases.json", "labels.json", "corpus.json", "target-index.json"]) {
  if (hashFile(`inputs/${file}`) !== parentManifest.files[`inputs/${file}`]) throw new Error(`Parent input mismatch: ${file}`);
}
const corpus = json("inputs/corpus.json");
const targetIndex = json("inputs/target-index.json").targetIndex;
const catalog = corpus.documents.flatMap((document) => buildMssrMarkdownDocumentSurface({ sourceRef: document.sourceRef, markdown: document.markdown }).headings.map((heading) => JSON.stringify([document.sourceRef, heading.headingPath])));
const targetKeys = new Set(catalog);
const missingTargets = Object.values(targetIndex).filter((target) => !targetKeys.has(JSON.stringify([target.sourceRef, target.targetHeadingPath])));
if (catalog.length !== 200 || Object.keys(targetIndex).length !== 26 || missingTargets.length !== 0) throw new Error("Full-catalog target preflight failed.");
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src/document-surface.ts", "src/librarian-retrieval.ts", "src/semantic-curation-jev.ts"], { cwd: repository });
const buildArtifacts = ["dist/document-surface.js", "dist/librarian-retrieval.js", "dist/semantic-curation-jev.js"].map((path) => ({ path, sha256: hashFile(resolve(repository, path)) }));
const files = [
  "inputs/cases.json", "inputs/labels.json", "inputs/corpus.json", "inputs/target-index.json",
  "runner.mjs", "score.mjs", "finalize.mjs", "requests.json", "responses.json",
  "scored-records.json", "summary.json", "REPORT.md",
];
const fileHashes = Object.fromEntries(files.map((path) => [path, hashFile(path)]));
if (process.argv.includes("--verify")) {
  const manifest = json("manifest.json");
  const sums = new Map(readFileSync(resolve(root, "SHA256SUMS"), "utf8").trim().split(/\r?\n/).map((line) => {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    if (!match) throw new Error("Malformed SHA256SUMS line.");
    return [match[2], match[1]];
  }));
  for (const [path, hash] of Object.entries(manifest.files)) {
    if (fileHashes[path] !== hash || sums.get(path) !== hash) throw new Error(`Artifact hash mismatch: ${path}`);
  }
  if (sums.get("manifest.json") !== hashFile("manifest.json")) throw new Error("Manifest checksum mismatch.");
  process.stdout.write(JSON.stringify({ runId, status: "checksums-ok", files: sums.size }) + "\n");
  process.exit(0);
}
const manifest = {
  schemaVersion: 1,
  suite: "mssr-librarian-jev-full-heading-choice-v1",
  runId,
  parentRunId: parentManifest.runId,
  createdAt: new Date().toISOString(),
  status: summary.status,
  source: { repository: "MSSR", gitCommit: sourceCommit, inputSourceCommit: parentManifest.source.inputSourceCommit, workingTreeClean: false, documentSurfaceAndProviderSourceFilesUnmodified: true, buildArtifacts },
  runtime: process.version,
  provider: summary.provider,
  model: summary.model,
  credentialValuePersisted: false,
  rawVendorHttpBodiesPersisted: false,
  inputs: {
    corpusDocuments: corpus.documents.length,
    corpusSha256: fileHashes["inputs/corpus.json"],
    caseCount: json("inputs/cases.json").cases.length,
    casesSha256: fileHashes["inputs/cases.json"],
    labelsSha256: fileHashes["inputs/labels.json"],
    targetIndexSha256: fileHashes["inputs/target-index.json"],
  },
  execution: {
    retrievalCalls: 0,
    surfaceCatalogHeadings: 200,
    expectedTargetHeadingsPresentPreflight: Object.keys(targetIndex).length,
    jevCalls: responses.responses.length,
    successfulJevCalls: responses.responses.filter((item) => item.status === "success").length,
    failedJevCalls: responses.responses.filter((item) => item.status !== "success").length,
    choicesPerCall: 201,
    inputTokens: summary.totalInputTokens,
    outputTokens: summary.totalOutputTokens,
  },
  fetchAudit: {
    fullCatalog: {
      checks: summary.metrics.en.all.fullCatalogFetchChecks + summary.metrics.es.all.fullCatalogFetchChecks,
      passes: summary.metrics.en.all.fullCatalogFetchPasses + summary.metrics.es.all.fullCatalogFetchPasses,
      sizeLimitRejections: summary.metrics.en.all.fullCatalogFetchSizeLimitRejections + summary.metrics.es.all.fullCatalogFetchSizeLimitRejections,
      integrityFailures: summary.metrics.en.all.fullCatalogFetchIntegrityFailures + summary.metrics.es.all.fullCatalogFetchIntegrityFailures,
    },
    top100Shortlist: {
      checks: summary.metrics.en.all.top100FetchChecks + summary.metrics.es.all.top100FetchChecks,
      passes: summary.metrics.en.all.top100FetchPasses + summary.metrics.es.all.top100FetchPasses,
      sizeLimitRejections: summary.metrics.en.all.top100FetchSizeLimitRejections + summary.metrics.es.all.top100FetchSizeLimitRejections,
      integrityFailures: summary.metrics.en.all.top100FetchIntegrityFailures + summary.metrics.es.all.top100FetchIntegrityFailures,
    },
  },
  files: fileHashes,
};
writeFileSync(resolve(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const sums = files.concat("manifest.json").map((path) => `${hashFile(path)}  ${path}`).join("\n") + "\n";
writeFileSync(resolve(root, "SHA256SUMS"), sums, "utf8");
process.stdout.write(JSON.stringify({ runId, status: "manifest-written", files: files.length, sourceCommit, buildArtifacts }) + "\n");
