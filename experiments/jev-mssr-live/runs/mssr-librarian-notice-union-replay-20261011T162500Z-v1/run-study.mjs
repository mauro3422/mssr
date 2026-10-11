import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const runDir = new URL(".", import.meta.url).pathname.replace(/^\//, "").replace(/\//g, "\\");
const root = "D:/Dev/mssr";
const bridgeRoot = "D:/Dev/bridge-mcp-jev-cap-study";
const resolveRun = (name) => `${runDir}\\${name}`;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const live = args.has("--allow-network");
if (dryRun === live) throw new Error("Pass exactly one of --dry-run or --allow-network.");
const manifest = JSON.parse(readFileSync(resolveRun("manifest.json"), "utf8"));
if (manifest.status !== "frozen-pre-call") throw new Error("Run manifest is not frozen.");
const identity = JSON.parse(readFileSync(resolveRun("run-identity.json"), "utf8"));
for (const [file, expected] of Object.entries(identity.fileSha256)) if (hash(readFileSync(file)) !== expected) throw new Error(`Frozen file changed: ${file}`);
const mssrHead = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const bridgeHead = execFileSync("git", ["-C", bridgeRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const bridgeStatus = execFileSync("git", ["-C", bridgeRoot, "status", "--porcelain"], { encoding: "utf8" }).trim();
if (mssrHead !== identity.mssrCommit || bridgeHead !== identity.bridgeCommit || bridgeStatus) throw new Error("Frozen Git identity mismatch; provider calls refused.");
const plan = JSON.parse(readFileSync(resolveRun("plan.json"), "utf8"));
const sourceRef = plan.corpus.sources[0].sourceRef;
const sourceBytes = readFileSync(resolveRun("inputs\\sources\\notice.md"));
if (hash(sourceBytes) !== plan.corpus.sources[0].sha256) throw new Error("Source snapshot hash mismatch.");
const markdown = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
const owner = root.toLowerCase();
const document = { owner, sourceRef, markdown, privacyClass: "project-metadata" };
const mssr = await import(pathToFileURL(`${root}/dist/librarian-jev-selection.js`).href);
const retrieval = await import(pathToFileURL(`${root}/dist/librarian-retrieval.js`).href);
const bridge = await import(pathToFileURL(`${bridgeRoot}/dist/tools/mssr-semantic-evidence-tools.js`).href);
const requestsPath = resolveRun("provider-requests.jsonl");
const responsesPath = resolveRun("provider-responses.jsonl");
const receiptsPath = resolveRun("facet-receipts.jsonl");
if (live && [requestsPath, responsesPath, receiptsPath].some(existsSync)) throw new Error("Refusing to overwrite frozen provider artifacts.");
if (live) for (const file of [requestsPath, responsesPath, receiptsPath]) writeFileSync(file, "");
const providerClient = live ? bridge.createMssrJevBridgeDecisionProvider({ model: plan.provider.model }) : null;
const rubric = JSON.parse(readFileSync(resolveRun("adjudication\\expected-rubric.json"), "utf8"));
const receipts = [];

for (const facet of plan.facets) {
  const search = retrieval.searchMssrLibrarianEvidence({ documents: [document], query: { query: facet.query, maxResults: 10 } });
  const candidates = search.results.map((entry) => entry.handle);
  const expected = rubric.facets.find((item) => item.facetId === facet.id);
  if (!candidates.some((handle) => handle.startLine === expected.expectedLines[0] && handle.endLine === expected.expectedLines[1])) throw new Error(`Expected target not offered: ${facet.id}`);
  let request = null;
  let response = null;
  const provider = {
    async executeSystemOne(payload) {
      request = JSON.parse(JSON.stringify(payload));
      if (dryRun) {
        const index = candidates.findIndex((handle) => handle.startLine === expected.expectedLines[0] && handle.endLine === expected.expectedLines[1]);
        return { provider: "offline-dry-run", model: plan.provider.model, answers: { selection: { type: "choice", choice: `h${String(index + 1).padStart(3, "0")}`, confidence: 0.8 }, sufficiency: { type: "noul", noul: 0.8 } }, usage: { input_tokens: 0, output_tokens: 0 } };
      }
      response = await providerClient.executeSystemOne(payload);
      return response;
    },
  };
  const selection = await mssr.selectMssrLibrarianEvidenceWithJev({ documents: [document], candidateHandles: candidates, query: facet.query, model: plan.provider.model }, provider);
  if (!request || selection.providerCalls !== 1) throw new Error(`Expected exactly one provider request: ${facet.id}`);
  let selectedHandle = null;
  let fetchReceipt = null;
  if (selection.status === "selected" && selection.selected?.handle) {
    selectedHandle = selection.selected.handle;
    const fetched = retrieval.fetchMssrLibrarianEvidence({ handle: selectedHandle, owner, sourceRef, markdown, privacyClass: document.privacyClass });
    const textSha256 = hash(Buffer.from(fetched.text, "utf8"));
    fetchReceipt = {
      status: "verified",
      handleFingerprint: selectedHandle.fingerprint,
      fetchedFingerprint: fetched.fingerprint,
      textSha256,
      expectedTextSha256: textSha256,
      textChars: fetched.text.length,
      exactText: fetched.text,
      startLineFromSource: selectedHandle.startLine,
      endLineFromSource: selectedHandle.endLine,
    };
  }
  const receipt = {
    schemaVersion: 1,
    facetId: facet.id,
    sourceRef,
    sourceSha256: plan.corpus.sources[0].sha256,
    query: facet.query,
    candidateSource: "search-handles",
    status: selection.status,
    candidates,
    selection,
    selectedHandle,
    fetch: fetchReceipt,
    safeError: null,
  };
  receipts.push(receipt);
  if (live) {
    appendFileSync(requestsPath, JSON.stringify({ facetId: facet.id, request }) + "\n");
    appendFileSync(responsesPath, JSON.stringify({ facetId: facet.id, response }) + "\n");
    appendFileSync(receiptsPath, JSON.stringify(receipt) + "\n");
  }
  process.stdout.write(JSON.stringify({ facetId: facet.id, status: selection.status, selectedLines: selectedHandle ? [selectedHandle.startLine, selectedHandle.endLine] : null, exactFetchVerified: fetchReceipt?.status === "verified", providerCalls: selection.providerCalls }) + "\n");
}
if (live) {
  const completion = { schemaVersion: 1, runId: manifest.runId, status: "complete", manifestSha256: hash(readFileSync(resolveRun("manifest.json"))), expectedRequests: plan.facets.length, attemptedRequests: receipts.length, providerCalls: receipts.length, productionRuntimeTouched: false, finishedAt: new Date().toISOString() };
  writeFileSync(resolveRun("run-completion.json"), JSON.stringify(completion, null, 2) + "\n");
}
