import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const repository = resolve(root, "../../../../");
const runId = "mssr-librarian-jev-candidate-selection-20260930-v1";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const bytes = (path) => readFileSync(resolve(root, path));
const json = (path) => JSON.parse(bytes(path).toString("utf8"));
const hashFile = (path) => sha256(bytes(path));

const parent = resolve(root, "../mssr-librarian-bilingual-retrieval-20260930-v1");
const parentManifest = JSON.parse(readFileSync(resolve(parent, "manifest.json"), "utf8"));
const summary = json("summary.json");
const responses = json("responses.json");
const requests = json("requests.json");
if (summary.runId !== runId || responses.runId !== runId || requests.runId !== runId) throw new Error("Run identity mismatch.");
if (summary.status !== "complete" || responses.responses.length !== 52 || responses.responses.some((item) => item.status !== "success")) throw new Error("Live responses are incomplete.");
if (requests.sourceLabelFileRead !== false || requests.requests.length !== 52) throw new Error("Request provenance is invalid.");
if (requests.requests.some((item) => Object.keys(item.request.questions.selection.options).length !== 101)) throw new Error("Candidate option count mismatch.");
for (const file of ["cases.json", "labels.json", "corpus.json", "target-index.json"]) {
  if (hashFile(`inputs/${file}`) !== parentManifest.files[`inputs/${file}`]) throw new Error(`Parent input mismatch: ${file}`);
}
const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repository, encoding: "utf8" }).trim();
execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src/librarian-retrieval.ts", "src/document-surface.ts", "src/semantic-curation-jev.ts"], { cwd: repository });
const sourceBuilds = [
  "dist/librarian-retrieval.js",
  "dist/document-surface.js",
  "dist/semantic-curation-jev.js",
].map((path) => ({ path, sha256: hashFile(resolve(repository, path)) }));
const files = [
  "inputs/cases.json", "inputs/labels.json", "inputs/corpus.json", "inputs/target-index.json",
  "runner.mjs", "score.mjs", "finalize.mjs", "requests.json", "responses.json",
  "scored-records.json", "summary.json", "REPORT.md",
];
const fileHashes = Object.fromEntries(files.map((path) => [path, hashFile(path)]));
if (process.argv.includes("--verify")) {
  const manifest = json("manifest.json");
  const sumLines = readFileSync(resolve(root, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  const sums = new Map(sumLines.map((line) => {
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
  suite: "mssr-librarian-jev-candidate-selection-v1",
  runId,
  parentRunId: parentManifest.runId,
  createdAt: new Date().toISOString(),
  status: summary.status,
  source: {
    repository: "MSSR",
    gitCommit: sourceCommit,
    inputSourceCommit: parentManifest.source.gitCommit,
    workingTreeClean: false,
    retrievalAndProviderSourceFilesUnmodified: true,
    buildArtifacts: sourceBuilds,
  },
  runtime: process.version,
  provider: summary.provider,
  model: summary.model,
  credentialValuePersisted: false,
  rawVendorHttpBodiesPersisted: false,
  inputs: {
    corpusDocuments: json("inputs/corpus.json").documents.length,
    corpusSha256: fileHashes["inputs/corpus.json"],
    caseCount: json("inputs/cases.json").cases.length,
    casesSha256: fileHashes["inputs/cases.json"],
    labelsSha256: fileHashes["inputs/labels.json"],
    targetIndexSha256: fileHashes["inputs/target-index.json"],
  },
  execution: {
    retrievalCalls: 52,
    jevCalls: responses.responses.length,
    successfulJevCalls: responses.responses.filter((item) => item.status === "success").length,
    failedJevCalls: responses.responses.filter((item) => item.status !== "success").length,
    maxCandidates: 100,
    choiceOptionsPerCall: 101,
    inputTokens: summary.totalInputTokens,
    outputTokens: summary.totalOutputTokens,
  },
  groupedHoldout: json("../mssr-librarian-bilingual-retrieval-20260930-v1/summary.json").groupedHoldout,
  files: fileHashes,
};
writeFileSync(resolve(root, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const sums = files.concat("manifest.json").map((path) => `${hashFile(path)}  ${path}`).join("\n") + "\n";
writeFileSync(resolve(root, "SHA256SUMS"), sums, "utf8");
process.stdout.write(JSON.stringify({ runId, status: "manifest-written", files: files.length, sourceCommit, sourceBuilds }) + "\n");
