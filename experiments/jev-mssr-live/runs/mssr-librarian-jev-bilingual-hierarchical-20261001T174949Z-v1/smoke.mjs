import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fetchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";

const runRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(runRoot, "../../../../");
const caseSet = JSON.parse(readFileSync(resolve(runRoot, "inputs/cases.json"), "utf8"));
const corpus = JSON.parse(readFileSync(resolve(runRoot, "inputs/corpus.json"), "utf8"));
const sourceDocs = corpus.documents.map(({ owner, sourceRef, markdown, privacyClass }) => ({ owner, sourceRef, markdown, privacyClass }));
const testCase = caseSet.cases[0];
const query = testCase.es;
const launcher = "C:\\Users\\mauro\\.codex\\scripts\\mssr-jev-credential-launcher.mjs";
const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: repoRoot, stderr: "pipe" });
let stderrSummary = "";
transport.stderr?.on("data", (chunk) => { stderrSummary += chunk.toString().slice(0, 4_000); });
const client = new Client({ name: "mssr-librarian-jev-benchmark-smoke", version: "1.0.0" }, { capabilities: {} });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
let stage = "connect";
let providerFailureClass = null;
let safeResult;
try {
  await client.connect(transport);
  stage = "tool-inventory";
  const inventory = await client.listTools();
  if (!inventory.tools.some((tool) => tool.name === "mssr_librarian_jev_select")) throw new Error("selector-tool-missing");
  stage = "live-provider-call";
  const started = performance.now();
  const result = await client.callTool({
    name: "mssr_librarian_jev_select",
    arguments: { documents: sourceDocs, query, model: "jev-1.13.0" },
  });
  if (result.isError) {
    const errorText = result.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") ?? "";
    providerFailureClass = /credential|api.?key|unauthori[sz]ed|forbidden/i.test(errorText) ? "credential-or-authentication"
      : /rate.?limit|429|quota/i.test(errorText) ? "rate-limited"
        : /timeout|timed out/i.test(errorText) ? "timeout"
          : /network|fetch|ECONN|ENOTFOUND/i.test(errorText) ? "network"
            : /invalid|schema|choice|noul|answer/i.test(errorText) ? "provider-response-or-schema"
              : "provider-call-error";
    throw new Error("selector-tool-error");
  }
  stage = "parse-provider-result";
  const text = result.content?.find((item) => item.type === "text")?.text;
  if (!text) throw new Error("selector-returned-no-payload");
  const payload = JSON.parse(text);
  if (payload.status === "not-run") {
    providerFailureClass = `selector-not-run-${String(payload.reason ?? "unknown").replace(/[^a-z0-9-]/gi, "").slice(0, 60)}`;
    throw new Error("selector-not-run");
  }
  if (!payload.jevCallMade || payload.providerCalls !== 1 || payload.selectionMode !== "single-pass" || payload.candidateCount !== 200) {
    providerFailureClass = "selector-output-shape-mismatch";
    throw new Error("selector-output-does-not-match-current-build");
  }
  if (typeof payload.evidenceSufficiency !== "number") {
    providerFailureClass = "selector-noul-answer-missing";
    throw new Error("selector-did-not-return-noul-sufficiency");
  }
  stage = "exact-fetch";
  let exactFetch = "not-selected";
  if (payload.selected?.handle) {
    const selectedSource = sourceDocs.find((document) => document.owner === payload.selected.handle.owner && document.sourceRef === payload.selected.handle.sourceRef);
    if (!selectedSource) throw new Error("selected-source-not-in-explicit-corpus");
    try {
      const fetched = fetchMssrLibrarianEvidence({ handle: payload.selected.handle, owner: selectedSource.owner, sourceRef: selectedSource.sourceRef, markdown: selectedSource.markdown, privacyClass: selectedSource.privacyClass });
      exactFetch = fetched.fingerprint === payload.selected.handle.fingerprint ? "passed" : "fingerprint-mismatch";
    } catch {
      exactFetch = "rejected";
    }
  }
  safeResult = {
    runId: "mssr-librarian-jev-bilingual-hierarchical-20261001T174949Z-v1",
    status: "complete",
    sourceLabelFileRead: false,
    corpusDocuments: sourceDocs.length,
    offeredCandidates: payload.candidateCount,
    queryLanguage: "es",
    provider: payload.provider,
    model: payload.model,
    selectionMode: payload.selectionMode,
    providerCalls: payload.providerCalls,
    choiceConfidence: payload.providerConfidence,
    evidenceSufficiency: payload.evidenceSufficiency,
    confidenceCalibration: payload.confidenceCalibration,
    exactFetch,
    requestFingerprint: payload.requestFingerprint,
    usage: payload.usage,
    elapsedMs: Number((performance.now() - started).toFixed(1)),
    rawVendorHttpBodiesPersisted: false,
    credentialValuePersisted: false,
    distSha256: sha256(readFileSync(resolve(repoRoot, "dist/librarian-jev-selection.js"))),
  };
} catch (error) {
  const code = String(error?.message ?? "unknown");
  safeResult = {
    runId: "mssr-librarian-jev-bilingual-hierarchical-20261001T174949Z-v1",
    status: "failed",
    failureClass: providerFailureClass ?? (/credential|api.?key|unauthori[sz]ed/i.test(code) || /credential unavailable/i.test(stderrSummary) ? "credential-or-authentication"
      : /rate.?limit|429|quota/i.test(code) ? "rate-limited"
        : /timeout|timed out/i.test(code) ? "timeout"
          : /network|fetch|ECONN|ENOTFOUND/i.test(code) ? "network"
            : "provider-or-tool-contract"),
    errorType: error?.name ?? "Error",
    stage,
    mcpToolRegistered: !/selector-tool-missing/.test(code),
    launcherMissingCredentialNotice: /credential unavailable/i.test(stderrSummary),
    sourceLabelFileRead: false,
    rawVendorHttpBodiesPersisted: false,
    credentialValuePersisted: false,
  };
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}

writeFileSync(resolve(runRoot, "smoke-result.json"), `${JSON.stringify(safeResult, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(safeResult)}\n`);
