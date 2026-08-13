import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  mssrContextMessageSchema,
  produceContextMessages,
  selectMssrContextMessages,
  structuredSkillIntentSchema,
} from "../dist/index.js";
import { collectRepositoryContextMessages } from "../dist/context-message-repository-provider.js";

const MARKER = "HUGE_LEAK_MARKER_8f2a91";

async function write(root, rel, content) {
  const abs = path.join(root, ...rel.split("/"));
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

async function buildRepository(root) {
  await write(root, "CHANGELOG.md", "# Changelog\n\n## Unreleased\n\nNotes.\n");
  await write(root, "docs/PROJECT_CONTEXT.md", "# Project Context\n\nAuthoritative project facts.\n");
  await write(root, "docs/INCIDENTS.md", "# Incidents\n\nPast incident notes.\n");
  await write(root, "docs/decisions/README.md", "# Decisions Index\n\nListing only.\n");
  await write(root, "docs/decisions/0001-use-mssr.md", "# Use MSSR\n\nAdopt MSSR for routing.\n");
  await write(root, "docs/decisions/0002-patterns.md", "# Routing Patterns\n\nObserved patterns.\n");
  await write(root, "changelogs/0.2.0.md", "# 0.2.0\n\nOlder release.\n");
  await write(root, "changelogs/1.0.0.md", "# 1.0.0\n\nNewest release.\n");
  await write(root, "changelogs/2.0.0-beta.1.md", "# 2.0.0-beta.1\n\nPre-release must be ignored.\n");
  await write(root, ".bridge/PROJECT_CONTEXT.md", "# Bridge Context\n\nBridge facts.\n");
  await write(root, ".bridge/PROJECT_MEMORY.md", "# Bridge Memory\n\nMemory notes.\n");
  await write(
    root,
    ".bridge/PROJECT_STATE.md",
    `${"# STATE HEADING ".repeat(20)}\n\n${"ABCDEFGHIJKLMNOPQRSTUVWX".repeat(20)}\n`,
  );
  const payload = "lorem-ipsum-payload-line\n".repeat(12000);
  await write(
    root,
    "docs/decisions/0003-huge.md",
    `# Huge decision\n\nDecision rationale body.\n${payload}${MARKER}\n`,
  );
}

const validGitReceipt = {
  id: "git-rev-abc123",
  sourceKind: "git-receipt",
  ref: "commit/abc123",
  title: "Git receipt",
  summary: "Commit abc123 recorded.",
  canonicalOwner: "git-local",
  provenance: "git",
  availability: true,
  revision: "rev-abc123",
};

const validProviderReceipt = {
  id: "prov-check-1",
  sourceKind: "provider-receipt",
  ref: "provider-check-1",
  title: "Provider receipt",
  summary: "Provider health check passed.",
  canonicalOwner: "provider-local",
  provenance: "provider",
  availability: true,
  revision: "prov-1",
};

const invalidReceipt = { ref: "broken-receipt", sourceKind: "git-receipt" };
const wrongKindProvider = { ...validProviderReceipt, id: "prov-wrong-kind" };
const wrongKindGit = { ...validGitReceipt, id: "git-wrong-kind" };

const EXPECTED_FACT_REFS = [
  ".bridge/PROJECT_CONTEXT.md",
  ".bridge/PROJECT_MEMORY.md",
  ".bridge/PROJECT_STATE.md",
  "CHANGELOG.md",
  "changelogs/1.0.0.md",
  "docs/INCIDENTS.md",
  "docs/PROJECT_CONTEXT.md",
  "docs/decisions/0001-use-mssr.md",
  "docs/decisions/0002-patterns.md",
  "docs/decisions/0003-huge.md",
];

let root;
try {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "mssr-repo-provider-"));
  await buildRepository(root);

  // --- Baseline run with receipts covering every merge path ---

  // --- Invalid receipts are rejected by the options schema before merging ---

  await assert.rejects(
    () => collectRepositoryContextMessages({
      projectRoot: root,
      gitReceipts: [invalidReceipt],
    }),
    (error) => error?.name === "ZodError" && JSON.stringify(error).includes("gitReceipts"),
  );

  const result = await collectRepositoryContextMessages({
    projectRoot: root,
    gitReceipts: [validGitReceipt, wrongKindProvider],
    providerReceipts: [validProviderReceipt, wrongKindGit],
  });

  const refs = result.observations.map((observation) => observation.ref);
  const factObservations = result.observations.filter((observation) =>
    EXPECTED_FACT_REFS.includes(observation.ref),
  );

  // --- Decisions README excluded ---

  assert.equal(refs.includes("docs/decisions/README.md"), false);
  assert.equal(refs.includes("docs/decisions/0001-use-mssr.md"), true);
  assert.equal(refs.includes("docs/decisions/0002-patterns.md"), true);

  // --- Newest semver changelog only ---

  assert.equal(refs.includes("changelogs/1.0.0.md"), true);
  assert.equal(refs.includes("changelogs/0.2.0.md"), false);
  assert.equal(refs.includes("changelogs/2.0.0-beta.1.md"), false);

  // --- Sorted relative refs for file-derived observations ---

  assert.deepEqual(
    factObservations.map((observation) => observation.ref),
    [...EXPECTED_FACT_REFS].sort(),
  );

  // --- Distinct PROJECT_CONTEXT / MEMORY / STATE source kinds ---

  const bridgeContext = result.observations.find((o) => o.ref === ".bridge/PROJECT_CONTEXT.md");
  const bridgeMemory = result.observations.find((o) => o.ref === ".bridge/PROJECT_MEMORY.md");
  const bridgeState = result.observations.find((o) => o.ref === ".bridge/PROJECT_STATE.md");
  assert.equal(bridgeContext.sourceKind, "project-context");
  assert.equal(bridgeMemory.sourceKind, "project-memory");
  assert.equal(bridgeState.sourceKind, "project-state");
  assert.equal(new Set([bridgeContext.sourceKind, bridgeMemory.sourceKind, bridgeState.sourceKind]).size, 3);

  // --- Bounded title/summary ---

  for (const observation of result.observations) {
    assert.equal(observation.title.length <= 120, true, observation.ref);
    assert.equal(observation.summary.length <= 300, true, observation.ref);
  }
  assert.equal(bridgeState.title.length, 120);
  assert.equal(bridgeState.summary.length, 300);

  // --- 64-char sha256 for file-derived observations ---

  for (const observation of factObservations) {
    assert.match(observation.revision, /^[0-9a-f]{64}$/);
    assert.equal(observation.provenance, "project");
    assert.equal(observation.availability, true);
    assert.equal(observation.authoritative, true);
  }

  // --- Produced messages ---

  assert.equal(result.messages.length, result.observations.length);
  for (const message of result.messages) {
    assert.equal(mssrContextMessageSchema.safeParse(message).success, true);
  }
  const byRef = new Map(result.messages.map((message) => [message.evidence[0]?.ref, message]));
  assert.equal(byRef.get(".bridge/PROJECT_CONTEXT.md").kind, "context-request");
  assert.equal(byRef.get(".bridge/PROJECT_CONTEXT.md").evidence[0].kind, "project-context");
  assert.equal(byRef.get(".bridge/PROJECT_MEMORY.md").kind, "context-request");
  assert.equal(byRef.get(".bridge/PROJECT_MEMORY.md").evidence[0].kind, "project-memory");
  assert.equal(byRef.get(".bridge/PROJECT_STATE.md").kind, "context-request");
  assert.equal(byRef.get(".bridge/PROJECT_STATE.md").evidence[0].kind, "project-state");
  assert.equal(byRef.get("CHANGELOG.md").kind, "recent-changelog");
  assert.equal(byRef.get("docs/INCIDENTS.md").kind, "related-incident");
  assert.equal(byRef.get("docs/decisions/0001-use-mssr.md").kind, "architecture-decision");
  assert.equal(byRef.get("commit/abc123").kind, "publication-receipt-stale");
  assert.equal(byRef.get("commit/abc123").evidence[0].provenance, "git");
  assert.equal(byRef.get("provider-check-1").kind, "provider-degraded");
  assert.equal(byRef.get("provider-check-1").evidence[0].provenance, "provider");

  // --- Wrong-kind receipts produce diagnostics, not observations ---

  const issues = result.diagnostics.map((diagnostic) => diagnostic.issue);
  assert.equal(issues.filter((issue) => issue === "source-kind-mismatch").length, 2);
  assert.equal(issues.includes("truncated-at-128kib"), true);
  assert.deepEqual(
    result.diagnostics.filter((diagnostic) => diagnostic.issue === "source-kind-mismatch").map((d) => d.ref).sort(),
    ["commit/abc123", "provider-check-1"],
  );
  assert.equal(refs.includes("broken-receipt"), false);

  // --- Truncated oversized file: diagnostic, and no source content leaks ---

  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.ref === "docs/decisions/0003-huge.md" && diagnostic.issue === "truncated-at-128kib",
    ),
    true,
  );
  assert.equal(refs.includes("docs/decisions/0003-huge.md"), true);
  const serialized = JSON.stringify({
    observations: result.observations,
    messages: result.messages,
    diagnostics: result.diagnostics,
    overflow: result.overflow,
  });
  assert.equal(serialized.includes(MARKER), false);

  // --- Cap overflow: maxObservations stops facts and receipts ---

  const capped = await collectRepositoryContextMessages({
    projectRoot: root,
    maxObservations: 2,
    gitReceipts: [validGitReceipt],
    providerReceipts: [validProviderReceipt],
  });

  assert.equal(capped.observations.length, 2);
  assert.deepEqual(
    capped.observations.map((observation) => observation.ref),
    [".bridge/PROJECT_CONTEXT.md", ".bridge/PROJECT_MEMORY.md"],
  );
  assert.deepEqual(
    capped.overflow,
    [
      ".bridge/PROJECT_STATE.md",
      "CHANGELOG.md",
      "changelogs/1.0.0.md",
      "docs/INCIDENTS.md",
      "docs/PROJECT_CONTEXT.md",
      "docs/decisions/0001-use-mssr.md",
      "docs/decisions/0002-patterns.md",
      "docs/decisions/0003-huge.md",
      "commit/abc123",
      "provider-check-1",
    ],
  );
  assert.equal(capped.messages.length, 2);

  // --- Repository-fact selector activation ---

  const selectRefs = (messages, intent, stage) => selectMssrContextMessages({
    messages,
    intent: structuredSkillIntentSchema.parse(intent),
    stage,
    maxMessages: 32,
  }).selected.map((message) => message.evidence[0]?.ref).filter(Boolean);

  const incidentSelection = selectRefs(
    result.messages,
    { domains: ["coding"], actions: ["analyze"], signals: ["error-observed"], risk: "read-only" },
    "implement",
  );
  assert.equal(incidentSelection.includes("docs/INCIDENTS.md"), true);
  assert.equal(incidentSelection.includes("CHANGELOG.md"), false);
  assert.equal(incidentSelection.includes(".bridge/PROJECT_STATE.md"), false);

  const changelogSelection = selectRefs(
    result.messages,
    { domains: ["git"], actions: ["version"], artifacts: ["document"], signals: ["nominal"], risk: "write" },
    "persist",
  );
  assert.equal(changelogSelection.includes("CHANGELOG.md"), true);
  assert.equal(changelogSelection.includes("changelogs/1.0.0.md"), true);
  assert.equal(changelogSelection.includes("docs/INCIDENTS.md"), false);

  const architectureSelection = selectRefs(
    result.messages,
    { domains: ["coding"], actions: ["review"], artifacts: ["repository"], signals: ["nominal"], risk: "read-only" },
    "verify",
  );
  assert.equal(architectureSelection.includes("docs/decisions/0001-use-mssr.md"), true);
  assert.equal(architectureSelection.includes("docs/decisions/0002-patterns.md"), true);
  assert.equal(architectureSelection.includes("docs/decisions/0003-huge.md"), true);
  assert.equal(architectureSelection.includes("docs/INCIDENTS.md"), false);

  const resumeSelection = selectRefs(
    result.messages,
    { domains: ["coding"], actions: ["design"], needs: ["history-recovery"], signals: ["nominal"], risk: "read-only" },
    "resume",
  );
  for (const ref of [".bridge/PROJECT_CONTEXT.md", ".bridge/PROJECT_MEMORY.md", ".bridge/PROJECT_STATE.md", "docs/PROJECT_CONTEXT.md"]) {
    assert.equal(resumeSelection.includes(ref), true, ref);
  }
  assert.equal(resumeSelection.includes("docs/INCIDENTS.md"), false);

  const blenderSelection = selectRefs(
    result.messages,
    { domains: ["blender"], actions: ["edit"], artifacts: ["model-3d"], signals: ["nominal"], risk: "write" },
    "implement",
  );
  assert.deepEqual(blenderSelection, []);

  const selectorlessObservation = {
    id: "manual-noselector-fact",
    sourceKind: "project-context",
    ref: "manual/noselector.md",
    title: "Selector-less fact",
    summary: "Manually produced without selectors.",
    canonicalOwner: "mssr-test",
    provenance: "manual",
    availability: true,
    revision: "rev-manual",
  };
  const selectorlessMessage = produceContextMessages([selectorlessObservation])[0];
  const selectorlessDecision = selectMssrContextMessages({
    messages: [selectorlessMessage],
    intent: structuredSkillIntentSchema.parse({
      domains: ["coding"],
      actions: ["design"],
      needs: ["history-recovery"],
      signals: ["recovery-needed"],
      risk: "read-only",
    }),
    stage: "resume",
  }).decisions[0];
  assert.equal(selectorlessDecision.selected, false);
  assert.equal(selectorlessDecision.reason, "intent-mismatch");

  // --- Explicit manifest override and fail-closed behavior ---

  await write(root, ".bridge/context-messages.json", JSON.stringify({
    schemaVersion: 1,
    entries: {
      "docs/INCIDENTS.md": { signals: ["replan-needed"], priority: 25 },
    },
  }));

  const overridden = await collectRepositoryContextMessages({ projectRoot: root });
  const overriddenIncident = overridden.observations.find((observation) => observation.ref === "docs/INCIDENTS.md");
  assert.deepEqual([...overriddenIncident.signals], ["replan-needed"]);
  assert.equal(overriddenIncident.priority, 25);
  const replanSelection = selectMssrContextMessages({
    messages: overridden.messages,
    intent: structuredSkillIntentSchema.parse({ domains: ["coding"], actions: ["analyze"], signals: ["replan-needed"], risk: "read-only" }),
    stage: "implement",
  });
  assert.equal(replanSelection.selected.some((message) => message.evidence[0]?.ref === "docs/INCIDENTS.md"), true);

  await write(root, ".bridge/context-messages.json", JSON.stringify({
    schemaVersion: 1,
    entries: {
      "docs/INCIDENTS.md": { signals: ["replan-needed"] },
      "docs/missing.md": { signals: ["recovery-needed"] },
    },
  }));
  const unknownRefResult = await collectRepositoryContextMessages({ projectRoot: root });
  assert.equal(
    unknownRefResult.diagnostics.some((diagnostic) => diagnostic.issue === "context-messages-manifest-unknown-ref"),
    true,
  );
  const failedIncident = unknownRefResult.observations.find((observation) => observation.ref === "docs/INCIDENTS.md");
  assert.deepEqual(
    [...failedIncident.signals],
    ["error-observed", "warning-observed", "repeated-friction", "recovery-needed"],
  );

  await write(root, ".bridge/context-messages.json", JSON.stringify({
    schemaVersion: 1,
    entries: { "docs/INCIDENTS.md": { signals: ["replan-needed"] }, "../escape.md": { signals: ["nominal"] } },
  }));
  const unsafeRefResult = await collectRepositoryContextMessages({ projectRoot: root });
  assert.equal(
    unsafeRefResult.diagnostics.some((diagnostic) => diagnostic.issue === "context-messages-manifest-unsafe-ref"),
    true,
  );
  const unsafeIncident = unsafeRefResult.observations.find((observation) => observation.ref === "docs/INCIDENTS.md");
  assert.deepEqual(
    [...unsafeIncident.signals],
    ["error-observed", "warning-observed", "repeated-friction", "recovery-needed"],
  );

  await write(root, ".bridge/context-messages.json", "{ not-json");
  const malformedResult = await collectRepositoryContextMessages({ projectRoot: root });
  assert.equal(
    malformedResult.diagnostics.some((diagnostic) => diagnostic.issue === "context-messages-manifest-invalid-json"),
    true,
  );
  const malformedIncident = malformedResult.observations.find((observation) => observation.ref === "docs/INCIDENTS.md");
  assert.deepEqual(
    [...malformedIncident.signals],
    ["error-observed", "warning-observed", "repeated-friction", "recovery-needed"],
  );

  await write(root, ".bridge/context-messages.json", `{
  "schemaVersion": 1,
  "entries": {
    "docs/INCIDENTS.md": { "signals": ["replan-needed"] },
    "docs/INCIDENTS.md": { "signals": ["error-observed"] }
  }
}`);
  const duplicateResult = await collectRepositoryContextMessages({ projectRoot: root });
  assert.equal(
    duplicateResult.diagnostics.some((diagnostic) => diagnostic.issue.startsWith("context-messages-manifest-duplicate-ref")),
    true,
  );
  const duplicateIncident = duplicateResult.observations.find((observation) => observation.ref === "docs/INCIDENTS.md");
  assert.deepEqual(
    [...duplicateIncident.signals],
    ["error-observed", "warning-observed", "repeated-friction", "recovery-needed"],
  );
} finally {
  if (root) await fs.rm(root, { recursive: true, force: true });
}

console.log("context message repository provider tests passed");
