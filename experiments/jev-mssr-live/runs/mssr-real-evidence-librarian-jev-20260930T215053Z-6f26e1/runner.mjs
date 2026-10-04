import { readFileSync } from "node:fs";
import { catalogMssrLibrarianRecord } from "../../../../dist/librarian-contract.js";
import { evidenceAtomFromLibrarianCatalogRecord } from "../../../../dist/evidence-atom.js";

const runRoot = new URL(".", import.meta.url);
const readJson = (name) => JSON.parse(readFileSync(new URL("inputs/" + name, runRoot), "utf8"));
const cases = readJson("cases.json");
const corpus = readJson("corpus.json");
const fetched = readJson("fetched-evidence.json");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", runRoot), "utf8"));
const projectKey = "mssr";
const owner = "D:/Dev/mssr";
const observedAt = manifest.createdAt;
const sourceByRef = new Map(corpus.map((item) => [item.sourceRef, item]));
const fetchedByAlias = new Map(fetched.map((item) => [item.atomId, item]));
const atomIds = new Map();
const inputAtoms = [];
const sourceEvidence = [];

for (const spec of cases.relationAtoms) {
  const item = fetchedByAlias.get(spec.id);
  if (!item || !item.result?.text || !item.candidate?.handle) throw new Error("Missing exact fetched evidence for " + spec.id);
  const handle = item.result.handle;
  const source = sourceByRef.get(spec.sourceRef);
  if (!source || handle.sourceRef !== spec.sourceRef || handle.rangeKind !== "block" || item.result.fingerprint !== handle.fingerprint) {
    throw new Error("Exact block, source or fingerprint mismatch for " + spec.id);
  }
  const record = catalogMssrLibrarianRecord({
    namespace: "document",
    kind: "block",
    identity: spec.sourceRef + "#" + handle.rangeId,
    sourceRef: spec.sourceRef,
    revision: handle.revision,
    payloadFingerprint: item.result.fingerprint,
    provenance: { producer: "mssr-librarian", host: "codex-local" }
  });
  const atom = evidenceAtomFromLibrarianCatalogRecord({
    record,
    sourceClass: "canonical",
    canonicalOwner: owner,
    authorityClass: "canonical",
    privacyClass: "project-metadata",
    freshness: "fresh",
    freshnessEvidence: { canonicalOwner: owner, ref: spec.sourceRef, revision: handle.revision, observedAt },
    headingPath: item.candidate.headingPath,
    range: { startLine: handle.startLine, endLine: handle.endLine, startOffset: handle.startOffset, endOffset: handle.endOffset },
    reasonCodes: ["exact-source-fetch"],
    usage: { selection: "selected", consumed: true, outcome: "unknown" },
    projectKey
  });
  atomIds.set(spec.id, atom.id);
  inputAtoms.push(atom);
  sourceEvidence.push({ atomId: atom.id, handle, text: item.result.text });
}

const start = "2026-09-30T00:00:00Z";
const sameTime = (scope) => ({
  scope: { left: scope, right: scope },
  temporal: {
    leftValidity: "current", leftValidFrom: start, leftValidUntil: null,
    rightValidity: "current", rightValidFrom: start, rightValidUntil: null
  }
});
const pairs = cases.relationPairs.map((item) => {
  let claim;
  let comparability;
  if (item.id === "relation-r4") {
    claim = { validity: "unknown", scope: null, validFrom: null, validUntil: null };
    comparability = {
      scope: { left: null, right: null },
      temporal: {
        leftValidity: null, leftValidFrom: null, leftValidUntil: null,
        rightValidity: null, rightValidFrom: null, rightValidUntil: null
      }
    };
  } else if (item.id === "relation-r3") {
    claim = { validity: "current", scope: "MSSR project documentation", validFrom: start, validUntil: null };
    comparability = {
      scope: { left: "MSSR project knowledge governance", right: "Jev public research evidence" },
      temporal: {
        leftValidity: "current", leftValidFrom: start, leftValidUntil: null,
        rightValidity: "current", rightValidFrom: start, rightValidUntil: null
      }
    };
  } else {
    const scope = item.id === "relation-r1" ? "MSSR EvidenceAtom/source boundary" : "MSSR Librarian retrieval";
    claim = { validity: "current", scope, validFrom: start, validUntil: null };
    comparability = sameTime(scope);
  }
  return {
    id: item.id,
    leftAtomId: atomIds.get(item.leftAtom),
    rightAtomId: atomIds.get(item.rightAtom),
    claim,
    comparability
  };
});
const request = {
  projectKey,
  corpusKey: manifest.runId,
  goal: "Classify the relation between exact current MSSR evidence sections for selective knowledge retrieval and safe, reversible synthesis. Use unresolved when evidence, scope or valid time is insufficient. A relation never authorizes a merge or write.",
  inputAtoms,
  sourceEvidence,
  pairs,
  traceId: "mssr-jev-real-data-eval-20260930",
  model: "jev-1.13.0",
  maxPairsPerRequest: 4,
  maxStateChars: 24000,
  concurrency: 1
};
process.stdout.write(JSON.stringify(request));
