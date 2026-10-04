import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMssrSemanticEvidenceTools } from "../../../../dist/semantic-evidence-mcp.js";
import { MssrJevSemanticCuratorProvider } from "../../../../dist/semantic-curation-jev.js";

const runDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(runDirectory, "../../../..");
const inputDirectory = path.join(root, "experiments/jev-mssr-live/runs/mssr-librarian-jev-full-heading-choice-20260930-v1/inputs");
const credentialReader = "C:\\Users\\mauro\\.codex\\scripts\\mssr-jev-credential-reader.ps1";
const credentialTarget = "TypeSafe:MSSR:JevLab";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readCredential() {
  delete process.env.TYPESAFE_API_KEY;
  const result = spawnSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
    "-File", credentialReader, "-CredentialTarget", credentialTarget,
  ], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true, timeout: 10_000 });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout) || result.stdout.length > 16_384) {
    throw new Error("Credential Manager lookup did not return an accepted credential.");
  }
  const encoded = result.stdout.toString("ascii").trim();
  result.stdout.fill(0);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length === 0 || encoded.length % 4 !== 0) {
    throw new Error("Credential Manager returned an invalid encoded credential.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 2 || bytes.length % 2 !== 0) {
    bytes.fill(0);
    throw new Error("Credential Manager returned an invalid credential size.");
  }
  const secret = bytes.toString("utf16le").replace(/\0+$/, "");
  bytes.fill(0);
  if (!secret || /[\0\r\n]/.test(secret)) throw new Error("Credential Manager returned an invalid credential value.");
  process.env.TYPESAFE_API_KEY = secret;
  return true;
}

function parseToolResult(result) {
  const item = result.content?.find((content) => content.type === "text");
  assert.ok(item?.text, "MCP tool must return a JSON text payload.");
  if (result.isError) {
    const lower = item.text.toLowerCase();
    const category = /credential|api.?key|unauthori[sz]ed|\b401\b|\b403\b/.test(lower)
      ? "authentication"
      : /too many tokens|context length|request.{0,12}too large|payload.{0,12}large|\b413\b/.test(lower)
        ? "request-size"
        : /timeout|timed out|\beconn/.test(lower)
          ? "transport-or-timeout"
          : "provider-or-tool";
    const diagnostic = item.text.split(/\r?\n/, 1)[0]
      .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/TYPESAFE_API_KEY\s*[=:]\s*\S+/gi, "TYPESAFE_API_KEY=[redacted]")
      .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[redacted-key]")
      .slice(0, 180);
    const statusCode = item.text.match(/(?:HTTP|status(?:Code)?)\D{0,8}(\d{3})/i)?.[1] ?? null;
    console.error(JSON.stringify({ mcpToolError: true, category, statusCode, diagnostic }));
    throw new Error(`MCP tool call failed (${category}); provider response omitted.`);
  }
  return JSON.parse(item.text);
}

const corpusBytes = await fs.readFile(path.join(inputDirectory, "corpus.json"));
const corpusFile = JSON.parse(corpusBytes.toString("utf8"));
const caseFile = JSON.parse(await fs.readFile(path.join(inputDirectory, "cases.json"), "utf8"));
const packageInfo = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const buildReceipt = JSON.parse(await fs.readFile(path.join(root, "dist/.build-receipt.json"), "utf8"));
const queryCase = caseFile.cases.find((item) => item.id === "01");
assert.ok(queryCase?.es, "The frozen Spanish smoke query must exist.");
assert.equal(corpusFile.documents.length, 21);

readCredential();
const provider = new MssrJevSemanticCuratorProvider({ timeoutMs: 30_000, maxRetries: 1 }).decisionProvider;
const server = new McpServer({ name: "mssr-live-librarian-selector-smoke", version: packageInfo.version });
registerMssrSemanticEvidenceTools(server, { decisionProvider: provider });
const client = new Client({ name: "mssr-live-librarian-selector-smoke", version: packageInfo.version });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
let safeSummary;

try {
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  const registeredTool = tools.tools.find((tool) => tool.name === "mssr_librarian_jev_select");
  assert.ok(registeredTool, "The compiled MCP tool must be registered.");

  const startedAt = performance.now();
  const selected = parseToolResult(await client.callTool({
    name: "mssr_librarian_jev_select",
    arguments: {
      documents: corpusFile.documents.map(({ owner, sourceRef, markdown, privacyClass }) => ({ owner, sourceRef, markdown, privacyClass })),
      query: queryCase.es,
    },
  }));
  const selectionElapsedMs = Number((performance.now() - startedAt).toFixed(1));
  if (selected.status !== "selected") {
    console.error(JSON.stringify({ mcpSelectionStatus: selected.status, reason: selected.reason, candidateCount: selected.candidateCount, optionChars: selected.optionChars, maxOptionTextChars: selected.maxOptionTextChars, maxAggregateOptionChars: selected.maxAggregateOptionChars }));
  }
  assert.equal(selected.status, "selected");
  assert.ok(selected.selected?.handle);

  const source = corpusFile.documents.find((item) => item.sourceRef === selected.selected.handle.sourceRef);
  assert.ok(source, "The selected exact source must be in the frozen caller-supplied corpus.");
  const fetched = parseToolResult(await client.callTool({
    name: "mssr_librarian_fetch",
    arguments: {
      handle: selected.selected.handle,
      owner: source.owner,
      sourceRef: source.sourceRef,
      markdown: source.markdown,
      privacyClass: source.privacyClass,
    },
  }));

  safeSummary = {
    schemaVersion: 1,
    runId: "mssr-librarian-jev-mcp-selector-smoke-20260930-v1",
    status: "complete",
    source: {
      repository: "MSSR",
      sourceCommitAtRun: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
      workingTreeDirtyAtRun: execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { cwd: root, encoding: "utf8" }).trim().length > 0,
      mssrPackageVersion: packageInfo.version,
      mssrBuildReceipt: buildReceipt,
      compiledFiles: await Promise.all([
        "dist/librarian-jev-selection.js",
        "dist/semantic-evidence-mcp.js",
        "dist/semantic-curation-jev.js",
        "dist/document-surface.js",
        "dist/librarian-retrieval.js",
      ].map(async (file) => ({ path: file, sha256: sha256(await fs.readFile(path.join(root, file))) }))),
      inputCorpusRun: "mssr-librarian-jev-full-heading-choice-20260930-v1",
      inputSourceCommit: corpusFile.sourceCommit,
      inputCorpusSha256: sha256(corpusBytes),
      corpusDocuments: corpusFile.documents.length,
      queryCaseId: queryCase.id,
      queryLanguage: "es",
    },
    execution: {
      mcpServerRegisteredTool: true,
      mcpSelectionCall: true,
      sourceHeadingsOffered: selected.candidateCount,
      optionsIncludingNone: selected.candidateCount + 1,
      provider: selected.provider,
      model: selected.model,
      providerConfidence: selected.providerConfidence,
      confidenceCalibration: selected.confidenceCalibration,
      inputTokens: selected.usage.input_tokens,
      outputTokens: selected.usage.output_tokens,
      selectionElapsedMs,
      requestFingerprint: selected.requestFingerprint,
      selected: {
        sourceRef: selected.selected.handle.sourceRef,
        headingPath: selected.selected.headingPath,
        revision: selected.selected.handle.revision,
        fingerprint: selected.selected.handle.fingerprint,
        handleId: selected.selected.handle.id,
      },
      exactFetchPassed: fetched.fingerprint === selected.selected.handle.fingerprint,
      exactFetchFingerprint: fetched.fingerprint,
      advisoryOnly: selected.advisoryOnly,
      truthAuthority: selected.truthAuthority,
      verification: selected.verification,
      autoApplyAllowed: selected.autoApplyAllowed,
      sourceBodyPersisted: false,
      rawProviderResponsePersisted: false,
      credentialPersisted: false,
    },
  };
  assert.equal(safeSummary.execution.exactFetchPassed, true);
  await fs.writeFile(path.join(runDirectory, "summary.json"), `${JSON.stringify(safeSummary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: safeSummary.status, ...safeSummary.execution.selected, model: safeSummary.execution.model, providerConfidence: safeSummary.execution.providerConfidence, inputTokens: safeSummary.execution.inputTokens, outputTokens: safeSummary.execution.outputTokens, selectionElapsedMs, exactFetchPassed: safeSummary.execution.exactFetchPassed }));
} finally {
  delete process.env.TYPESAFE_API_KEY;
  await client.close().catch(() => {});
  await server.close().catch(() => {});
}
