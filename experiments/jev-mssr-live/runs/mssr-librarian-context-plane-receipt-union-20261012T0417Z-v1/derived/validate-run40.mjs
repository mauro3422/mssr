import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed: Boolean(passed), detail });
const manifest = json("manifest.json");
const cases = json("inputs/cases.json").cases;
const labels = json("inputs/labels.json").cases;
const sourceBytes = readFileSync(resolve(root, "inputs/sources/source-01-context-plane-history.md"));
const sourceText = sourceBytes.toString("utf8");
const sourceLines = sourceText.split(/\r\n|\n|\r/);
const precall = read("PRECALL-SHA256SUMS").trim().split(/\r?\n/).map((line) => {
  const m = line.match(/^([a-f0-9]{64})\s+(.+)$/);
  if (!m) throw new Error(`Invalid PRECALL-SHA256SUMS line: ${line}`);
  return { expected: m[1], path: m[2] };
});
check("frozen-input-checksums", precall.every(({expected,path}) => sha(readFileSync(resolve(root,path)))===expected), `${precall.length} input files checked`);
check("manifest-source-sha256", sha(sourceBytes)===manifest.source.diskSha256, "Frozen source bytes match manifest SHA-256");
check("case-label-one-to-one", cases.length===labels.length && cases.every((c,i)=>c.id===labels[i].caseId), `${cases.length} cases and labels`);

const rows = read("records.jsonl").trim().split(/\r?\n/).map(JSON.parse);
const packs = new Map([
  ["tombstone-identity", "raw/evidence-pack.json"],
  ["migration-reconciliation", "raw/evidence-pack.json"]
]);
const expected = new Map(cases.map(c => [c.id, c]));
for (const row of rows) {
  const selection = json(`raw/jev-${row.caseId}.json`);
  const fetch = json(`raw/fetch-${row.caseId}.json`);
  const gold = expected.get(row.caseId);
  const pack = json(packs.get(row.caseId));
  const selected = selection.selected?.handle;
  const accepted = gold?.expectedExactRangeIds?.includes(selected?.rangeId);
  const line = sourceLines[(selected?.startLine ?? 0)-1];
  const exactText = fetch.text===line;
  const sameBinding = fetch.handle?.id===selected?.id && fetch.handle?.revision===selected?.revision &&
    fetch.handle?.rangeId===selected?.rangeId && fetch.fingerprint===selected?.fingerprint;
  const citation = pack.paragraphs?.find(p=>p.citation?.handleId===selected?.id);
  check(`${row.caseId}-selected-accepted-range`, selection.status==="selected" && accepted && row.selectedRangeId===selected.rangeId, `selected ${selected?.rangeId}`);
  check(`${row.caseId}-exact-fetch-binding`, exactText && sameBinding && selection.selected.handle.revision===manifest.source.librarianRevision, "Fetched text, handle identity, source revision and fingerprint agree");
  check(`${row.caseId}-evidence-pack-citation`, Boolean(citation) && citation.exactText===fetch.text && citation.citation.fingerprint===fetch.fingerprint, "Pack citation and exact text agree with fetch");
}
const overlap = json("raw/evidence-pack-overlap-control.json");
check("containment-control", overlap.rangeCompaction?.inputHandleCount===2 &&
  overlap.rangeCompaction?.retainedHandleCount===1 &&
  overlap.rangeCompaction?.removed?.some(r=>r.rangeId==="block-4/item-1" && r.coveredByHandleId==="ee5353b40c7a2ab4c8ad0f353628eec5cd904e3334d6cef46f60a42a0bf0bf83"),
  "Parent section retained and 548-character child range removed");
check("source-declared-status", manifest.exposure?.sourceDeclaredInProjectContextLibrarianSidecar===false &&
  manifest.exposure?.classification==="near-disjoint-facet-diagnostic", "Not declared in sidecar; not a clean holdout");

const result = {
  schemaVersion: 1,
  runId: manifest.runId,
  validatedAt: new Date().toISOString(),
  status: checks.every(c=>c.passed) ? "passed" : "failed",
  checks,
  limitations: ["source-derived labels", "one conceptually exposed source cluster", "blind review is model-assisted, not owner-gold", "provider scores are uncalibrated"]
};
writeFileSync(resolve(here,"validation.json"), JSON.stringify(result,null,2)+"\n");
if (!checks.every(c=>c.passed)) process.exitCode=1;
console.log(JSON.stringify(result,null,2));
