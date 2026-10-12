import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFetchResult } from "../runner-support.mjs";

const runDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (rel) => JSON.parse(await fs.readFile(path.join(runDir, rel), "utf8"));
const parseTool = async (rel) => {
  const wrapper = await readJson(rel);
  const block = wrapper.content?.find((item) => item.type === "text");
  assert.ok(block && typeof block.text === "string", `missing text result: ${rel}`);
  return JSON.parse(block.text);
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const manifest = await readJson("manifest.json");
const source = manifest.corpus.sources[0];
const canonicalBytes = await fs.readFile(path.resolve(manifest.corpus.projectRoot, ...source.sourceRef.split("/")));
const snapshotBytes = await fs.readFile(path.join(runDir, source.snapshotPath));
assert.equal(hash(canonicalBytes), source.sha256, "canonical source revision changed");
assert.equal(hash(snapshotBytes), source.sha256, "frozen snapshot hash mismatch");
const frozenText = snapshotBytes.toString("utf8").replace(/\r\n?/gu, "\n");
const caseIds = ["watch-review-facet", "inferred-edge-authority-facet"];
const fetchPaths = ["raw/fetch_watch_review_facet.json", "raw/fetch_inferred_edge_authority_facet.json"];
const selectionPaths = ["raw/jev_watch_review_facet.json", "raw/jev_inferred_edge_authority_facet.json"];
const selections = [];
const fetches = [];
const rows = [];
for (let i = 0; i < caseIds.length; i++) {
  const selected = await parseTool(selectionPaths[i]);
  const fetched = await parseTool(fetchPaths[i]);
  assert.equal(selected.status, "selected", `${caseIds[i]} did not select`);
  assert.ok(selected.selected?.handle, `${caseIds[i]} selected handle missing`);
  const handle = selected.selected.handle;
  const expectedText = frozenText.slice(handle.startOffset, handle.endOffset);
  const result = validateFetchResult(fetched, handle, expectedText);
  assert.equal(result.passed, true, `${caseIds[i]} exact fetch validation failed: ${result.errors.join("; ")}`);
  selections.push(selected);
  fetches.push(fetched);
  rows.push({ caseId: caseIds[i], rangeId: handle.rangeId, exactFetchMatchesSnapshot: true, revisionMatchesSnapshot: handle.revision === source.sha256, fingerprint: fetched.fingerprint, chars: fetched.text.length });
}
const pack = await parseTool("raw/evidence-pack.json");
assert.equal(pack.schemaVersion, 1);
assert.equal(pack.kind, "mssr-librarian-evidence-pack");
assert.equal(pack.assembly, "verbatim-source-ranges");
assert.equal(pack.sourceCount, 1);
assert.equal(pack.paragraphs.length, 2);
assert.equal(pack.advisoryOnly, true);
assert.equal(pack.truthAuthority, false);
assert.equal(pack.canonicalRewriteAllowed, false);
for (const paragraph of pack.paragraphs) {
  const index = selections.findIndex((selection) => selection.selected.handle.id === paragraph.citation?.handleId);
  assert.ok(index >= 0, "evidence-pack citation does not map to an observed Jev selection");
  const handle = selections[index].selected.handle;
  assert.equal(paragraph.exactText, fetches[index].text, "evidence-pack text differs from exact validated fetch");
  for (const key of ["owner", "sourceRef", "revision", "rangeId", "rangeKind", "startLine", "endLine", "fingerprint", "privacyClass"]) {
    assert.equal(paragraph.citation[key], handle[key], `citation ${key} differs from selected handle`);
  }
  assert.equal(paragraph.citation.handleId, handle.id);
}
assert.equal(pack.totalFetchedChars, pack.paragraphs.reduce((n, p) => n + p.exactText.length, 0));
const result = {
  schemaVersion: 1,
  runId: manifest.runId,
  canonicalSourceSha256: hash(canonicalBytes),
  frozenSnapshotSha256: hash(snapshotBytes),
  sourceRevisionUnchanged: true,
  exactFetches: rows,
  evidencePack: { passed: true, paragraphs: pack.paragraphs.length, citationsMatchSelections: true, exactTextMatchesValidatedFetches: true, totalFetchedChars: pack.totalFetchedChars, canonicalRewriteAllowed: false },
  providerScoresAreUncalibrated: selections.every((s) => s.confidenceCalibration === "uncalibrated-provider-score" && s.evidenceSufficiencyCalibration === "uncalibrated-provider-score"),
};
await fs.writeFile(path.join(runDir, "derived/validation.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);