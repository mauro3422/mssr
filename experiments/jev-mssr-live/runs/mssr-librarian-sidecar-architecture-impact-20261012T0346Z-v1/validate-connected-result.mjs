import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateEvidencePack, validateFetchResult, validateRunInputs } from "./runner-support.mjs";
const runDir = path.dirname(fileURLToPath(import.meta.url));
const read = async (rel) => JSON.parse(await fs.readFile(path.join(runDir, rel), "utf8"));
const manifest = await read("manifest.json");
const cases = (await read("inputs/cases.json")).cases;
const labels = await read("inputs/labels.json");
const selectedResult = await read("raw/mssr_librarian_jev_select.json");
const fetched = await read("raw/mssr_librarian_fetch.json");
const pack = await read("raw/mssr_librarian_evidence_pack.json");
assert.equal(validateRunInputs(cases, labels, manifest.corpus.sources.map((s) => s.sourceRef)), true);
const handle = selectedResult.selected.handle;
const source = manifest.corpus.sources.find((s) => s.sourceRef === handle.sourceRef);
assert.ok(source, "selected source absent from frozen corpus");
const markdown = (await fs.readFile(path.join(runDir, source.snapshotPath), "utf8")).replace(/\\r\\n?/gu, "\\n");
const expected = markdown.slice(handle.startOffset, handle.endOffset);
const fetchValidation = validateFetchResult(fetched, handle, expected);
const packValidation = validateEvidencePack(pack, handle, fetched.text);
const candidateFiles = Object.keys(manifest.instrument.candidateHandleFiles);
const candidates = [];
for (const file of candidateFiles) candidates.push(...(await read(file)).candidates.map((x) => x.handle));
const expectedRange = labels.cases[0].acceptableRanges[0];
const targetRangeInSearch = candidates.some((x) => x.id === expectedRange.fingerprint || (x.sourceRef === expectedRange.sourceRef && x.rangeId === expectedRange.rangeId));
const selectedOffered = candidates.some((x) => x.id === handle.id);
const selectedExact = handle.sourceRef === expectedRange.sourceRef && handle.rangeId === expectedRange.rangeId && handle.fingerprint === expectedRange.fingerprint;
const selectedRelevant = labels.cases[0].relevantRanges.some((r) => r.sourceRef === handle.sourceRef && r.rangeId === handle.rangeId && r.fingerprint === handle.fingerprint);
const out = {
  validationVersion: 1,
  runId: manifest.runId,
  runInputsValid: true,
  candidateCount: candidates.length,
  targetExactRangePresentInSearch: targetRangeInSearch,
  selectedRangeWasOffered: selectedOffered,
  selectedExactAcceptedRange: selectedExact,
  selectedPredeclaredRelevantRange: selectedRelevant,
  selectionAssessment: selectedExact ? "exact" : selectedRelevant ? "relevant" : "outside-labeled-ranges",
  fetch: {passed:fetchValidation.passed, errors:fetchValidation.errors, exactFrozenSnapshotText: fetched.text === expected, selectedSourceRef:handle.sourceRef, selectedRangeId:handle.rangeId, chars:fetched.text.length, fingerprintMatches: fetched.fingerprint === handle.fingerprint},
  evidencePack: {passed:packValidation.passed, errors:packValidation.errors, exactFetchTextPreserved:pack.paragraphs?.[0]?.exactText === fetched.text, citationMatchesSelectedHandle:pack.paragraphs?.[0]?.citation?.handleId === handle.id, chars:pack.totalFetchedChars},
  choice: {status:selectedResult.status, optionId:selectedResult.choiceCalls?.[0]?.selectedOptionId, confidence:selectedResult.providerConfidence, evidenceSufficiency:selectedResult.evidenceSufficiency, calibrated:false, candidateCount:selectedResult.candidateCount, overlapDiagnosticsTruncated:selectedResult.rangeOverlapDiagnostics?.truncated === true},
  metadataSidecar: {positiveResultCount:1, nearMissResultCount:0, exactSelectorsApplied:true},
  semanticOutcome: "Jev selected an unrelated temporal-comparability block from the relations document; exact fetch and pack integrity passed but the answer range was missed.",
};
assert.equal(out.fetch.passed, true);
assert.equal(out.evidencePack.passed, true);
assert.equal(out.targetExactRangePresentInSearch, true);
assert.equal(out.selectedRangeWasOffered, true);
assert.equal(out.selectedExactAcceptedRange, false);
assert.equal(out.selectedPredeclaredRelevantRange, false);
console.log(JSON.stringify(out,null,2));
