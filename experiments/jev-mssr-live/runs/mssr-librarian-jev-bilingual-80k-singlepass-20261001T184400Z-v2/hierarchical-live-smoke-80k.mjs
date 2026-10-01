import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fetchMssrLibrarianEvidence } from "../../../../dist/librarian-retrieval.js";

const runRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(runRoot, "../../../../");
const launcher = process.env.MSSR_JEV_CREDENTIAL_LAUNCHER ?? "C:\\Users\\mauro\\.codex\\scripts\\mssr-jev-credential-launcher.mjs";
const sourceRef = "experiments/fixtures/jev-bilingual-hierarchical-smoke.md";
const owner = "project:mssr-jev-hierarchical-smoke";
const lines = ["# Synthetic hierarchy fixture", ""];
for (let index = 1; index <= 260; index += 1) {
  const target = index === 260;
  lines.push(
    `## ${target ? "Exact source fingerprint protects deep evidence retrieval" : `Generic catalog section ${String(index).padStart(3, "0")}`}`,
    "",
    target
      ? "To verify a deep retrieval, fetch the exact revision-bound range and compare its source fingerprint before trusting or using the evidence. Para verificar una recuperación profunda, obtiene el rango exacto ligado a la revisión y compara su huella de origen antes de confiar o usar la evidencia."
      : `This synthetic catalog entry discusses generic repository notes, section ${index}, and routine documentation review. Esta entrada sintética trata notas generales del repositorio, sección ${index}, y revisión ordinaria de documentación.`,
    "",
  );
}
const document = { owner, sourceRef, markdown: lines.join("\n"), privacyClass: "project-metadata" };
const queries = [
  { language: "en", query: "Which exact source check verifies deep retrieval evidence before it is trusted?" },
  { language: "es", query: "¿Qué comprobación exacta del origen valida la evidencia recuperada en profundidad antes de confiar en ella?" },
];
const transport = new StdioClientTransport({ command: process.execPath, args: [launcher], cwd: repoRoot, stderr: "pipe" });
let stderrSummary = "";
transport.stderr?.on("data", (chunk) => { stderrSummary += chunk.toString().slice(0, 4_000); });
const client = new Client({ name: "mssr-jev-hierarchical-live-smoke", version: "1.0.0" }, { capabilities: {} });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const records = [];
let failureClass = null;
try {
  await client.connect(transport);
  const inventory = await client.listTools();
  if (!inventory.tools.some((tool) => tool.name === "mssr_librarian_jev_select")) throw new Error("selector-tool-missing");
  for (const item of queries) {
    const started = performance.now();
    const result = await client.callTool({
      name: "mssr_librarian_jev_select",
      arguments: { documents: [document], query: item.query, model: "jev-1.13.0" },
    });
    if (result.isError) {
      const safeError = result.content?.filter((content) => content.type === "text").map((content) => content.text).join("\n") ?? "";
      const redactedError = safeError
        .replace(/bearer\s+[^\s,;"']+/gi, "Bearer [redacted]")
        .replace(/(api.?key|authorization|token|credential)\s*[:=]\s*[^\s,;"']+/gi, "$1=[redacted]")
        .replace(/[A-Za-z0-9_-]{40,}/g, "[redacted-id]")
        .replace(/[\r\n\t]+/g, " ")
        .slice(0, 240);
      failureClass = /probabilit|confidence|choice|schema/i.test(safeError) ? "provider-response-or-probability-contract"
        : /credential|api.?key|unauthori[sz]ed|forbidden/i.test(safeError) ? "credential-or-authentication"
          : /rate.?limit|429|quota/i.test(safeError) ? "rate-limited"
            : /timeout|timed out/i.test(safeError) ? "timeout"
              : /network|fetch|ECONN|ENOTFOUND/i.test(safeError) ? "network"
                : safeError ? "other-mcp-error" : "empty-mcp-error";
      process.stderr.write(`safe_jev_error_hint=${redactedError}\n`);
      throw new Error("selector-tool-error");
    }
    const text = result.content?.find((content) => content.type === "text")?.text;
    if (!text) throw new Error("selector-returned-no-payload");
    const payload = JSON.parse(text);
    let exactFetch = "not-selected";
    let selectedExactTarget = false;
    if (payload.selected?.handle) {
      try {
        const fetched = fetchMssrLibrarianEvidence({ handle: payload.selected.handle, ...document });
        exactFetch = fetched.fingerprint === payload.selected.handle.fingerprint ? "passed" : "fingerprint-mismatch";
        selectedExactTarget = /Exact source fingerprint protects deep evidence retrieval/.test(payload.selected.title ?? "")
          && /deep retrieval/.test(fetched.text);
      } catch {
        exactFetch = "rejected";
      }
    }
    records.push({
      language: item.language,
      status: payload.status,
      selectionMode: payload.selectionMode,
      candidateCount: payload.candidateCount,
      finalistCount: payload.finalistCount,
      providerCalls: payload.providerCalls,
      retainedFinalistCounts: payload.batchAssessments?.map((assessment) => assessment.retainedFinalistCount) ?? [],
      localBatchCount: payload.batchAssessments?.length ?? 0,
      selectedTitle: payload.selected?.title ?? null,
      selectedSourceRef: payload.selected?.handle?.sourceRef ?? null,
      selectedRangeId: payload.selected?.handle?.rangeId ?? null,
      selectedExactTarget,
      choiceConfidence: payload.providerConfidence ?? null,
      evidenceSufficiency: payload.evidenceSufficiency ?? null,
      confidenceCalibration: payload.confidenceCalibration ?? null,
      exactFetch,
      requestFingerprint: payload.requestFingerprint ?? null,
      usage: payload.usage ?? null,
      elapsedMs: Number((performance.now() - started).toFixed(1)),
    });
  }
} catch (error) {
  if (!failureClass) failureClass = /credential unavailable/i.test(stderrSummary) ? "credential-or-authentication" : error?.name ?? "Error";
} finally {
  await client.close().catch(() => {});
}
const summary = {
  schemaVersion: 1,
  runId: "mssr-librarian-jev-hierarchical-live-smoke-80k-20261001T184400Z-v2",
  status: !failureClass && records.length === 2 && records.every((record) => record.selectionMode === "hierarchical" && record.selectedExactTarget && record.exactFetch === "passed" && record.retainedFinalistCounts.every((count) => count === 2)) ? "pass" : "review",
  failureClass,
  provider: "typesafe-jev",
  model: "jev-1.13.0",
  syntheticOnly: true,
  sourceLabelFileRead: false,
  corpusDocuments: 1,
  catalogHeadings: 261,
  queries: records.length,
  providerCalls: records.reduce((sum, record) => sum + record.providerCalls, 0),
  records,
  launcherMissingCredentialNotice: /credential unavailable/i.test(stderrSummary),
  rawVendorHttpBodiesPersisted: false,
  credentialValuePersisted: false,
  sourceSha256: sha256(document.markdown),
  distSha256: sha256(readFileSync(resolve(repoRoot, "dist/librarian-jev-selection.js"))),
};
writeFileSync(resolve(runRoot, "hierarchical-live-smoke-v2-result.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summary)}\n`);
if (summary.status !== "pass") process.exitCode = 1;
