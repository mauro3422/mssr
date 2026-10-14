import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchMssrLibrarianEvidence, fetchMssrLibrarianEvidence } from "../dist/librarian-retrieval.js";
import { evaluateLibrarianCompositionReview } from "./lib/evaluate-librarian-composition-review.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runs = path.join(root, "experiments/jev-mssr-live/runs");
const runner = path.join(root, "scripts/run-composed-librarian-experiment.mjs");
const sourceRef = "docs/decisions/0007-automatic-lifecycle-coverage.md";
const bytes = await fs.readFile(path.join(root, sourceRef));
const markdown = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
const owner = process.platform === "win32" ? root.replace(/\\/g, "/").toLowerCase() : root;
const search = searchMssrLibrarianEvidence({
  documents: [{ owner, sourceRef, markdown, privacyClass: "project-metadata" }],
  query: { query: "automatic lifecycle coverage", maxResults: 100, maxSnippetChars: 160 },
});
assert.ok(search.results.length > 0);
const handle = search.results[0].handle;
const fetched = fetchMssrLibrarianEvidence({ handle, owner, sourceRef, markdown, privacyClass: handle.privacyClass });
const query = "automatic lifecycle coverage";
const unmatchedQuery = "unmatched synthetic facet";
const selectedReceipt = {
  schemaVersion: 1, facetId: "selected-facet", sourceRef, sourceSha256, query, candidateSource: "search-handles", status: "selected",
  candidates: [handle],
  selection: { status: "selected", selected: { handle }, provider: "test-fixture", model: "fixture-jev", requestFingerprint: "a".repeat(64), candidateCount: 1, providerCalls: 1, jevCallMade: true, advisoryOnly: true, truthAuthority: false, exactFetchRequired: true, autoApplyAllowed: false },
  selectedHandle: handle,
  fetch: {
    status: "verified", handleFingerprint: handle.fingerprint, fetchedFingerprint: fetched.fingerprint,
    textSha256: createHash("sha256").update(fetched.text, "utf8").digest("hex"),
    expectedTextSha256: createHash("sha256").update(fetched.text, "utf8").digest("hex"),
    textChars: fetched.text.length, exactText: fetched.text, startLineFromSource: handle.startLine, endLineFromSource: handle.endLine,
  },
  safeError: null,
};
const secondHandle = search.results.find((result) => result.handle.id !== handle.id)?.handle;
assert.ok(secondHandle, "the fixture source must expose two distinct exact evidence handles");
const secondFetched = fetchMssrLibrarianEvidence({ handle: secondHandle, owner, sourceRef, markdown, privacyClass: secondHandle.privacyClass });
const secondTextHash = createHash("sha256").update(secondFetched.text, "utf8").digest("hex");
const secondSelectedReceipt = {
  ...structuredClone(selectedReceipt),
  facetId: "second-selected-facet",
  candidates: [secondHandle],
  selection: { ...structuredClone(selectedReceipt.selection), selected: { handle: secondHandle } },
  selectedHandle: secondHandle,
  fetch: {
    status: "verified", handleFingerprint: secondHandle.fingerprint, fetchedFingerprint: secondFetched.fingerprint,
    textSha256: secondTextHash, expectedTextSha256: secondTextHash, textChars: secondFetched.text.length,
    exactText: secondFetched.text, startLineFromSource: secondHandle.startLine, endLineFromSource: secondHandle.endLine,
  },
};
const abstainedReceipt = {
  schemaVersion: 1, facetId: "abstained-facet", sourceRef, sourceSha256, query: unmatchedQuery, candidateSource: "implicit-headings", status: "abstained",
  candidates: [],
  selection: { status: "abstained", selected: null, provider: "test-fixture", model: "fixture-jev", requestFingerprint: "b".repeat(64), candidateCount: 1, providerCalls: 1, jevCallMade: true, advisoryOnly: true, truthAuthority: false, exactFetchRequired: true, autoApplyAllowed: false },
  selectedHandle: null, fetch: null, safeError: null,
};
const plan = {
  schemaVersion: 1,
  classification: { kind: "exploratory-development-diagnostic", benchmark: false, holdoutUsed: false },
  corpus: { priorExposure: "known-exposed", priorExposureNote: "Tracked exposed ADR for local regression only.", sources: [{ sourceRef, sha256: sourceSha256 }] },
  provider: { model: "fixture-jev" },
  facets: [
    { id: "selected-facet", sourceRef, query, expectedLines: [{ start: handle.startLine, end: handle.endLine }] },
    { id: "abstained-facet", sourceRef, query: unmatchedQuery, expectedLines: [{ start: handle.startLine, end: handle.endLine }] },
  ],
};
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-composed-harness-"));
const suffix = process.pid + "-" + Date.now();
const runOutput = path.join(runs, "composed-harness-test-" + suffix);
const allAbstainOutput = path.join(runs, "composed-harness-abstain-" + suffix);
const liveBlockedOutput = path.join(runs, "composed-harness-live-blocked-" + suffix);
const compositionReviewOutput = path.join(runs, "composed-harness-review-" + suffix);
const outputJunction = path.join(runs, "composed-harness-junction-" + suffix);
const sourceJunction = path.join(runs, "composed-harness-source-junction-" + suffix);
const outsideOutput = path.join(scratch, "outside-output");
const sourceTarget = path.join(scratch, "external-source");
const junctions = [];
const invoke = (planPath, extra = [], env = process.env) => spawnSync(process.execPath, [runner, "--plan", planPath, ...extra], { cwd: root, encoding: "utf8", windowsHide: true, env });
const writePlan = async (filename, value) => {
  const target = path.join(scratch, filename);
  await fs.writeFile(target, JSON.stringify(value));
  return target;
};
const writeReceipts = async (filename, rows) => {
  const target = path.join(scratch, filename);
  await fs.writeFile(target, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
  return target;
};
try {
  const planPath = await writePlan("plan.json", plan);
  const receiptsPath = await writeReceipts("receipts.jsonl", [selectedReceipt, abstainedReceipt]);
  const dry = invoke(planPath);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).networkRequests, 0);
  assert.equal(JSON.parse(dry.stdout).outputWrites, 0);

  const replay = invoke(planPath, ["--replay", receiptsPath]);
  assert.equal(replay.status, 0, replay.stderr);
  const replayResult = JSON.parse(replay.stdout);
  assert.equal(replayResult.providerCalls, 0);
  assert.equal(replayResult.unionParagraphCount, 1);
  assert.equal(replayResult.metric, "line-span-coverage-only");
  assert.equal(replayResult.semanticCoverage, false);
  assert.deepEqual(replayResult.facets.map((item) => item.status), ["selected", "abstained"]);
  assert.equal(replayResult.compositionGate.exactEvidenceStatus, "incomplete");
  assert.deepEqual(replayResult.compositionGate.incompleteFacetIds, ["abstained-facet"]);
  assert.equal(replayResult.compositionGate.semanticCoverageStatus, "unknown");
  assert.equal(replayResult.compositionGate.answerSynthesisStatus, "blocked-incomplete-facet-evidence");
  assert.equal(replayResult.compositionGate.answerSynthesisAllowed, false);

  const allSelectedPlan = structuredClone(plan);
  allSelectedPlan.facets[1] = { ...allSelectedPlan.facets[1], id: "second-selected-facet", query };
  const allSelectedReceiptsPath = await writeReceipts("all-selected.jsonl", [
    selectedReceipt,
    secondSelectedReceipt,
  ]);
  const allSelected = invoke(await writePlan("all-selected-plan.json", allSelectedPlan), ["--replay", allSelectedReceiptsPath]);
  assert.equal(allSelected.status, 0, allSelected.stderr);
  const allSelectedGate = JSON.parse(allSelected.stdout).compositionGate;
  assert.equal(allSelectedGate.exactEvidenceStatus, "complete");
  assert.equal(allSelectedGate.exactFetchedFacetCount, 2);
  assert.deepEqual(allSelectedGate.incompleteFacetIds, []);
  assert.equal(allSelectedGate.semanticCoverageStatus, "unknown", "exact fetches must not be upgraded to semantic coverage");
  assert.equal(allSelectedGate.answerSynthesisStatus, "pending-independent-semantic-review");
  assert.equal(allSelectedGate.answerSynthesisAllowed, false, "the harness must never authorize generated answer prose");

  const review = {
    schemaVersion: 1,
    labelProvenance: "synthetic-fixture",
    reviewer: { id: "fixture-reviewer", reviewedAt: "2026-10-14T00:00:00Z", blindToProviderScores: true },
    requiredClaims: [
      { id: "required-alpha", description: "A direct claim from the first facet.", facetIds: ["selected-facet"] },
      { id: "required-beta", description: "A direct claim from the second facet.", facetIds: ["second-selected-facet"] },
    ],
    paragraphs: [{
      id: "paragraph-1",
      text: "The first selected evidence supports Alpha. The second selected evidence supports Beta. Combining Alpha and Beta is unsupported.",
      claims: [
        {
          id: "claim-alpha", text: "The first selected evidence supports Alpha.", addressesFacetIds: ["selected-facet"],
          satisfiesRequiredClaimIds: ["required-alpha"], citations: [{ facetId: "selected-facet", handleId: handle.id }],
          supportStatus: "supported", crossFacetJoinStatus: "not-applicable", errorCodes: [],
        },
        {
          id: "claim-beta", text: "The second selected evidence supports Beta.", addressesFacetIds: ["second-selected-facet"],
          satisfiesRequiredClaimIds: ["required-beta"], citations: [{ facetId: "second-selected-facet", handleId: secondHandle.id }],
          supportStatus: "supported", crossFacetJoinStatus: "not-applicable", errorCodes: [],
        },
        {
          id: "claim-cross-facet", text: "Combining Alpha and Beta is unsupported.", addressesFacetIds: ["selected-facet", "second-selected-facet"],
          satisfiesRequiredClaimIds: [], citations: [
            { facetId: "selected-facet", handleId: handle.id },
            { facetId: "second-selected-facet", handleId: secondHandle.id },
          ], supportStatus: "unsupported", crossFacetJoinStatus: "unsupported", errorCodes: ["unsupported-claim"],
        },
      ],
    }],
  };
  const reviewPath = path.join(scratch, "composition-review.json");
  await fs.writeFile(reviewPath, JSON.stringify(review));
  const allSelectedPlanPath = await writePlan("all-selected-plan.json", allSelectedPlan);
  const reviewedReplay = invoke(allSelectedPlanPath, [
    "--replay", allSelectedReceiptsPath, "--composition-review", reviewPath, "--output-dir", compositionReviewOutput,
  ]);
  assert.equal(reviewedReplay.status, 0, reviewedReplay.stderr);
  const reviewedResult = JSON.parse(reviewedReplay.stdout);
  assert.equal(reviewedResult.providerCalls, 0);
  assert.equal(reviewedResult.networkRequests, 0);
  assert.equal(reviewedResult.compositionGate.answerSynthesisAllowed, false);
  assert.equal(reviewedResult.compositionEvaluation.ownerGold, false);
  assert.equal(reviewedResult.compositionEvaluation.benchmark, false);
  assert.equal(reviewedResult.compositionEvaluation.confidenceCalibration, "none");
  assert.equal(reviewedResult.compositionEvaluation.synthesisAuthority, false);
  assert.equal(reviewedResult.compositionEvaluation.productionWritesAllowed, false);
  assert.equal(reviewedResult.compositionEvaluation.metrics.citationIntegrityRate, 1);
  assert.equal(reviewedResult.compositionEvaluation.metrics.requiredClaimRecallRate, 1);
  assert.equal(reviewedResult.compositionEvaluation.metrics.supportedFacetCoverageRate, 1);
  assert.equal(reviewedResult.compositionEvaluation.metrics.multiFacetClaimCount, 1);
  assert.equal(reviewedResult.compositionEvaluation.metrics.unsupportedCrossFacetJoinRate, 1);

  const invalidCitationReview = structuredClone(review);
  invalidCitationReview.paragraphs[0].claims[1].citations[0].handleId = "not-the-selected-handle";
  const invalidCitationEvaluation = evaluateLibrarianCompositionReview({
    plan: allSelectedPlan,
    receipts: [selectedReceipt, secondSelectedReceipt],
    review: invalidCitationReview,
  });
  assert.equal(invalidCitationEvaluation.metrics.invalidCitationCount, 1);
  assert.equal(invalidCitationEvaluation.metrics.requiredClaimRecallRate, 0.5);
  assert.equal(invalidCitationEvaluation.metrics.supportedFacetCoverageRate, 0.5);

  const unblindedReview = structuredClone(review);
  unblindedReview.reviewer.blindToProviderScores = false;
  assert.throws(() => evaluateLibrarianCompositionReview({
    plan: allSelectedPlan,
    receipts: [selectedReceipt, secondSelectedReceipt],
    review: unblindedReview,
  }), /blind to provider scores/u);

  const nullReviewPath = path.join(scratch, "null-composition-review.json");
  await fs.writeFile(nullReviewPath, "null");
  const nullReview = invoke(allSelectedPlanPath, ["--replay", allSelectedReceiptsPath, "--composition-review", nullReviewPath]);
  assert.notEqual(nullReview.status, 0);
  assert.match(nullReview.stderr, /must be a JSON object/u);

  const reviewManifest = JSON.parse(await fs.readFile(path.join(compositionReviewOutput, "manifest.json"), "utf8"));
  assert.equal(reviewManifest.compositionReview.reviewerBlindness, "caller-asserted");
  assert.equal(reviewManifest.compositionReview.evaluatorSha256, createHash("sha256").update(await fs.readFile(path.join(compositionReviewOutput, "inputs", "composition-review-evaluator.mjs"))).digest("hex"));
  const reviewCompletion = JSON.parse(await fs.readFile(path.join(compositionReviewOutput, "run-completion.json"), "utf8"));
  assert.equal(reviewCompletion.compositionEvaluation.metrics.citationIntegrityRate, 1);
  await fs.access(path.join(compositionReviewOutput, "composition-evaluation.json"));
  const reviewSums = await fs.readFile(path.join(compositionReviewOutput, "SHA256SUMS"), "utf8");
  assert.match(reviewSums, /composition-review\.input\.json/u);
  assert.match(reviewSums, /composition-review-evaluator\.mjs/u);
  assert.match(reviewSums, /composition-evaluation\.json/u);
  for (const line of reviewSums.trim().split("\n")) {
    const [expected, relative] = line.split(/\s{2}/u);
    const actual = createHash("sha256").update(await fs.readFile(path.join(compositionReviewOutput, ...relative.split("/")))).digest("hex");
    assert.equal(actual, expected, "composition-review checksum mismatch: " + relative);
  }

  const missing = structuredClone([selectedReceipt, abstainedReceipt]);
  delete missing[0].selection;
  const missingFile = await writeReceipts("missing-selection.jsonl", missing);
  const missingResult = invoke(planPath, ["--replay", missingFile]);
  assert.notEqual(missingResult.status, 0);
  assert.match(missingResult.stderr, /strict schema|Jev selection receipt/u);

  const mismatch = structuredClone([selectedReceipt, abstainedReceipt]);
  mismatch[0].selection.selected.handle = { ...handle, startLine: handle.startLine + 1 };
  const mismatchFile = await writeReceipts("selection-mismatch.jsonl", mismatch);
  const mismatchResult = invoke(planPath, ["--replay", mismatchFile]);
  assert.notEqual(mismatchResult.status, 0);
  assert.match(mismatchResult.stderr, /Selected handle differs/u);

  const unknown = structuredClone([selectedReceipt, abstainedReceipt]);
  unknown[1].selection.status = "provider-error";
  const unknownFile = await writeReceipts("unknown-status.jsonl", unknown);
  const unknownResult = invoke(planPath, ["--replay", unknownFile]);
  assert.notEqual(unknownResult.status, 0);

  const tampered = structuredClone([selectedReceipt, abstainedReceipt]);
  tampered[0].fetch.exactText += "tamper";
  const tamperedFile = await writeReceipts("tampered.jsonl", tampered);
  const tamperedResult = invoke(planPath, ["--replay", tamperedFile]);
  assert.notEqual(tamperedResult.status, 0);
  assert.match(tamperedResult.stderr, /exact fetch validation failed/u);

  const allAbstainFile = await writeReceipts("all-abstain.jsonl", [
    { ...abstainedReceipt, facetId: "selected-facet", query },
    abstainedReceipt,
  ]);
  const allAbstain = invoke(planPath, ["--replay", allAbstainFile, "--output-dir", allAbstainOutput]);
  assert.equal(allAbstain.status, 0, allAbstain.stderr);
  assert.equal(JSON.parse(allAbstain.stdout).unionParagraphCount, 0);
  assert.equal(JSON.parse(allAbstain.stdout).compositionGate.answerSynthesisStatus, "blocked-incomplete-facet-evidence");
  const completion = JSON.parse(await fs.readFile(path.join(allAbstainOutput, "run-completion.json"), "utf8"));
  assert.equal(completion.status, "completed");
  assert.equal(completion.unionParagraphCount, 0);
  assert.equal(completion.compositionGate.exactFetchedFacetCount, 0);

  const persisted = invoke(planPath, ["--replay", receiptsPath, "--output-dir", runOutput]);
  assert.equal(persisted.status, 0, persisted.stderr);
  const manifest = JSON.parse(await fs.readFile(path.join(runOutput, "manifest.json"), "utf8"));
  assert.equal(manifest.status, "running");
  assert.equal(manifest.planSha256, createHash("sha256").update(await fs.readFile(planPath)).digest("hex"));
  assert.ok(manifest.gitHead);
  assert.ok(manifest.mssrBuild.buildId);
  assert.equal(manifest.coverageMetric, "line-span-coverage-only; semanticCoverage=false; ownerGold=false");
  const persistedCompletion = JSON.parse(await fs.readFile(path.join(runOutput, "run-completion.json"), "utf8"));
  assert.equal(persistedCompletion.compositionGate.answerSynthesisStatus, "blocked-incomplete-facet-evidence");
  await fs.access(path.join(runOutput, "inputs", "runner.mjs"));
  await fs.access(path.join(runOutput, "inputs", "01.md"));
  const sums = await fs.readFile(path.join(runOutput, "SHA256SUMS"), "utf8");
  assert.match(sums, /manifest\.json/u);
  assert.match(sums, /run-completion\.json/u);
  for (const line of sums.trim().split("\n")) {
    const [expected, relative] = line.split(/\s{2}/u);
    const actual = createHash("sha256").update(await fs.readFile(path.join(runOutput, ...relative.split("/")))).digest("hex");
    assert.equal(actual, expected, "checksum mismatch: " + relative);
  }

  const badPlan = structuredClone(plan);
  badPlan.facets[0].expectedLines[0].end = markdown.split("\n").length + 1;
  const badPlanPath = await writePlan("bad-span.json", badPlan);
  const badSpan = invoke(badPlanPath);
  assert.notEqual(badSpan.status, 0);
  assert.match(badSpan.stderr, /outside source bounds/u);

  const overlappingPlan = structuredClone(plan);
  overlappingPlan.facets[0].expectedLines.push({ ...overlappingPlan.facets[0].expectedLines[0] });
  const overlappingPlanPath = await writePlan("overlapping-spans.json", overlappingPlan);
  const overlappingSpans = invoke(overlappingPlanPath);
  assert.notEqual(overlappingSpans.status, 0);
  assert.match(overlappingSpans.stderr, /Expected line spans overlap/u);

  const sealedPlan = structuredClone(plan);
  sealedPlan.corpus.sources[0].sourceRef = "experiments/sealed/secret.md";
  sealedPlan.facets.forEach((facet) => { facet.sourceRef = "experiments/sealed/secret.md"; });
  const sealedPath = await writePlan("sealed.json", sealedPlan);
  const sealed = invoke(sealedPath);
  assert.notEqual(sealed.status, 0);
  assert.match(sealed.stderr, /sealed|source refused/u);

  const liveEnv = { ...process.env, MSSR_BRIDGE_ROOT: "D:\\Dev\\bridge-mcp" };
  const blocked = invoke(planPath, ["--allow-network", "--output-dir", liveBlockedOutput], liveEnv);
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).status, "blocked");
  const blockedManifest = JSON.parse(await fs.readFile(path.join(liveBlockedOutput, "manifest.json"), "utf8"));
  assert.equal(blockedManifest.liveGate.status, "blocked");
  assert.equal(JSON.parse(await fs.readFile(path.join(liveBlockedOutput, "run-completion.json"), "utf8")).networkRequests, 0);
  await fs.access(path.join(liveBlockedOutput, "SHA256SUMS"));

  await fs.mkdir(sourceTarget);
  await fs.writeFile(path.join(sourceTarget, "doc.md"), markdown);
  await fs.symlink(sourceTarget, sourceJunction, "junction");
  junctions.push(sourceJunction);
  const linkedRef = path.relative(root, path.join(sourceJunction, "doc.md")).replace(/\\/g, "/");
  const linkedPlan = structuredClone(plan);
  linkedPlan.corpus.sources[0] = { sourceRef: linkedRef, sha256: sourceSha256 };
  linkedPlan.facets.forEach((facet) => { facet.sourceRef = linkedRef; });
  const linkedPlanPath = await writePlan("junction-source.json", linkedPlan);
  const linked = invoke(linkedPlanPath);
  assert.notEqual(linked.status, 0);
  assert.match(linked.stderr, /reparse|junction|outside approved/u);

  await fs.mkdir(outsideOutput);
  await fs.symlink(outsideOutput, outputJunction, "junction");
  junctions.push(outputJunction);
  const outputEscape = invoke(planPath, ["--replay", receiptsPath, "--output-dir", path.join(outputJunction, "must-not-exist")]);
  assert.notEqual(outputEscape.status, 0);
  await assert.rejects(fs.access(path.join(outsideOutput, "must-not-exist")));

  process.stdout.write("Composed Librarian harness replay, path, freeze, abstention and live-gate checks passed.\n");
} finally {
  for (const junction of junctions.reverse()) await fs.rmdir(junction).catch(() => undefined);
  await fs.rm(runOutput, { recursive: true, force: true });
  await fs.rm(allAbstainOutput, { recursive: true, force: true });
  await fs.rm(liveBlockedOutput, { recursive: true, force: true });
  await fs.rm(compositionReviewOutput, { recursive: true, force: true });
  await fs.rm(scratch, { recursive: true, force: true });
}
