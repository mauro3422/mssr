import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CapabilityRegistry,
  MssrAdapter,
  evaluateMssrTraceOwnerCompatibility,
} from "../dist/index.js";

const unbound = evaluateMssrTraceOwnerCompatibility(null, { project: "project-a", workflowKey: "workflow-a" });
assert.equal(unbound.compatible, true);
assert.equal(unbound.status, "unbound");
assert.deepEqual(unbound.bound, { project: "project-a", workflowKey: "workflow-a" });
assert.deepEqual(unbound.newlyBoundFields, ["project", "workflowKey"]);
assert.equal(unbound.ownerMutationAllowed, false);

const preserveKnown = evaluateMssrTraceOwnerCompatibility(
  { project: "project-a", workflowKey: "workflow-a" },
  { project: null, workflowKey: null },
);
assert.equal(preserveKnown.compatible, true);
assert.deepEqual(preserveKnown.bound, { project: "project-a", workflowKey: "workflow-a" });

const progressive = evaluateMssrTraceOwnerCompatibility(
  { project: "project-a" },
  { workflowKey: "workflow-a" },
);
assert.equal(progressive.compatible, true);
assert.deepEqual(progressive.bound, { project: "project-a", workflowKey: "workflow-a" });
assert.deepEqual(progressive.newlyBoundFields, ["workflowKey"]);

const projectMismatch = evaluateMssrTraceOwnerCompatibility(
  { project: "project-a", workflowKey: "workflow-a" },
  { project: "project-b", workflowKey: "workflow-a" },
);
assert.equal(projectMismatch.compatible, false);
assert.equal(projectMismatch.status, "project-mismatch");
assert.deepEqual(projectMismatch.mismatchFields, ["project"]);
assert.deepEqual(projectMismatch.bound, { project: "project-a", workflowKey: "workflow-a" });

const workflowMismatch = evaluateMssrTraceOwnerCompatibility(
  { project: "project-a", workflowKey: "workflow-a" },
  { project: "project-a", workflowKey: "workflow-b" },
);
assert.equal(workflowMismatch.compatible, false);
assert.equal(workflowMismatch.status, "workflow-mismatch");
assert.deepEqual(workflowMismatch.mismatchFields, ["workflowKey"]);

const bothMismatch = evaluateMssrTraceOwnerCompatibility(
  { project: "project-a", workflowKey: "workflow-a" },
  { project: "project-b", workflowKey: "workflow-b" },
);
assert.equal(bothMismatch.compatible, false);
assert.equal(bothMismatch.status, "project-and-workflow-mismatch");
assert.deepEqual(bothMismatch.mismatchFields, ["project", "workflowKey"]);

const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-trace-owner-"));
const projectA = path.join(fixtureRoot, "project-a");
const projectB = path.join(fixtureRoot, "project-b");

try {
  for (const root of [projectA, projectB]) {
    await fs.mkdir(path.join(root, ".mssr"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".mssr", "project-context.json"),
      JSON.stringify({ schemaVersion: 1, core: [], modules: [] }),
      "utf8",
    );
  }

  const adapter = new MssrAdapter(new CapabilityRegistry([]), {
    caller: "other",
    telemetrySink: null,
    tracePrefix: "trace-owner-test",
  });
  const traceId = "trace-owner-test-fixed";
  const input = {
    task: "Verify immutable trace owner identity.",
    intent: {
      summary: "Verify immutable trace owner identity.",
      domains: ["agent-orchestration"],
      actions: ["verify"],
      artifacts: ["repository"],
      needs: ["integrity-verification"],
      signals: ["nominal"],
      risk: "read-only",
      ambiguity: "low",
    },
    stage: "start",
    traceId,
    workflowKey: "workflow-a",
    projectRoot: projectA,
  };

  const first = await adapter.route(input);
  assert.equal(first.traceId, traceId);
  const firstStatus = adapter.getTraceStatus(traceId);
  const canonicalA = await fs.realpath(projectA);
  const expectedA = process.platform === "win32" ? canonicalA.toLocaleLowerCase() : canonicalA;
  assert.deepEqual(firstStatus.owner, { project: expectedA, workflowKey: "workflow-a" });

  // Equivalent path spellings resolve to the same canonical project owner.
  const resumed = await adapter.route({ ...input, projectRoot: path.join(projectA, ".") });
  assert.equal(resumed.traceId, traceId);
  assert.deepEqual(adapter.getTraceStatus(traceId).owner, { project: expectedA, workflowKey: "workflow-a" });

  await assert.rejects(
    () => adapter.route({ ...input, projectRoot: projectB }),
    /mssr-trace-owner-mismatch:.*project owner/,
  );
  assert.deepEqual(adapter.getTraceStatus(traceId).owner, { project: expectedA, workflowKey: "workflow-a" });

  await assert.rejects(
    () => adapter.route({ ...input, workflowKey: "workflow-b" }),
    /mssr-trace-owner-mismatch:.*workflowKey owner/,
  );
  assert.deepEqual(adapter.getTraceStatus(traceId).owner, { project: expectedA, workflowKey: "workflow-a" });
} finally {
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

console.log("MSSR immutable trace owner identity tests PASS");
