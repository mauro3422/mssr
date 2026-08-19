import assert from "node:assert/strict";
import fs from "node:fs/promises";
import * as typescript from "typescript";
import {
  MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE,
  MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE,
  analyzeArchitectureTypeScriptSource,
  loadArchitectureImpactManifest,
  loadArchitectureStructureManifest,
  planArchitectureSymbolAnalysis,
} from "../dist/index.js";

const compilerLoader = async () => typescript;
const selector = (name, aspect, language = "typescript") => ({ kind: "symbol", language, name, aspect });
const tsPlan = {
  schemaVersion: 1,
  architectureId: "fixture-plane",
  ref: "src/fixture.ts",
  selectors: [
    selector("alpha", "signature"),
    selector("alpha", "body"),
    selector("Worker", "shape"),
    selector("Worker.run", "signature"),
    selector("Worker.run", "body"),
    selector("Config", "shape"),
    selector("missingFn", "body"),
    selector("Worker", "body"),
  ],
};

const baseSource = `
export function alpha(x: number): number {
  // comment ignored by canonicalization
  return x + 1;
}

export class Worker {
  value: number = 1;
  run(x: number): number {
    return x + this.value;
  }
}

export interface Config {
  enabled: boolean;
  retries?: number;
}
`;

const triviaOnlySource = `
export   function alpha ( x : number ) : number
{
  /* another comment */
  return x + 1 ;
}

export class Worker
{
  // property comment
  value : number = 1 ;
  run ( x : number ) : number
  {
    return x + this.value ;
  }
}

export interface Config
{
  enabled : boolean ;
  retries ? : number ;
}
`;

const bodyChangedSource = baseSource
  .replace("return x + 1;", "return x + 2;")
  .replace("value: number = 1;", "value: number = 99;")
  .replace("return x + this.value;", "return x * this.value;");

const signatureChangedSource = baseSource
  .replace("alpha(x: number): number", "alpha(x: string): number")
  .replace("run(x: number): number", "run(x: string): number")
  .replace("retries?: number", "retries?: string");

async function analyze(sourceText, plan = tsPlan, sourceRevision = "fixture-revision-1", loader = compilerLoader) {
  return analyzeArchitectureTypeScriptSource({ plan, sourceText, sourceRevision, compilerLoader: loader });
}

function byKey(evidence) {
  return new Map(evidence.results.map((result) => [`${result.selector.name}:${result.selector.aspect}`, result]));
}

const base = await analyze(baseSource);
assert.match(base.analyzerId, new RegExp(`^${MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE}:ts\\d+\\.\\d+(?:\\.\\d+)?$`));
assert.match(base.fingerprintScheme, new RegExp(`^${MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE}:ts\\d+\\.\\d+(?:\\.\\d+)?$`));
assert.equal(base.sourceRevision, "fixture-revision-1");
const baseByKey = byKey(base);
for (const key of ["alpha:signature", "alpha:body", "Worker:shape", "Worker.run:signature", "Worker.run:body", "Config:shape"]) {
  assert.equal(baseByKey.get(key)?.availability, "observed", `${key} must be observed`);
  assert.match(baseByKey.get(key).structuralFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.ok(baseByKey.get(key).location.startLine >= 1);
}
assert.equal(baseByKey.get("missingFn:body")?.availability, "missing");
assert.deepEqual(
  { availability: baseByKey.get("Worker:body")?.availability, reasonCode: baseByKey.get("Worker:body")?.reasonCode },
  { availability: "unavailable", reasonCode: "unsupported-aspect" },
);

const trivia = await analyze(triviaOnlySource, tsPlan, "fixture-revision-trivia");
const triviaByKey = byKey(trivia);
for (const key of ["alpha:signature", "alpha:body", "Worker:shape", "Worker.run:signature", "Worker.run:body", "Config:shape"]) {
  assert.equal(
    triviaByKey.get(key).structuralFingerprint,
    baseByKey.get(key).structuralFingerprint,
    `${key} fingerprint must ignore whitespace/comments`,
  );
}

const bodyChanged = byKey(await analyze(bodyChangedSource, tsPlan, "fixture-revision-body"));
assert.equal(bodyChanged.get("alpha:signature").structuralFingerprint, baseByKey.get("alpha:signature").structuralFingerprint);
assert.notEqual(bodyChanged.get("alpha:body").structuralFingerprint, baseByKey.get("alpha:body").structuralFingerprint);
assert.equal(bodyChanged.get("Worker:shape").structuralFingerprint, baseByKey.get("Worker:shape").structuralFingerprint, "class shape excludes property initializers and method bodies");
assert.equal(bodyChanged.get("Worker.run:signature").structuralFingerprint, baseByKey.get("Worker.run:signature").structuralFingerprint);
assert.notEqual(bodyChanged.get("Worker.run:body").structuralFingerprint, baseByKey.get("Worker.run:body").structuralFingerprint);
assert.equal(bodyChanged.get("Config:shape").structuralFingerprint, baseByKey.get("Config:shape").structuralFingerprint);

const signatureChanged = byKey(await analyze(signatureChangedSource, tsPlan, "fixture-revision-signature"));
assert.notEqual(signatureChanged.get("alpha:signature").structuralFingerprint, baseByKey.get("alpha:signature").structuralFingerprint);
assert.equal(signatureChanged.get("alpha:body").structuralFingerprint, baseByKey.get("alpha:body").structuralFingerprint, "body is independent from the function signature");
assert.notEqual(signatureChanged.get("Worker:shape").structuralFingerprint, baseByKey.get("Worker:shape").structuralFingerprint);
assert.notEqual(signatureChanged.get("Worker.run:signature").structuralFingerprint, baseByKey.get("Worker.run:signature").structuralFingerprint);
assert.equal(signatureChanged.get("Worker.run:body").structuralFingerprint, baseByKey.get("Worker.run:body").structuralFingerprint);
assert.notEqual(signatureChanged.get("Config:shape").structuralFingerprint, baseByKey.get("Config:shape").structuralFingerprint);

const overloadPlan = {
  schemaVersion: 1,
  architectureId: "fixture-plane",
  ref: "src/overloads.ts",
  selectors: [selector("convert", "signature"), selector("convert", "body")],
};
const overloadSource = `
export function convert(value: string): string;
export function convert(value: number): number;
export function convert(value: string | number) { return value; }
`;
const overload = byKey(await analyze(overloadSource, overloadPlan, "overload-revision"));
assert.equal(overload.get("convert:signature")?.availability, "observed");
assert.equal(overload.get("convert:body")?.availability, "observed");

const variablePlan = {
  schemaVersion: 1,
  architectureId: "fixture-plane",
  ref: "src/variable.ts",
  selectors: [selector("token", "signature"), selector("token", "body")],
};
const variableBase = byKey(await analyze("export const token: number = 1;", variablePlan, "variable-base"));
const variableStorageChanged = byKey(await analyze("export let token: number = 1;", variablePlan, "variable-storage"));
const variableBodyChanged = byKey(await analyze("export const token: number = 2;", variablePlan, "variable-body"));
assert.notEqual(variableStorageChanged.get("token:signature").structuralFingerprint, variableBase.get("token:signature").structuralFingerprint, "const/let/export storage semantics belong to variable signature");
assert.equal(variableStorageChanged.get("token:body").structuralFingerprint, variableBase.get("token:body").structuralFingerprint);
assert.equal(variableBodyChanged.get("token:signature").structuralFingerprint, variableBase.get("token:signature").structuralFingerprint);
assert.notEqual(variableBodyChanged.get("token:body").structuralFingerprint, variableBase.get("token:body").structuralFingerprint);

const jsPlan = {
  schemaVersion: 1,
  architectureId: "fixture-plane",
  ref: "src/fixture.js",
  selectors: [selector("plain", "signature", "javascript"), selector("plain", "body", "javascript")],
};
const javascript = await analyze("export function plain(x) { return x + 1; }", jsPlan, "js-revision");
assert.deepEqual(javascript.results.map((result) => result.availability), ["observed", "observed"]);

const unavailable = await analyze(baseSource, tsPlan, "no-parser", async () => { throw new Error("module missing"); });
assert.equal(unavailable.analyzerId, `${MSSR_TYPESCRIPT_SYMBOL_ANALYZER_ID_BASE}:unavailable`);
assert.equal(unavailable.fingerprintScheme, `${MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE}:unavailable`);
assert.ok(unavailable.results.every((result) => result.availability === "unavailable" && result.reasonCode === "typescript-parser-unavailable"));

const invalidCompiler = await analyze(baseSource, tsPlan, "invalid-parser", async () => ({}));
assert.ok(invalidCompiler.results.every((result) => result.availability === "unavailable" && result.reasonCode === "typescript-parser-invalid"));

const parseError = await analyze("export function alpha(", tsPlan, "parse-error");
assert.ok(parseError.results.every((result) => result.availability === "unavailable" && result.reasonCode === "typescript-parse-error"));

// The default loader is lazy: the emitted analyzer contains dynamic import only, and TypeScript remains outside runtime dependencies.
const emitted = await fs.readFile("dist/architecture-typescript-analyzer.js", "utf8");
assert.equal(/from\s+["']typescript["']/.test(emitted), false, "emitted runtime must not have a static TypeScript import");
assert.match(emitted, /import\(["']typescript["']\)/, "reference analyzer must lazy-load TypeScript only when invoked");
const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
assert.equal(packageJson.dependencies?.typescript, undefined, "TypeScript must not become a mandatory MSSR runtime dependency");

const defaultLoaded = await analyzeArchitectureTypeScriptSource({
  plan: tsPlan,
  sourceText: baseSource,
  sourceRevision: "default-loader-revision",
});
assert.equal(defaultLoaded.fingerprintScheme, base.fingerprintScheme);
assert.equal(byKey(defaultLoaded).get("alpha:body").structuralFingerprint, baseByKey.get("alpha:body").structuralFingerprint);

// Self-host the real C2 declaration: the reference analyzer must be able to observe its own reviewed selectors.
const selfImpact = await loadArchitectureImpactManifest(process.cwd());
assert.equal(selfImpact.found, true, "self-hosted architecture-impact manifest must exist");
const selfStructure = await loadArchitectureStructureManifest(process.cwd(), selfImpact.manifest);
assert.equal(selfStructure.found, true, "self-hosted architecture-structure manifest must exist");
const selfPlan = planArchitectureSymbolAnalysis(selfImpact.manifest, selfStructure.manifest)
  .find((plan) => plan.architectureId === "architecture-impact-plane" && plan.ref === "src/architecture-typescript-analyzer.ts");
assert.ok(selfPlan, "C2 reference analyzer must be reviewed into the architecture-impact structural map");
assert.deepEqual(
  selfPlan.selectors.map((item) => [item.name, item.aspect]),
  [
    ["MSSR_TYPESCRIPT_SYMBOL_FINGERPRINT_SCHEME_BASE", "body"],
    ["analyzeArchitectureTypeScriptSource", "body"],
  ],
);
const selfSourceText = await fs.readFile(selfPlan.ref, "utf8");
const selfEvidence = await analyzeArchitectureTypeScriptSource({
  plan: selfPlan,
  sourceText: selfSourceText,
  sourceRevision: "self-hosted-c2-test",
  compilerLoader,
});
assert.ok(selfEvidence.results.every((result) => result.availability === "observed"), "all reviewed C2 self-selectors must be structurally observable");
assert.equal(selfEvidence.fingerprintScheme, base.fingerprintScheme);

console.log("MSSR C2f-C.5-C2 TypeScript/JavaScript reference analyzer tests PASS");
