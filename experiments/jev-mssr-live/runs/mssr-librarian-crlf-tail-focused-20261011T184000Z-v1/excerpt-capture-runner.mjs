import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const bridgeRoot = "D:/Dev/bridge-mcp-mssr-0.2.112-query-variants";
const packageUrl = pathToFileURL(path.join(bridgeRoot, "node_modules/@mauroprime/mssr/dist/index.js")).href + `?${Date.now()}`;
const { selectMssrLibrarianEvidenceWithJev } = await import(packageUrl);
const sourceRef = "experiments/jev-mssr-live/crlf-tail-focused.md";
const markdown = await fs.readFile(`D:/Dev/mssr/${sourceRef}`, "utf8");
const query = "Which signed activation changes epoch authority, and what exact values must be logged?";
const capturedRequests = [];
const deterministicProvider = {
  async executeSystemOne(request) {
    capturedRequests.push(request);
    const answers = {};
    for (const [key, question] of Object.entries(request.questions)) {
      answers[key] = question.kind === "choice"
        ? { type: "choice", choice: Object.keys(question.options).find((id) => id !== "none") ?? Object.keys(question.options)[0], confidence: 0.8 }
        : { type: "noul", noul: 0.8 };
    }
    return { provider: "deterministic-request-capture", model: "local-test", usage: { input_tokens: 0, output_tokens: 0 }, answers };
  },
};
await selectMssrLibrarianEvidenceWithJev({
  documents: [{ owner: "d:/dev/mssr", sourceRef, markdown, privacyClass: "project-metadata" }],
  query,
}, deterministicProvider);
const version = JSON.parse(await fs.readFile(path.join(bridgeRoot, "node_modules/@mauroprime/mssr/package.json"), "utf8")).version;
const excerpt = capturedRequests[0]?.state?.evidence?.find((entry) => entry.id === "h001")?.text ?? null;
console.log(JSON.stringify({
  version,
  crlfCount: (markdown.match(/\r\n/g) ?? []).length,
  lfOnlyCount: (markdown.match(/(?<!\r)\n/g) ?? []).length,
  excerpt,
}, null, 2));
