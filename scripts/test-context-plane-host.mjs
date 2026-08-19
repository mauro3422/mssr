import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acknowledgeProjectContextInbox,
  loadProjectContextHost,
  mssrContextMessageSchema,
  structuredSkillIntentSchema,
} from "../dist/index.js";

const intent = structuredSkillIntentSchema.parse({
  domains: ["coding"],
  actions: ["review"],
  artifacts: ["code"],
  needs: ["unit-tests"],
  signals: ["nominal"],
  risk: "read-only",
});

const message = (overrides = {}) => mssrContextMessageSchema.parse({
  id: "host-msg",
  kind: "architecture-decision",
  title: "Host decision",
  summary: "Advisory host message.",
  evidence: [{
    kind: "architecture-decision",
    ref: "adr-host",
    summary: "Host evidence.",
    canonicalOwner: "host-fixture",
    provenance: "project",
    freshness: "fresh",
    revision: "rev-1",
  }],
  advisoryActions: ["load-context"],
  domains: ["coding"],
  actions: ["review"],
  dedupeKey: "host-dedupe",
  ...overrides,
});

const stage = "verify";
const now = "2026-08-13T12:00:00.000Z";
const later = "2026-08-13T12:00:10.000Z";

const root = await mkdtemp(join(tmpdir(), "mssr-plane-host-"));
try {
  await mkdir(join(root, ".mssr"), { recursive: true });

  // --- First delivery, then explicit ack persists ---

  const first = await loadProjectContextHost({ projectRoot: root, intent, stage, now, contextMessages: [message()] });
  assert.deepEqual(first.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.equal(first.advisoryOnly, true);
  const ack = await acknowledgeProjectContextInbox({ projectRoot: root, messageIds: ["host-msg"], now });
  assert.equal(ack.advisoryOnly, true);
  assert.deepEqual(ack.acknowledged, ["host-msg"]);
  assert.deepEqual(ack.unknown, []);
  assert.equal(ack.saved, true);

  // --- Acknowledged receipt suppresses the identical message ---

  const identical = await loadProjectContextHost({ projectRoot: root, intent, stage, now, contextMessages: [message()] });
  assert.deepEqual(identical.contextMessages.selected.map((item) => item.id), []);
  assert.deepEqual(identical.inbox.deduplicated, ["host-msg"]);
  assert.deepEqual(identical.inbox.enqueued, []);

  // --- A content/revision change reappears after ack ---

  const changed = await loadProjectContextHost({
    projectRoot: root,
    intent,
    stage,
    now,
    contextMessages: [message({
      summary: "Revised host message.",
      evidence: [{
        kind: "architecture-decision",
        ref: "adr-host",
        summary: "Revised evidence.",
        canonicalOwner: "host-fixture",
        provenance: "project",
        freshness: "fresh",
        revision: "rev-2",
      }],
    })],
  });
  assert.deepEqual(changed.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.deepEqual(changed.inbox.enqueued, ["host-msg"]);
  assert.deepEqual(changed.inbox.deduplicated, []);
  const ackChanged = await acknowledgeProjectContextInbox({ projectRoot: root, messageIds: ["host-msg"], now });
  assert.deepEqual(ackChanged.acknowledged, ["host-msg"]);

  // --- Retention cleanup prunes the tombstone and identical content reappears ---

  const retentionConfig = {
    receiptRetentionMs: 0,
    messageTtlMs: 1_000_000,
    deliveryTtlMs: 1_000_000,
  };
  const afterRetention = await loadProjectContextHost({
    projectRoot: root,
    intent,
    stage,
    now: later,
    inboxConfig: retentionConfig,
    contextMessages: [message()],
  });
  assert.deepEqual(afterRetention.contextMessages.selected.map((item) => item.id), ["host-msg"]);
  assert.deepEqual(afterRetention.inbox.enqueued, ["host-msg"]);
} finally {
  await rm(root, { recursive: true, force: true });
}

// --- Historical .bridge inbox is invisible; explicit legacy paths are rejected ---

const legacyRoot = await mkdtemp(join(tmpdir(), "mssr-plane-host-no-legacy-"));
try {
  await mkdir(join(legacyRoot, ".bridge"), { recursive: true });
  await writeFile(join(legacyRoot, ".bridge", "mssr-context-inbox.json"), "{\"schemaVersion\":2,\"advisoryOnly\":true,\"pending\":[],\"deliveries\":[]}", "utf8");

  const canonicalOnly = await loadProjectContextHost({ projectRoot: legacyRoot, intent, stage, now, contextMessages: [message()] });
  assert.match(canonicalOnly.inbox.filePath.replace(/\\/g, "/"), /\.mssr\/runtime\/context-inbox\.json$/);
  assert.notEqual(canonicalOnly.inbox.source, "legacy");
  assert.deepEqual(canonicalOnly.contextMessages.selected.map((item) => item.id), ["host-msg"]);

  await assert.rejects(
    () => loadProjectContextHost({ projectRoot: legacyRoot, intent, stage, now, inboxPath: ".bridge/mssr-context-inbox.json", contextMessages: [message()] }),
    /must live under \.mssr\/runtime/,
  );
} finally {
  await rm(legacyRoot, { recursive: true, force: true });
}

// --- Phase replans can explicitly omit an already-delivered project core ---

const replanRoot = await mkdtemp(join(tmpdir(), "mssr-plane-host-replan-"));
try {
  await mkdir(join(replanRoot, ".mssr"), { recursive: true });
  await writeFile(join(replanRoot, "core.md"), "# Core\nalways delivered first\n", "utf8");
  await writeFile(join(replanRoot, "module.md"), "# Verify module\nphase specific\n", "utf8");
  await writeFile(join(replanRoot, ".mssr", "project-context.json"), JSON.stringify({
    schemaVersion: 1,
    core: [{ id: "host-core", kind: "context", description: "Host core", source: { path: "core.md" } }],
    modules: [{
      id: "host-verify-module",
      kind: "context",
      description: "Verify-only module",
      source: { path: "module.md" },
      stages: ["verify"],
      domains: ["coding"],
      actions: ["review"],
      artifacts: ["code"],
      needs: [],
      signals: [],
      priority: 10,
      required: false,
    }],
  }), "utf8");

  const withCore = await loadProjectContextHost({ projectRoot: replanRoot, intent, stage, now });
  assert.deepEqual(withCore.projectContext.core.map((item) => item.ref), ["host-core"]);
  assert.deepEqual(withCore.projectContext.selected.map((item) => item.ref), ["host-verify-module"]);

  const withoutCore = await loadProjectContextHost({ projectRoot: replanRoot, intent, stage, now, includeCore: false });
  assert.deepEqual(withoutCore.projectContext.core, []);
  assert.deepEqual(withoutCore.projectContext.selected.map((item) => item.ref), ["host-verify-module"]);
  assert.ok(withoutCore.projectContext.remainingChars > withCore.projectContext.remainingChars);
} finally {
  await rm(replanRoot, { recursive: true, force: true });
}

// --- C2e-E turns stale delivered knowledge into a minimal advisory context request ---

const feedbackRoot = await mkdtemp(join(tmpdir(), "mssr-plane-host-feedback-"));
try {
  await mkdir(join(feedbackRoot, ".mssr"), { recursive: true });
  await writeFile(join(feedbackRoot, ".mssr", "PROJECT_MEMORY.md"), "# Memory\n\n## Current decision\nnew canonical memory\n", "utf8");
  await writeFile(join(feedbackRoot, ".mssr", "project-context.json"), JSON.stringify({
    schemaVersion: 1,
    core: [],
    modules: [{
      id: "feedback-memory-module",
      kind: "memory",
      description: "Memory authority for feedback",
      source: { path: ".mssr/PROJECT_MEMORY.md" },
      stages: ["close"],
      actions: ["maintain"],
      priority: 20,
      maxChars: 1800,
    }],
  }), "utf8");

  const canonicalOwner = feedbackRoot.replace(/\\/g, "/");
  const staleMemoryMessage = mssrContextMessageSchema.parse({
    id: "feedback-old-memory",
    kind: "stale-context",
    title: "Older memory snapshot",
    summary: "Previously delivered memory revision.",
    evidence: [{
      kind: "project-memory",
      ref: ".mssr/PROJECT_MEMORY.md",
      summary: "Historical memory evidence.",
      canonicalOwner,
      provenance: "project",
      freshness: "fresh",
      revision: "old-memory-revision",
    }],
    advisoryActions: ["load-context"],
    domains: ["coding"],
    actions: ["review"],
    dedupeKey: "feedback-old-memory",
  });

  const feedback = await loadProjectContextHost({
    projectRoot: feedbackRoot,
    intent,
    stage,
    now,
    contextMessages: [staleMemoryMessage],
  });
  assert.equal(feedback.situation.decision.level, "review");
  assert.deepEqual(feedback.projectContext.selected, [], "C2e-E must not auto-load the recommended module");
  assert.equal(feedback.contextFeedback.advisoryOnly, true);
  assert.equal(feedback.contextFeedback.requests.length, 1);
  assert.equal(feedback.contextFeedback.requests[0].kind, "project-context-entry");
  assert.equal(feedback.contextFeedback.requests[0].resolution, "exact-entry");
  assert.equal(feedback.contextFeedback.requests[0].entry?.id, "feedback-memory-module");
  assert.equal(feedback.contextFeedback.requests[0].entry?.suggestedMaxChars, 1800);
  assert.equal(feedback.contextFeedback.requests[0].authorityRef, ".mssr/PROJECT_MEMORY.md");
  assert.equal(feedback.contextFeedback.requests[0].action, "revalidate-context-evidence");
} finally {
  await rm(feedbackRoot, { recursive: true, force: true });
}

console.log("context plane host tests passed");
