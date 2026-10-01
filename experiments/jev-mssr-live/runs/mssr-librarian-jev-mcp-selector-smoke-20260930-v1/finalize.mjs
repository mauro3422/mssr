import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const runDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(runDirectory, "../../../..");
const parentRun = "experiments/jev-mssr-live/runs/mssr-librarian-jev-full-heading-choice-20260930-v1";
const summary = JSON.parse(await fs.readFile(path.join(runDirectory, "summary.json"), "utf8"));
const score = JSON.parse(await fs.readFile(path.join(runDirectory, "scoring.json"), "utf8"));
const inputPaths = ["corpus.json", "cases.json", "target-index.json"];
const inputHashes = {};
for (const name of inputPaths) {
  const bytes = await fs.readFile(path.join(root, parentRun, "inputs", name));
  inputHashes[name] = createHash("sha256").update(bytes).digest("hex");
}

const safe = summary.execution;
const code = (value) => `\`${value}\``;
const reportLines = [
  "# MSSR Librarian Jev MCP selector smoke (exploratory)",
  "",
  "## Run",
  "",
  "This is a single-call integration smoke for MSSR 0.2.95, not a benchmark-quality estimate. The compiled MCP registration was connected through the MCP SDK in an in-memory client/server pair, injected with the real MSSR TypeSafe Jev provider, and supplied a frozen corpus of 21 MSSR documents. The runner submitted only the corpus and Spanish query case 01; it did not read expected targets or labels. The existing Windows Credential Manager entry supplied the provider credential ephemerally.",
  "",
  `The selector offered ${safe.sourceHeadingsOffered} exact heading sections plus none (${safe.optionsIncludingNone} total options). Jev selected ${score.exactTargetMatch ? "the expected target section" : "a different section"} at ${code(score.expectedHeadingPath.join(" › "))} in ${code(safe.selected.sourceRef)}. A subsequent call to ${code("mssr_librarian_fetch")} revalidated the selected handle against the frozen source and returned the identical fingerprint.`,
  "",
  "## Observed result",
  "",
  `- Provider/model: ${code(safe.provider)} / ${code(safe.model)}.`,
  `- Raw provider confidence: ${safe.providerConfidence.toFixed(2)}; uncalibrated and descriptive only.`,
  `- Usage: ${safe.inputTokens.toLocaleString("en-US")} input / ${safe.outputTokens.toLocaleString("en-US")} output tokens.`,
  `- Selection-call latency: ${safe.selectionElapsedMs} ms.`,
  `- Exact fetch: ${safe.exactFetchPassed ? "passed" : "failed"}; revision-bound fingerprint matched.`,
  "- Authority: advisory only, unverified, no automatic apply. The selector returned a handle, not section text.",
  "- Persistence: no credential, raw provider response, or source body was persisted.",
  "",
  `The expected-target comparison ran after selection. Its label provenance is ${score.labelProvenance}; alternatives were not exhaustively adjudicated. This one match establishes that the compiled MCP path, real provider and exact-fetch handoff worked for this input. It does not measure broad retrieval or decision quality, validate confidence, prove semantic truth, or authorize automatic search reranking.`,
  "",
  "## Limits",
  "",
  "This call covers heading selection and exact fetch only. It does not cover compaction, follow-up grep, paragraph assembly, citation-faithful synthesis, relation/contradiction quality, human-approved gold labels, or Bridge host adoption. Search remains deterministic. The active Bridge package readback remains MSSR 0.2.93 until a separate host adoption is verified.",
  "",
  "## Reproduction",
  "",
  `From the repository root, run ${code("npm run build")}, then ${code(`node ${path.relative(root, path.join(runDirectory, "runner.mjs")).replaceAll("\\", "/")}`)} on the authorized Windows account. The runner reads the existing Credential Manager entry, sends one real Jev Choice call, performs an exact MCP fetch, and writes only the bounded summary. Run ${code(`node ${path.relative(root, path.join(runDirectory, "score.mjs")).replaceAll("\\", "/")}`)} separately to compare the result with the frozen expected-target index after the call.`,
  "",
];
await fs.writeFile(path.join(runDirectory, "REPORT.md"), reportLines.join("\n"), "utf8");

const manifest = {
  schemaVersion: 1,
  runId: summary.runId,
  status: "complete",
  source: summary.source,
  provider: safe.provider,
  model: safe.model,
  credentialValuePersisted: false,
  rawVendorResponsePersisted: false,
  selectionRunnerReadsLabelsOrTargets: false,
  inputHashes,
  scoring: {
    file: "scoring.json",
    exactTargetMatch: score.exactTargetMatch,
    labelProvenance: score.labelProvenance,
  },
  execution: {
    calls: 1,
    candidateHeadings: safe.sourceHeadingsOffered,
    optionsIncludingNone: safe.optionsIncludingNone,
    inputTokens: safe.inputTokens,
    outputTokens: safe.outputTokens,
    elapsedMs: safe.selectionElapsedMs,
    exactFetchPassed: safe.exactFetchPassed,
    advisoryOnly: safe.advisoryOnly,
    verification: safe.verification,
    canonicalWrite: false,
  },
  compiledFiles: summary.source.compiledFiles,
};
await fs.writeFile(path.join(runDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const artifacts = ["runner.mjs", "score.mjs", "finalize.mjs", "summary.json", "scoring.json", "REPORT.md", "manifest.json"];
const checksums = [];
for (const artifact of artifacts) {
  const bytes = await fs.readFile(path.join(runDirectory, artifact));
  checksums.push(`${createHash("sha256").update(bytes).digest("hex")}  ${artifact}`);
}
await fs.writeFile(path.join(runDirectory, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ artifacts: artifacts.length, report: "REPORT.md", checksums: "SHA256SUMS", build: summary.source.mssrBuildReceipt.id }));
