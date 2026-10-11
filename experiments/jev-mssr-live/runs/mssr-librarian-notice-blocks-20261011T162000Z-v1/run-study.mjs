import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const live = args.has("--allow-network");
if (dryRun === live) throw new Error("Pass exactly one of --dry-run or --allow-network.");
const manifest = JSON.parse(readFileSync(resolve(here, "manifest.json"), "utf8"));
if (manifest.status !== "frozen-pre-call") throw new Error("Manifest is not frozen-pre-call.");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const identity = JSON.parse(readFileSync(resolve(here, "run-identity.json"), "utf8"));
for (const [file, expected] of Object.entries(identity.fileSha256)) {
  if (hash(readFileSync(file)) !== expected.toLowerCase()) throw new Error("Frozen code/source identity mismatch: " + file);
}
const bridgeRoot = "D:/Dev/bridge-mcp-jev-cap-study";
const mssrRoot = "D:/Dev/mssr";
const bridgeHead = execFileSync("git", ["-C", bridgeRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const bridgeStatus = execFileSync("git", ["-C", bridgeRoot, "status", "--porcelain"], { encoding: "utf8" }).trim();
const mssrHead = execFileSync("git", ["-C", mssrRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (bridgeHead !== identity.bridgeCommit || bridgeStatus !== "" || mssrHead !== identity.mssrCommit) {
  throw new Error("Frozen Git source identity changed; provider calls refused.");
}
const cases = JSON.parse(readFileSync(resolve(here, "inputs/cases.json"), "utf8")).cases;
const schedule = JSON.parse(readFileSync(resolve(here, "schedule.json"), "utf8"));
const mssr = await import(pathToFileURL(resolve(mssrRoot, "dist/librarian-jev-selection.js")).href);
const retrieval = await import(pathToFileURL(resolve(mssrRoot, "dist/librarian-retrieval.js")).href);
const bridge = await import(pathToFileURL(resolve(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href);
const documents = new Map();
for (const item of cases) {
  if (documents.has(item.source)) continue;
  documents.set(item.source, {
    owner: "MSSR",
    sourceRef: item.sourceRef,
    markdown: readFileSync(resolve(here, "inputs/sources", `${item.source}.md`), "utf8"),
    privacyClass: "project-metadata",
  });
}
const casesById = new Map(cases.map((item) => [item.id, item]));
const rubric = JSON.parse(readFileSync(resolve(here, "adjudication/expected-rubric.json"), "utf8"));
const labels = new Map(rubric.labels.map((label) => [label.caseId, label]));
const requestsFile = resolve(here, "requests.jsonl");
const recordsFile = resolve(here, "records.jsonl");
if (live && (existsSync(requestsFile) || existsSync(recordsFile))) throw new Error("Refusing to overwrite existing live evidence.");
if (live) { writeFileSync(requestsFile, ""); writeFileSync(recordsFile, ""); }
const liveProvider = live ? bridge.createMssrJevBridgeDecisionProvider({ model: manifest.providerModel }) : null;
const results = [];

for (const caseId of schedule) {
  const item = casesById.get(caseId);
  if (!item) throw new Error("Schedule references unknown case.");
  const document = documents.get(item.source);
  const searched = retrieval.searchMssrLibrarianEvidence({
    documents: [document],
    query: { query: item.query, maxResults: manifest.search.maxResults },
  });
  const candidateHandles = searched.results.map((result) => result.handle);
  const expectedLines = labels.get(item.id).expectedRangeLines;
  const expectedIndex = candidateHandles.findIndex((handle) => handle.startLine === expectedLines[0] && handle.endLine === expectedLines[1]);
  if (expectedIndex < 0) throw new Error(`Expected exact range was not returned by search: ${item.id}`);
  const captured = [];
  const responses = [];
  const provider = {
    async executeSystemOne(request) {
      captured.push(JSON.parse(JSON.stringify(request)));
      if (dryRun) {
        const optionId = `h${String(expectedIndex + 1).padStart(3, "0")}`;
        const response = {
          provider: "offline-dry-run",
          model: manifest.providerModel,
          answers: {
            selection: { type: "choice", choice: optionId, confidence: 0.8 },
            sufficiency: { type: "noul", noul: 0.8 },
          },
          usage: { input_tokens: 0, output_tokens: 0 },
        };
        responses.push(response);
        return response;
      }
      const response = await liveProvider.executeSystemOne(request);
      responses.push(JSON.parse(JSON.stringify(response)));
      return response;
    },
  };
  const startedAt = new Date().toISOString();
  const selected = await mssr.selectMssrLibrarianEvidenceWithJev({
    documents: [document],
    candidateHandles,
    query: item.query,
    model: manifest.providerModel,
  }, provider);
  const finishedAt = new Date().toISOString();
  if (captured.length !== 1 || selected.providerCalls !== 1) throw new Error(`Expected one selector call for ${item.id}`);
  let exactFetch = null;
  if (selected.selected?.handle) {
    const fetched = retrieval.fetchMssrLibrarianEvidence({
      handle: selected.selected.handle,
      owner: document.owner,
      sourceRef: document.sourceRef,
      markdown: document.markdown,
      privacyClass: document.privacyClass,
    });
    exactFetch = {
      text: fetched.text,
      fingerprint: fetched.fingerprint,
      handleFingerprint: selected.selected.handle.fingerprint,
      fingerprintMatched: fetched.fingerprint === selected.selected.handle.fingerprint,
      rangeCodeUnits: fetched.text.length,
      lines: [selected.selected.handle.startLine, selected.selected.handle.endLine],
      rangeKind: selected.selected.handle.rangeKind,
    };
    if (!exactFetch.fingerprintMatched) throw new Error(`Exact fetch fingerprint failed for ${item.id}`);
  }
  const request = {
    caseId,
    request: captured[0],
    candidateHandles: candidateHandles.map((handle) => ({
      id: handle.id,
      rangeKind: handle.rangeKind,
      lines: [handle.startLine, handle.endLine],
      chars: handle.endOffset - handle.startOffset,
    })),
  };
  const record = {
    caseId,
    startedAt,
    finishedAt,
    elapsedWallMs: Date.parse(finishedAt) - Date.parse(startedAt),
    search: {
      query: item.query,
      maxResults: manifest.search.maxResults,
      returned: candidateHandles.length,
      expectedRangeRank: expectedIndex + 1,
    },
    selector: selected,
    exactFetch,
    providerResponse: responses[0],
  };
  if (live) {
    appendFileSync(requestsFile, JSON.stringify(request) + "\n");
    appendFileSync(recordsFile, JSON.stringify(record) + "\n");
  }
  results.push({ request, record });
}

if (dryRun) {
  const summary = results.map(({ request, record }) => ({
    caseId: record.caseId,
    candidateCount: request.candidateHandles.length,
    expectedRangeRank: record.search.expectedRangeRank,
    expectedHandleOffered: request.candidateHandles.some((handle) => {
      const expected = labels.get(record.caseId).expectedRangeLines;
      return handle.lines[0] === expected[0] && handle.lines[1] === expected[1];
    }),
    status: record.selector.status,
    selectedLines: record.selector.selected?.handle ? [record.selector.selected.handle.startLine, record.selector.selected.handle.endLine] : null,
    selectedRangeKind: record.selector.selected?.handle?.rangeKind ?? null,
    providerCalls: record.selector.providerCalls,
  }));
  writeFileSync(resolve(here, "dry-run-report.json"), JSON.stringify({ status: "dry-run-passed-no-provider-calls", providerCalls: 0, cases: summary }, null, 2) + "\n");
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} else {
  const completion = {
    schemaVersion: 1,
    runId: manifest.runId,
    manifestSha256: hash(readFileSync(resolve(here, "manifest.json"))),
    status: results.length === cases.length ? "complete" : "partial",
    expectedRequests: cases.length,
    attemptedRequests: results.length,
    providerCalls: results.length,
    completedCaseIds: results.map(({ record }) => record.caseId),
    productionRuntimeTouched: false,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(here, "run-completion.json"), JSON.stringify(completion, null, 2) + "\n");
  process.stdout.write(JSON.stringify(completion, null, 2) + "\n");
}
