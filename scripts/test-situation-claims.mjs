import assert from "node:assert/strict";

import {
  buildMssrSemanticClaimSituation,
  mssrSituationSemanticClaimKey,
  mssrSituationSemanticClaimSchema,
} from "../dist/situation-claims.js";
import { evaluateMssrSituationModel } from "../dist/situation-model.js";

const publicApi = await import("../dist/index.js");
assert.equal(typeof publicApi.buildMssrSemanticClaimSituation, "function", "semantic claim producers must be part of the public MSSR package contract");

const releaseClaims = buildMssrSemanticClaimSituation([
  {
    kind: "release-version",
    subject: "bridge.live",
    source: "source",
    sourceRef: "package.json",
    authority: "canonical",
    value: "0.6.105",
    required: true,
  },
  {
    kind: "release-version",
    subject: "bridge.live",
    source: "runtime",
    sourceRef: "bridge-health",
    authority: "replica",
    value: "0.6.104",
  },
]);
assert.equal(releaseClaims[0].key, "semantic.release-version:bridge.live");
assert.equal(releaseClaims.find((item) => item.sourceRef === "package.json")?.category, "release");
assert.equal(releaseClaims.find((item) => item.sourceRef === "package.json")?.evidenceClass, "observed");
assert.equal(releaseClaims.find((item) => item.sourceRef === "bridge-health")?.role, "runtime");
assert.equal(releaseClaims.find((item) => item.sourceRef === "bridge-health")?.category, "runtime");

const releaseMismatch = evaluateMssrSituationModel({ boundary: "ordinary", observations: releaseClaims });
assert.equal(releaseMismatch.decision.level, "review");
assert.equal(releaseMismatch.classification.noticeClass, "runtime-integrity");
assert.ok(releaseMismatch.decision.reasonCodes.includes("runtime-state-mismatch"));

const releaseCritical = evaluateMssrSituationModel({
  boundary: "post-restart",
  observations: buildMssrSemanticClaimSituation([
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "source",
      sourceRef: "package.json",
      authority: "canonical",
      value: "0.6.105",
      required: true,
    },
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "runtime",
      sourceRef: "bridge-health",
      authority: "replica",
      value: "0.6.104",
      required: true,
    },
  ]),
});
assert.equal(releaseCritical.decision.level, "error", "required runtime release drift after restart is release-blocking evidence");

const releaseCurrent = evaluateMssrSituationModel({
  boundary: "post-restart",
  observations: buildMssrSemanticClaimSituation([
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "source",
      sourceRef: "package.json",
      authority: "canonical",
      value: "0.6.105",
      required: true,
    },
    {
      kind: "release-version",
      subject: "bridge.live",
      source: "runtime",
      sourceRef: "bridge-health",
      authority: "replica",
      value: "0.6.105",
      required: true,
    },
  ]),
});
assert.equal(releaseCurrent.decision.level, "ok");

const staleProjectState = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrSemanticClaimSituation([
    {
      kind: "state-value",
      subject: "bridge.live-version",
      source: "runtime",
      sourceRef: "bridge-health",
      authority: "canonical",
      value: "0.6.105",
    },
    {
      kind: "state-value",
      subject: "bridge.live-version",
      source: "project-state",
      sourceRef: ".mssr/PROJECT_STATE.md#current-release",
      authority: "historical",
      value: "0.6.104",
    },
  ]),
});
assert.equal(staleProjectState.decision.level, "review");
assert.equal(staleProjectState.classification.noticeClass, "runtime-integrity");
assert.ok(staleProjectState.decision.reasonCodes.includes("state-claim-mismatch"));
assert.ok(staleProjectState.decision.reasonCodes.includes("historical-claim-stale"));
assert.equal(staleProjectState.observations.find((item) => item.role === "state")?.evidenceClass, "declared");

const ownershipMismatch = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrSemanticClaimSituation([
    {
      kind: "ownership",
      subject: "situation-model.policy-owner",
      source: "architecture-decision",
      sourceRef: "docs/decisions/0004-situation-model-project-knowledge.md",
      authority: "canonical",
      value: "portable-mssr",
    },
    {
      kind: "ownership",
      subject: "situation-model.policy-owner",
      source: "project-memory",
      sourceRef: ".mssr/PROJECT_MEMORY.md#legacy-owner",
      authority: "historical",
      value: "bridge-host",
    },
  ]),
});
assert.equal(ownershipMismatch.decision.level, "review");
assert.equal(ownershipMismatch.classification.noticeClass, "context-refresh");
assert.ok(ownershipMismatch.decision.reasonCodes.includes("memory-claim-mismatch"));

const decisionRevisionMismatch = evaluateMssrSituationModel({
  boundary: "context-load",
  observations: buildMssrSemanticClaimSituation([
    {
      kind: "decision-revision",
      subject: "situation-model-contract",
      source: "architecture-decision",
      sourceRef: "docs/decisions/0004-situation-model-project-knowledge.md",
      authority: "canonical",
      revision: "0004-v2",
    },
    {
      kind: "decision-revision",
      subject: "situation-model-contract",
      source: "changelog",
      sourceRef: "changelogs/0.2.25.md",
      authority: "historical",
      revision: "0004-v1",
    },
  ]),
});
assert.equal(decisionRevisionMismatch.decision.level, "review");
assert.equal(decisionRevisionMismatch.classification.noticeClass, "release-integrity");
assert.ok(decisionRevisionMismatch.decision.reasonCodes.includes("historical-claim-stale"));

assert.equal(
  mssrSituationSemanticClaimKey({ kind: "ownership", subject: "router.owner" }),
  "semantic.ownership:router.owner",
);

assert.equal(mssrSituationSemanticClaimSchema.safeParse({
  kind: "release-version",
  subject: "bridge.live",
  source: "runtime",
  sourceRef: "bridge-health",
  authority: "replica",
}).success, false, "observed release claims require an explicit scalar value");

assert.equal(mssrSituationSemanticClaimSchema.safeParse({
  kind: "decision-revision",
  subject: "adr.0004",
  source: "architecture-decision",
  sourceRef: "docs/decisions/0004-situation-model-project-knowledge.md",
  authority: "canonical",
  value: "not-a-revision",
}).success, false, "decision revision claims cannot silently substitute value for revision");

assert.equal(mssrSituationSemanticClaimSchema.safeParse({
  kind: "state-value",
  subject: "bridge.mode",
  source: "project-state",
  sourceRef: ".mssr/PROJECT_STATE.md",
  authority: "canonical",
  value: "line one\nline two",
}).success, false, "semantic values must remain bounded scalars rather than prose blocks");

assert.equal(mssrSituationSemanticClaimSchema.safeParse({
  kind: "state-value",
  subject: "bridge.mode",
  source: "runtime",
  sourceRef: "bridge-health",
  authority: "replica",
  state: "unknown",
  value: "invented",
}).success, false, "unknown evidence cannot carry an invented comparable payload");

console.log("MSSR C2e-D semantic claim producers: PASS");
