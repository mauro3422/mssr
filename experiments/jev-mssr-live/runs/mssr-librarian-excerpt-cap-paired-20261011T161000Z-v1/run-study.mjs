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
for (const [path, expected] of Object.entries(identity.fileSha256)) {
  if (hash(readFileSync(path)) !== expected.toLowerCase()) throw new Error("Frozen code identity mismatch: " + path);
}
const bridgeHead = execFileSync("git", ["-C", "D:/Dev/bridge-mcp-jev-cap-study", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const bridgeStatus = execFileSync("git", ["-C", "D:/Dev/bridge-mcp-jev-cap-study", "status", "--porcelain"], { encoding: "utf8" }).trim();
const mssrHead = execFileSync("git", ["-C", "D:/Dev/mssr", "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (bridgeHead !== identity.bridgeCommit || bridgeStatus !== "" || mssrHead !== identity.mssrCommit) {
  throw new Error("Frozen Git source identity changed; provider calls refused.");
}
const casesDoc = JSON.parse(readFileSync(resolve(here, "inputs/cases.json"), "utf8"));
const schedule = JSON.parse(readFileSync(resolve(here, "schedule.json"), "utf8"));
const mssrRoot = "D:/Dev/mssr";
const bridgeRoot = "D:/Dev/bridge-mcp-jev-cap-study";
const mssr = await import(pathToFileURL(resolve(mssrRoot, "dist/librarian-jev-selection.js")).href);
const bridge = await import(pathToFileURL(resolve(bridgeRoot, "dist/tools/mssr-semantic-evidence-tools.js")).href);
const retrieval = await import(pathToFileURL(resolve(mssrRoot, "dist/librarian-retrieval.js")).href);
const limits = mssr.MSSR_LIBRARIAN_JEV_SELECTION_LIMITS;
const originalCap = limits.maxExcerptChars;
const casesById = new Map(casesDoc.cases.map((item) => [item.id, item]));
const completed = [];
const drySummaries = [];
const requestPath = resolve(here, "requests.jsonl");
const recordsPath = resolve(here, "records.jsonl");
if (live && (existsSync(requestPath) || existsSync(recordsPath))) {
  throw new Error("Refusing to overwrite existing live evidence.");
}
if (live) {
  writeFileSync(requestPath, "");
  writeFileSync(recordsPath, "");
}
const parseEvidence = (entry) => JSON.parse(entry.text);
const canonicalRequestWithoutExcerpt = (request) => ({
  ...request,
  state: {
    ...request.state,
    evidence: request.state.evidence.map((entry) => {
      const parsed = parseEvidence(entry);
      parsed[3] = "<excerpt>";
      return { ...entry, text: JSON.stringify(parsed) };
    }),
  },
});
const labelByCase = dryRun
  ? new Map(JSON.parse(readFileSync(resolve(here, "adjudication/expected-rubric.json"), "utf8")).labels.map((item) => [item.caseId, item]))
  : new Map();

for (const slot of schedule) {
  const item = casesById.get(slot.caseId);
  if (!item) throw new Error("Schedule references unknown case.");
  const sourceFile = resolve(here, "inputs/sources", item.source + ".md");
  const markdown = readFileSync(sourceFile, "utf8");
  const sourceRecord = manifest.sourceHashes.find((source) => source.id === item.source);
  if (!sourceRecord || hash(readFileSync(sourceFile)) !== sourceRecord.sha.toLowerCase()) {
    throw new Error("Frozen source snapshot hash mismatch for " + item.source);
  }
  const document = {
    owner: "MSSR",
    sourceRef: item.sourceRef,
    markdown,
    privacyClass: "project-metadata",
  };
  const pairRequests = [];
  const pairResults = [];

  for (const cap of slot.arms) {
    if (cap !== 260 && cap !== 780) throw new Error("Unexpected cap arm.");
    limits.maxExcerptChars = cap;
    const capturedRequests = [];
    const capturedResponses = [];
    const liveProvider = live
      ? bridge.createMssrJevBridgeDecisionProvider({ model: manifest.providerModel })
      : null;
    const provider = {
      async executeSystemOne(request) {
        capturedRequests.push(JSON.parse(JSON.stringify(request)));
        if (dryRun) {
          const keys = Object.keys(request.questions.selection.options);
          const none = keys.includes("none") ? "none" : keys[0];
          const response = {
            provider: "offline-dry-run",
            model: manifest.providerModel,
            answers: {
              selection: { type: "choice", choice: none, confidence: 0.5 },
              sufficiency: { type: "noul", noul: 0.5 },
            },
            usage: { input_tokens: 0, output_tokens: 0 },
          };
          capturedResponses.push(response);
          return response;
        }
        const response = await liveProvider.executeSystemOne(request);
        capturedResponses.push(JSON.parse(JSON.stringify(response)));
        return response;
      },
    };
    const startedAt = new Date().toISOString();
    let result;
    let error = null;
    try {
      result = await mssr.selectMssrLibrarianEvidenceWithJev(
        { documents: [document], query: item.query, model: manifest.providerModel },
        provider,
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "unknown-error";
    }
    const finishedAt = new Date().toISOString();
    if (capturedRequests.length !== 1) {
      throw new Error("Expected exactly one selector request for " + item.id + " cap " + cap + "; got " + capturedRequests.length);
    }
    const request = capturedRequests[0];
    const excerpts = request.state.evidence.map((entry) => {
      const parsed = parseEvidence(entry);
      return {
        id: entry.id,
        owner: parsed[0],
        sourceRef: parsed[1],
        headingPath: parsed[2],
        excerptCodePoints: Array.from(parsed[3]).length,
        excerptUtf16: parsed[3].length,
        excerptSha256: hash(parsed[3]),
        rangeKind: parsed[4],
      };
    });
    const requestRecord = {
      caseId: item.id,
      cap,
      request,
      requestJsonChars: JSON.stringify(request).length,
      excerpts,
    };
    let exactFetch = null;
    if (result?.selected?.handle) {
      const fetched = retrieval.fetchMssrLibrarianEvidence({
        handle: result.selected.handle,
        owner: document.owner,
        sourceRef: document.sourceRef,
        markdown: document.markdown,
        privacyClass: document.privacyClass,
      });
      exactFetch = {
        text: fetched.text,
        fingerprint: fetched.fingerprint,
        handleFingerprint: result.selected.handle.fingerprint,
        fingerprintMatched: fetched.fingerprint === result.selected.handle.fingerprint,
        rangeCodeUnits: fetched.text.length,
      };
      if (!exactFetch.fingerprintMatched) throw new Error("Selected handle fingerprint failed exact fetch for " + item.id);
    }
    pairRequests.push(requestRecord);
    pairResults.push({
      caseId: item.id,
      cap,
      startedAt,
      finishedAt,
      elapsedWallMs: Date.parse(finishedAt) - Date.parse(startedAt),
      selector: result ?? null,
      exactFetch,
      providerResponse: capturedResponses[0] ?? null,
      safeError: error,
    });

    if (live) {
      appendFileSync(requestPath, JSON.stringify(requestRecord) + "\n");
      appendFileSync(recordsPath, JSON.stringify(pairResults[pairResults.length - 1]) + "\n");
    }
  }

  if (pairRequests.length !== 2) throw new Error("Incomplete pair.");
  const first = pairRequests[0].request;
  const second = pairRequests[1].request;
  if (JSON.stringify(canonicalRequestWithoutExcerpt(first)) !== JSON.stringify(canonicalRequestWithoutExcerpt(second))) {
    throw new Error("Paired request differs outside excerpt text for " + item.id);
  }
  if (pairResults.some((record) => record.safeError)) {
    if (live) continue;
    throw new Error("Dry run failed.");
  }
  if (pairResults.some((record) => record.selector?.selectionMode !== "single-pass" || record.selector?.providerCalls !== 1)) {
    throw new Error("Selector was not single-pass / one provider call for " + item.id);
  }
  const label = labelByCase.get(item.id);
  if (dryRun) {
    const targetPath = label.expectedHeadingPath.join(" / ");
    for (const requestRecord of pairRequests) {
      const target = requestRecord.excerpts.find((excerpt) => excerpt.headingPath.slice(-label.expectedHeadingPath.length).join(" / ") === targetPath);
      if (!target) throw new Error("Expected target heading not offered: " + item.id + " / " + targetPath);
      const requiredLength = requestRecord.cap === 780 ? 780 : 260;
      if (target.excerptCodePoints < requiredLength) {
        throw new Error("Target excerpt did not reach the frozen cap; redesign case before provider calls: " + item.id + " cap " + requestRecord.cap + " len " + target.excerptCodePoints);
      }
    }
    drySummaries.push({
      caseId: item.id,
      targetHeadingPath: label.expectedHeadingPath,
      candidateCount: pairRequests[0].excerpts.length,
      targetExcerptLengths: pairRequests.map((request) => ({
        cap: request.cap,
        excerptCodePoints: request.excerpts.find((entry) => entry.headingPath.slice(-label.expectedHeadingPath.length).join(" / ") === targetPath).excerptCodePoints,
        requestJsonChars: request.requestJsonChars,
      })),
      allCandidatesOfferedInSameOrder: pairRequests[0].excerpts.map((entry) => entry.id).join(",") === pairRequests[1].excerpts.map((entry) => entry.id).join(","),
    });
  }
  completed.push(item.id);
}
limits.maxExcerptChars = originalCap;

if (dryRun) {
  const report = {
    status: "dry-run-passed-no-provider-calls",
    caseCount: completed.length,
    providerCalls: 0,
    cases: drySummaries,
  };
  writeFileSync(resolve(here, "dry-run-report.json"), JSON.stringify(report, null, 2) + "\n");
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  const expected = casesDoc.cases.length;
  const status = completed.length === expected ? "complete" : "partial";
  const completion = {
    schemaVersion: 1,
    runId: manifest.runId,
    status,
    expectedPairs: expected,
    completedPairs: completed.length,
    providerCalls: completed.reduce((sum, id) => sum + 2, 0),
    completedCaseIds: completed,
    productionRuntimeTouched: false,
    finishedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(here, "run-completion.json"), JSON.stringify(completion, null, 2) + "\n");
  process.stdout.write(JSON.stringify(completion, null, 2) + "\n");
}
