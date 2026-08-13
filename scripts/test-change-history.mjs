import assert from "node:assert/strict";
import {
  evaluateProjectChangeConsistency,
  parseVersionChangelogMarkdown,
  shouldLoadProjectChangeHistory,
} from "../dist/change-history.js";

const markdown = [
  "# 0.2.6 — 2026-08-13",
  "",
  "## Contract",
  "",
  "- Summary: Add project change consistency governance.",
  "- Areas: project-context, changelog, maintenance",
  "- PROJECT_CONTEXT: reviewed-none",
  "- PROJECT_MEMORY: updated",
  "- PROJECT_STATE: updated",
  "",
].join("\n");

const parsed = parseVersionChangelogMarkdown(markdown);
assert.equal(parsed.version, "0.2.6");
assert.deepEqual(parsed.areas, ["project-context", "changelog", "maintenance"]);
assert.equal(parsed.knowledgeImpact.memory, "updated");

assert.deepEqual(
  shouldLoadProjectChangeHistory({
    stage: "implement",
    intent: {
      domains: ["coding"],
      actions: ["debug"],
      artifacts: ["project"],
      needs: ["history-recovery"],
      signals: ["error-observed"],
      risk: "read-only",
      ambiguity: "low",
    },
  }),
  { load: true, reasons: ["action-history", "need-history-recovery", "non-nominal-history-signal"] },
);

assert.deepEqual(
  shouldLoadProjectChangeHistory({
    stage: "implement",
    intent: {
      domains: ["coding"],
      actions: ["create"],
      artifacts: ["code"],
      needs: [],
      signals: ["nominal"],
      risk: "write",
      ambiguity: "low",
    },
  }),
  { load: false, reasons: [] },
);

const passing = evaluateProjectChangeConsistency({
  packageVersion: "0.2.6",
  changelog: parsed,
  indexContainsVersion: true,
  changedPaths: [".bridge/PROJECT_MEMORY.md", ".bridge/PROJECT_STATE.md", "src/change-history.ts", "changelogs/0.2.6.md"],
  authorityPaths: {
    context: ".bridge/PROJECT_CONTEXT.md",
    memory: ".bridge/PROJECT_MEMORY.md",
    state: ".bridge/PROJECT_STATE.md",
  },
});
assert.equal(passing.ok, true);
assert.equal(passing.issues.length, 0);

const pending = parseVersionChangelogMarkdown(markdown.replace("PROJECT_STATE: updated", "PROJECT_STATE: pending"));
const failing = evaluateProjectChangeConsistency({
  packageVersion: "0.2.6",
  changelog: pending,
  indexContainsVersion: false,
  changedPaths: ["src/change-history.ts"],
  authorityPaths: {
    context: ".bridge/PROJECT_CONTEXT.md",
    memory: ".bridge/PROJECT_MEMORY.md",
    state: ".bridge/PROJECT_STATE.md",
  },
});
assert.equal(failing.ok, false);
assert.equal(failing.issues.some((issue) => issue.code === "changelog-index-missing-version"), true);
assert.equal(failing.issues.some((issue) => issue.code === "project-state-pending"), true);
assert.equal(failing.issues.some((issue) => issue.code === "project-memory-not-in-change-set" && issue.severity === "warning"), true);

assert.throws(() => parseVersionChangelogMarkdown(markdown.replace("PROJECT_MEMORY: updated", "PROJECT_MEMORY: maybe")));

console.log("change history tests passed");
