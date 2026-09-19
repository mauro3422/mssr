import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  MSSR_R4_GATE_A_COVERAGE,
  MSSR_SEMANTIC_COVERAGE_STATUSES,
  buildMssrSemanticConsistencyCoverageInventory,
  getMssrR4GateACoverageInventory,
  mssrSemanticCoverageCapabilitySchema,
} from "../dist/index.js";

const inventory = getMssrR4GateACoverageInventory();
assert.equal(inventory.schemaVersion, 1);
assert.equal(inventory.advisoryOnly, true);
assert.equal(inventory.canonicalRewriteAllowed, false);
assert.equal(inventory.entries.length, 7);
assert.equal(inventory.entries.find((entry) => entry.id === "semantic-claims-c2e-d")?.coverageClass, "source-complete");
assert.equal(inventory.entries.find((entry) => entry.id === "document-freshness")?.coverageClass, "source-complete");
assert.equal(inventory.entries.find((entry) => entry.id === "context-message:roadmap-contradiction")?.coverageClass, "pending-host-adoption");
assert.equal(inventory.entries.find((entry) => entry.id === "context-message:unresolved-reference")?.coverageClass, "pending-host-adoption");
assert.equal(inventory.entries.find((entry) => entry.id === "semantic-relations-r4")?.coverageClass, "pending-host-adoption");
assert.equal(inventory.entries.find((entry) => entry.id === "semantic-candidate-retrieval-r4")?.coverageClass, "pending-host-adoption");
assert.equal(inventory.entries.find((entry) => entry.id === "semantic-shadow-r4")?.coverageClass, "pending-host-adoption");
assert.equal(inventory.summary.edgeCounts.reserved, 0);
assert.deepEqual(Object.keys(inventory.summary.edgeCounts).sort(), [...MSSR_SEMANTIC_COVERAGE_STATUSES].sort());

const filtered = getMssrR4GateACoverageInventory(["context-message:roadmap-contradiction"]);
assert.equal(filtered.entries.length, 1);
assert.equal(filtered.entries[0]?.coverageClass, "pending-host-adoption");

const synthetic = buildMssrSemanticConsistencyCoverageInventory([
  {
    id: "test-only-example",
    category: "capability",
    description: "Fixture proving a test cannot stand in for source implementation.",
    requiredSourceEdges: [],
    edges: [{ id: "fixture-test", kind: "test", status: "implemented", owner: "mssr" }],
  },
  {
    id: "export-only-example",
    category: "capability",
    description: "Fixture proving an export cannot stand in for source implementation.",
    requiredSourceEdges: [],
    edges: [{ id: "fixture-export", kind: "export", status: "implemented", owner: "mssr" }],
  },
  {
    id: "pending-host-example",
    category: "capability",
    description: "Fixture proving source-complete work can remain pending host adoption.",
    requiredSourceEdges: ["fixture-contract"],
    edges: [
      { id: "fixture-contract", kind: "contract", status: "implemented", owner: "mssr" },
      { id: "fixture-host", kind: "host-adoption", status: "pending-adoption", owner: "bridge" },
    ],
  },
]);
assert.equal(synthetic.entries[0]?.coverageClass, "test-only");
assert.equal(synthetic.entries[1]?.coverageClass, "export-only");
assert.equal(synthetic.entries[2]?.coverageClass, "pending-host-adoption");

assert.equal(mssrSemanticCoverageCapabilitySchema.safeParse({
  id: "broken",
  category: "capability",
  description: "Broken required edge reference.",
  requiredSourceEdges: ["missing-edge"],
  edges: [{ id: "known-edge", kind: "contract", status: "implemented", owner: "mssr" }],
}).success, false);

for (const capability of MSSR_R4_GATE_A_COVERAGE) {
  for (const edge of capability.edges) {
    if (!edge.ref) continue;
    const relative = edge.ref.split("#", 1)[0];
    const absolute = path.resolve(relative);
    assert.equal(fs.existsSync(absolute), true, `coverage evidence ref must exist: ${edge.ref}`);
  }
}

console.log("MSSR R4 Gate A semantic consistency coverage inventory: PASS");
