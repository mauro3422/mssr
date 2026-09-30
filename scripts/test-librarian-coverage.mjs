import assert from "node:assert/strict";
import {
  MSSR_LIBRARIAN_PRODUCER_COVERAGE,
  buildMssrLibrarianCoverageInventory,
  getMssrLibrarianCoverageInventory,
  getMssrLibrarianCoverageInventoryForHost,
  mssrLibrarianHostCoverageDeclarationBatchSchema,
  mssrLibrarianHostCoverageDeclarationSchema,
  mssrLibrarianProducerCoverageBatchSchema,
  mssrLibrarianProducerCoverageSchema,
} from "../dist/index.js";

const inventory = getMssrLibrarianCoverageInventory();
assert.equal(inventory.schemaVersion, 1);
assert.equal(inventory.advisoryOnly, true);
assert.equal(inventory.canonicalRewriteAllowed, false);
assert.equal(inventory.jevRequired, false);
assert.equal(inventory.entries.length, MSSR_LIBRARIAN_PRODUCER_COVERAGE.length);
assert.ok(inventory.entries.length >= 12, "R5.A should enumerate the main current producer families");

const documentSurface = inventory.entries.find((entry) => entry.id === "document-surface");
assert.equal(documentSurface?.status, "instrumented");
assert.ok(documentSurface?.adapterRef?.includes("librarianRecordsFromDocumentSurface"));

const routing = inventory.entries.find((entry) => entry.id === "route-replan");
assert.equal(routing?.requirement, "required");
assert.equal(routing?.status, "instrumented");
assert.equal(routing?.adapterRef, "src/librarian-route-adapter.ts#librarianRecordFromRouteTelemetry");
assert.equal(inventory.gaps.some((gap) => gap.producerId === "route-replan"), false);

const skillSelection = inventory.entries.find((entry) => entry.id === "skill-selection-load");
assert.equal(skillSelection?.requirement, "required");
assert.equal(skillSelection?.status, "instrumented");
assert.equal(skillSelection?.adapterRef, "src/librarian-skill-adapter.ts#librarianRecordFromSkillTelemetry");
assert.equal(inventory.gaps.some((gap) => gap.producerId === "skill-selection-load"), false);

const contextAssembly = inventory.entries.find((entry) => entry.id === "context-assembly-paging");
assert.equal(contextAssembly?.requirement, "required");
assert.equal(contextAssembly?.status, "instrumented");
assert.equal(contextAssembly?.adapterRef, "src/librarian-context-assembly-adapter.ts#librarianRecordFromContextAssemblyTelemetry");
assert.equal(inventory.gaps.some((gap) => gap.producerId === "context-assembly-paging"), false);

const projectContextSelection = inventory.entries.find((entry) => entry.id === "project-context-selection");
assert.equal(projectContextSelection?.requirement, "required");
assert.equal(projectContextSelection?.status, "instrumented");
assert.equal(projectContextSelection?.adapterRef, "src/librarian-project-context-adapter.ts#librarianRecordFromProjectContextSelectionTelemetry+librarianRecordsFromContextMessageEvidence");
assert.equal(inventory.gaps.some((gap) => gap.producerId === "project-context-selection"), false);

const traceLifecycle = inventory.entries.find((entry) => entry.id === "trace-lifecycle-outcome");
assert.equal(traceLifecycle?.requirement, "required");
assert.equal(traceLifecycle?.status, "instrumented");
assert.equal(traceLifecycle?.adapterRef, "src/librarian-trace-adapter.ts#librarianRecordFromTraceCheckpoint");
assert.equal(inventory.gaps.some((gap) => gap.producerId === "trace-lifecycle-outcome"), false);

const sourceObservation = inventory.entries.find((entry) => entry.id === "git-filesystem-revisions");
assert.equal(sourceObservation?.requirement, "conditional");
assert.equal(sourceObservation?.status, "partial");
assert.ok(inventory.gaps.some((gap) => gap.producerId === "git-filesystem-revisions" && gap.code === "conditional-producer-partial"));

assert.equal(inventory.summary.requiredCoverageComplete, true);
assert.equal(inventory.summary.globalCoverageComplete, false);
assert.equal(inventory.negativeClaimPolicy.missingInstrumentationIsEvidenceOfAbsence, false);
assert.equal(inventory.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);
assert.equal(inventory.negativeClaimPolicy.globalNegativeClaimAllowed, false);
assert.equal(inventory.summary.requiredGaps, 0);
assert.ok(inventory.summary.conditionalGaps > 0);
assert.ok(inventory.gaps.every((gap) => gap.advisoryOnly));
assert.ok(inventory.gaps.every((gap) => gap.message.includes("not evidence")));

const completeRequired = buildMssrLibrarianCoverageInventory([
  {
    id: "required-a",
    family: "fixture",
    description: "Fully instrumented required producer.",
    canonicalOwner: "fixture",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "fixture id",
    canProve: ["Fixture evidence crossed ingress."],
    cannotProve: ["Anything outside fixture scope."],
    namespaces: ["fixture"],
    adapterRef: "src/fixture.ts",
  },
  {
    id: "optional-a",
    family: "fixture",
    description: "Missing optional producer.",
    canonicalOwner: "fixture",
    requirement: "optional",
    status: "missing",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "fixture optional id",
    canProve: ["Optional fixture evidence when present."],
    cannotProve: ["Evidence while uninstrumented."],
    namespaces: ["fixture-optional"],
  },
]);
assert.equal(completeRequired.summary.requiredCoverageComplete, true);
assert.equal(completeRequired.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);
assert.equal(completeRequired.summary.globalCoverageComplete, false);
assert.equal(completeRequired.negativeClaimPolicy.globalNegativeClaimAllowed, false);
assert.equal(completeRequired.summary.optionalGaps, 1);

const globallyComplete = buildMssrLibrarianCoverageInventory([
  {
    id: "required-a",
    family: "fixture",
    description: "Fully instrumented required producer.",
    canonicalOwner: "fixture",
    requirement: "required",
    status: "instrumented",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "runtime",
    stableIdentity: "fixture id",
    canProve: ["Fixture evidence crossed ingress."],
    cannotProve: ["Anything outside fixture scope."],
    namespaces: ["fixture"],
    adapterRef: "src/fixture.ts",
  },
  {
    id: "conditional-disabled",
    family: "fixture",
    description: "A conditional producer that is explicitly absent from this host.",
    canonicalOwner: "fixture-host",
    requirement: "conditional",
    status: "not-applicable",
    authorityClass: "observed",
    privacyClass: "operational-metadata",
    retentionClass: "ephemeral",
    stableIdentity: "host capability id",
    canProve: ["The declaration states this producer is not applicable in the evaluated scope."],
    cannotProve: ["Anything about another host where the producer may exist."],
    namespaces: [],
  },
]);
assert.equal(globallyComplete.summary.globalCoverageComplete, true);
assert.equal(globallyComplete.negativeClaimPolicy.globalNegativeClaimAllowed, true);

assert.equal(mssrLibrarianProducerCoverageSchema.safeParse({
  id: "broken-instrumented",
  family: "fixture",
  description: "Instrumented without adapter ref must fail.",
  canonicalOwner: "fixture",
  requirement: "required",
  status: "instrumented",
  authorityClass: "observed",
  privacyClass: "operational-metadata",
  retentionClass: "runtime",
  stableIdentity: "fixture",
  canProve: ["Something."],
  cannotProve: ["Something else."],
  namespaces: [],
}).success, false);

assert.equal(mssrLibrarianProducerCoverageSchema.safeParse({
  id: "broken-required-na",
  family: "fixture",
  description: "Required producer cannot be not-applicable.",
  canonicalOwner: "fixture",
  requirement: "required",
  status: "not-applicable",
  authorityClass: "observed",
  privacyClass: "operational-metadata",
  retentionClass: "runtime",
  stableIdentity: "fixture",
  canProve: ["Something."],
  cannotProve: ["Something else."],
  namespaces: [],
}).success, false);

const duplicate = MSSR_LIBRARIAN_PRODUCER_COVERAGE[0];
assert.equal(mssrLibrarianProducerCoverageBatchSchema.safeParse([duplicate, duplicate]).success, false);

const filtered = getMssrLibrarianCoverageInventory(["document-surface", "route-replan"]);
assert.deepEqual(filtered.entries.map((entry) => entry.id), ["document-surface", "route-replan"]);
assert.equal(filtered.summary.requiredGaps, 0);
assert.equal(filtered.negativeClaimPolicy.requiredScopeNegativeClaimAllowed, true);
assert.equal(filtered.negativeClaimPolicy.globalNegativeClaimAllowed, true);

const bridgeHostDeclaration = {
  schemaVersion: 1,
  producerId: "host-tool-runtime-metrics",
  host: "bridge-mcp",
  status: "instrumented",
  conditional: true,
  advisoryOnly: true,
  canonicalRewriteAllowed: false,
  adapterRef: "src/librarian-host-runtime-adapter.ts",
  sourceRefs: ["src/metrics.ts", "src/runtime-health.ts"],
  capabilities: ["tool-call", "tool-result-status", "latency", "runtime-generation", "runtime-health"],
  canProve: ["Bridge observed bounded tool/runtime metadata for this host."],
  cannotProve: ["Global producer coverage outside this host scope."],
};
assert.equal(mssrLibrarianHostCoverageDeclarationSchema.safeParse(bridgeHostDeclaration).success, true);

const portableHostCoverageBefore = getMssrLibrarianCoverageInventory(["host-tool-runtime-metrics"]);
assert.equal(portableHostCoverageBefore.entries[0].status, "partial", "portable adapter exists but must not assume Bridge adoption");

const bridgeScopedHostCoverage = getMssrLibrarianCoverageInventoryForHost({
  host: "bridge-mcp",
  declarations: [bridgeHostDeclaration],
  ids: ["host-tool-runtime-metrics"],
});
assert.equal(bridgeScopedHostCoverage.entries[0].status, "instrumented");
assert.equal(bridgeScopedHostCoverage.entries[0].adapterRef, "src/librarian-host-runtime-adapter.ts");
assert.equal(bridgeScopedHostCoverage.summary.conditionalGaps, 0);
assert.equal(bridgeScopedHostCoverage.summary.globalCoverageComplete, true);
assert.equal(bridgeScopedHostCoverage.hostScope.host, "bridge-mcp");
assert.equal(bridgeScopedHostCoverage.hostScope.portableInventoryUnchanged, true);
assert.equal(bridgeScopedHostCoverage.hostScope.canonicalRewriteAllowed, false);

const portableHostCoverageAfter = getMssrLibrarianCoverageInventory(["host-tool-runtime-metrics"]);
assert.equal(portableHostCoverageAfter.entries[0].status, "partial", "host overlay must not mutate portable coverage");

const bridgeVisualNotApplicable = {
  schemaVersion: 1,
  producerId: "visual-qa-evidence",
  host: "bridge-mcp",
  status: "not-applicable",
  conditional: true,
  advisoryOnly: true,
  canonicalRewriteAllowed: false,
  sourceRefs: ["bridge-host-capability-profile"],
  capabilities: [],
  canProve: ["This host declaration does not claim a visual evidence producer for the evaluated scope."],
  cannotProve: ["Visual facts for other hosts or future Bridge capabilities."],
};
assert.equal(mssrLibrarianHostCoverageDeclarationSchema.safeParse(bridgeVisualNotApplicable).success, true);
const bridgeScopedFullCoverage = getMssrLibrarianCoverageInventoryForHost({
  host: "bridge-mcp",
  declarations: [bridgeHostDeclaration, bridgeVisualNotApplicable],
});
assert.equal(bridgeScopedFullCoverage.summary.requiredGaps, 0);
assert.equal(bridgeScopedFullCoverage.summary.conditionalGaps, 1, "only git/filesystem partial coverage should remain in this host scope");
assert.deepEqual(bridgeScopedFullCoverage.gaps.map((gap) => gap.producerId), ["git-filesystem-revisions"]);

assert.equal(mssrLibrarianHostCoverageDeclarationSchema.safeParse({
  ...bridgeHostDeclaration,
  adapterRef: undefined,
}).success, false, "instrumented host coverage requires an adapter ref");
assert.equal(mssrLibrarianHostCoverageDeclarationBatchSchema.safeParse([
  bridgeHostDeclaration,
  bridgeHostDeclaration,
]).success, false, "duplicate host/producer declarations must fail closed");
assert.throws(() => getMssrLibrarianCoverageInventoryForHost({
  host: "other-host",
  declarations: [bridgeHostDeclaration],
}), /cannot be applied/i);
assert.throws(() => getMssrLibrarianCoverageInventoryForHost({
  host: "bridge-mcp",
  declarations: [{ ...bridgeHostDeclaration, producerId: "unknown-producer" }],
}), /Unknown Librarian producer/i);
assert.throws(() => getMssrLibrarianCoverageInventoryForHost({
  host: "bridge-mcp",
  declarations: [{ ...bridgeHostDeclaration, producerId: "document-surface" }],
}), /only refine conditional producers/i);

console.log("librarian coverage tests passed");
