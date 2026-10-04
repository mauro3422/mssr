import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fetchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";

const runId = "mssr-librarian-jev-bilingual-80k-singlepass-20261001T182504Z-v1";
const runRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(runRoot, "../../../../");
const inputRoot = resolve(runRoot, "inputs");
const cases = JSON.parse(readFileSync(resolve(inputRoot, "cases.json"), "utf8"));
const corpus = JSON.parse(readFileSync(resolve(inputRoot, "corpus.json"), "utf8"));
const documents = corpus.documents.map(({ owner, sourceRef, markdown, privacyClass }) => ({ owner, sourceRef, markdown, privacyClass }));
const bySource = new Map(documents.map((document) => [`${document.owner}\u0000${document.sourceRef}`, document]));
const launcher = "C:\\Users\\mauro\\.codex\\scripts\\mssr-jev-credential-launcher.mjs";
const model = "jev-1.13.0";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const writeJson = (name, value) => writeFileSync(resolve(runRoot, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

if (existsSync(resolve(runRoot, "responses.json"))) throw new Error("Refusing to overwrite an existing run response file.");
if (cases.cases.length !== 26 || documents.length !== 21) throw new Error("Frozen case/corpus inventory mismatch.");
if (cases.cases.some((item) => !item.en || !item.es)) throw new Error("Frozen query input is incomplete.");
const totalHeadings = documents.reduce((sum, document) => sum + document.markdown.split("\n").filter((line) => /^ {0,3}#{1,6}\s+\S/.test(line)).length, 0);
if (totalHeadings !== 200) throw new Error(`Frozen heading inventory mismatch: ${totalHeadings}.`);

// Intentionally do not read labels.json or target-index.json until all provider calls are closed.
const records = [];
const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: repoRoot, stderr: "pipe" });
let stderrSummary = "";
transport.stderr?.on("data", (chunk) => { stderrSummary += chunk.toString().slice(0, 8_000); });
const client = new Client({ name: "mssr-bilingual-jev-benchmark", version: "1.0.0" }, { capabilities: {} });
const allInputs = [];
for (const item of cases.cases) {
  for (const language of ["en", "es"]) {
    allInputs.push({ caseId: item.id, language, query: item[language] });
  }
}

const classifyFailure = (value) => /credential|api.?key|unauthori[sz]ed|forbidden/i.test(value) || /credential unavailable/i.test(stderrSummary) ? "credential-or-authentication"
  : /rate.?limit|429|quota/i.test(value) ? "rate-limited"
    : /timeout|timed out|abort/i.test(value) ? "timeout"
      : /network|fetch|ECONN|ENOTFOUND/i.test(value) ? "network"
        : /schema|invalid response|choice|noul/i.test(value) ? "provider-response-or-schema"
          : "provider-call-error";

function fetchStatus(payload) {
  const selected = payload.selected;
  if (!selected?.handle) return "not-selected";
  const source = bySource.get(`${selected.handle.owner}\u0000${selected.handle.sourceRef}`);
  if (!source) return "source-not-in-frozen-corpus";
  try {
    const exact = fetchMssrLibrarianEvidence({
      handle: selected.handle,
      owner: source.owner,
      sourceRef: source.sourceRef,
      markdown: source.markdown,
      privacyClass: source.privacyClass,
    });
    if (exact.fingerprint !== selected.handle.fingerprint) return "fingerprint-mismatch";
    if (exact.text.length !== selected.handle.endOffset - selected.handle.startOffset) return "range-size-mismatch";
    return "passed";
  } catch (error) {
    return /fetch size limit/i.test(String(error?.message ?? "")) ? "limit-exceeded" : "rejected";
  }
}

const startedAt = new Date().toISOString();
let toolAvailable = false;
try {
  await client.connect(transport);
  const toolList = await client.listTools();
  toolAvailable = toolList.tools.some((tool) => tool.name === "mssr_librarian_jev_select");
  if (!toolAvailable) throw new Error("selector-tool-missing");

  for (const item of allInputs) {
    const start = performance.now();
    try {
      const result = await client.callTool({
        name: "mssr_librarian_jev_select",
        arguments: { documents, query: item.query, model },
      });
      if (result.isError) {
        const errorText = result.content?.filter((content) => content.type === "text").map((content) => content.text).join("\n") ?? "";
        records.push({ caseId: item.caseId, language: item.language, status: "failed", failureClass: classifyFailure(errorText), elapsedMs: Number((performance.now() - start).toFixed(1)) });
      } else {
        const output = result.content?.find((content) => content.type === "text")?.text;
        if (!output) throw new Error("provider-returned-no-payload");
        const payload = JSON.parse(output);
        const common = {
          caseId: item.caseId,
          language: item.language,
          status: payload.status,
          reason: payload.reason ?? null,
          candidateCount: payload.candidateCount,
          finalistCount: payload.finalistCount ?? payload.candidateCount,
          selectionMode: payload.selectionMode ?? "legacy-single-pass",
          batchAssessments: payload.batchAssessments ?? null,
          providerCalls: payload.providerCalls ?? (payload.jevCallMade ? 1 : 0),
          providerConfidence: payload.providerConfidence ?? null,
          evidenceSufficiency: payload.evidenceSufficiency ?? null,
          provider: payload.provider ?? null,
          model: payload.model ?? null,
          providersUsed: payload.providersUsed ?? [payload.provider].filter(Boolean),
          modelsUsed: payload.modelsUsed ?? [payload.model].filter(Boolean),
          usage: payload.usage ?? null,
          requestFingerprint: payload.requestFingerprint ?? null,
          elapsedMs: Number((performance.now() - start).toFixed(1)),
          exactFetch: fetchStatus(payload),
          selected: payload.selected?.handle ? {
            title: payload.selected.title,
            headingPath: payload.selected.headingPath,
            sourceRef: payload.selected.handle.sourceRef,
            rangeId: payload.selected.handle.rangeId,
            rangeKind: payload.selected.handle.rangeKind,
            handleId: payload.selected.handle.id,
          } : null,
        };
        records.push(common);
      }
    } catch (error) {
      records.push({ caseId: item.caseId, language: item.language, status: "failed", failureClass: classifyFailure(String(error?.message ?? "")), errorType: error?.name ?? "Error", elapsedMs: Number((performance.now() - start).toFixed(1)) });
    }

    const snapshot = {
      schemaVersion: 1,
      runId,
      status: records.length === allInputs.length ? "complete" : "in-progress",
      provider: "typesafe-jev",
      model,
      sourceLabelFileRead: false,
      rawVendorHttpBodiesPersisted: false,
      credentialValuePersisted: false,
      records,
    };
    writeJson("responses.json", snapshot);
    if (records.length % 5 === 0 || records.length === allInputs.length) {
      const succeeded = records.filter((row) => row.status === "selected" || row.status === "abstained").length;
      process.stdout.write(`jev_bilingual_progress completed=${records.length}/${allInputs.length} successful=${succeeded} failed=${records.filter((row) => row.status === "failed").length}\n`);
    }
  }
} catch (error) {
  const safeError = classifyFailure(String(error?.message ?? ""));
  if (!records.some((row) => row.status === "failed")) records.push({ status: "failed", failureClass: safeError, errorType: error?.name ?? "Error" });
} finally {
  await client.close().catch(() => {});
}

const responseStatus = records.length === allInputs.length && records.every((row) => row.status === "selected" || row.status === "abstained") ? "complete"
  : records.some((row) => row.status === "selected" || row.status === "abstained") ? "partial" : "failed";
const totalUsage = records.reduce((sum, row) => ({
  input_tokens: sum.input_tokens + (row.usage?.input_tokens ?? 0),
  output_tokens: sum.output_tokens + (row.usage?.output_tokens ?? 0),
}), { input_tokens: 0, output_tokens: 0 });
const summary = {
  schemaVersion: 1,
  runId,
  status: responseStatus,
  provider: "typesafe-jev",
  model,
  startedAt,
  completedAt: new Date().toISOString(),
  mcpToolAvailable: toolAvailable,
  sourceLabelFileRead: false,
  corpusDocuments: documents.length,
  catalogHeadingCandidates: totalHeadings,
  queries: allInputs.length,
  successfulCalls: records.filter((row) => row.status === "selected" || row.status === "abstained").length,
  failedCalls: records.filter((row) => row.status === "failed").length,
  abstentions: records.filter((row) => row.status === "abstained").length,
  exactFetchChecks: records.filter((row) => row.exactFetch && row.exactFetch !== "not-selected").length,
  exactFetchPassed: records.filter((row) => row.exactFetch === "passed").length,
  providerCalls: records.reduce((sum, row) => sum + (row.providerCalls ?? 0), 0),
  usage: totalUsage,
  meanElapsedMs: records.length ? Number((records.reduce((sum, row) => sum + row.elapsedMs, 0) / records.length).toFixed(1)) : null,
  failureClasses: Object.fromEntries([...new Set(records.filter((row) => row.failureClass).map((row) => row.failureClass))].map((failureClass) => [failureClass, records.filter((row) => row.failureClass === failureClass).length])),
  launcherMissingCredentialNotice: /credential unavailable/i.test(stderrSummary),
  rawVendorHttpBodiesPersisted: false,
  credentialValuePersisted: false,
};
writeJson("summary.json", summary);
process.stdout.write(`${JSON.stringify(summary)}\n`);
if (responseStatus !== "complete") process.exitCode = 1;
