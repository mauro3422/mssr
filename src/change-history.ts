import { z } from "zod";
import type { SkillStage, StructuredSkillIntent } from "./skill-routing.js";

export const PROJECT_KNOWLEDGE_IMPACT_STATUSES = ["updated", "reviewed-none", "pending"] as const;
export type ProjectKnowledgeImpactStatus = typeof PROJECT_KNOWLEDGE_IMPACT_STATUSES[number];

export const projectKnowledgeImpactSchema = z.object({
  context: z.enum(PROJECT_KNOWLEDGE_IMPACT_STATUSES),
  memory: z.enum(PROJECT_KNOWLEDGE_IMPACT_STATUSES),
  state: z.enum(PROJECT_KNOWLEDGE_IMPACT_STATUSES),
}).strict();

export const versionChangelogRecordSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  summary: z.string().min(1).max(600),
  areas: z.array(z.string().min(1).max(80)).max(24).default([]),
  knowledgeImpact: projectKnowledgeImpactSchema,
}).strict();

export type VersionChangelogRecord = z.infer<typeof versionChangelogRecordSchema>;

function readRequiredBullet(markdown: string, key: string): string {
  const match = markdown.match(new RegExp(`^[-*]\\s+${key}\\s*:\\s*(.+?)\\s*$`, "im"));
  if (!match) throw new Error(`Missing changelog contract field '${key}'.`);
  return match[1].trim();
}

export function parseVersionChangelogMarkdown(markdown: string): VersionChangelogRecord {
  const heading = markdown.match(/^#\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\s+[—-]\s+(\d{4}-\d{2}-\d{2})\s*$/m);
  if (!heading) throw new Error("Version changelog must begin with '# X.Y.Z — YYYY-MM-DD'.");
  const summary = readRequiredBullet(markdown, "Summary");
  const areasRaw = readRequiredBullet(markdown, "Areas");
  const impact = {
    context: readRequiredBullet(markdown, "PROJECT_CONTEXT"),
    memory: readRequiredBullet(markdown, "PROJECT_MEMORY"),
    state: readRequiredBullet(markdown, "PROJECT_STATE"),
  };
  return versionChangelogRecordSchema.parse({
    version: heading[1],
    date: heading[2],
    summary,
    areas: areasRaw.toLowerCase() === "none" ? [] : areasRaw.split(",").map((item) => item.trim()).filter(Boolean),
    knowledgeImpact: impact,
  });
}

export function shouldLoadProjectChangeHistory(args: {
  intent?: StructuredSkillIntent;
  stage: SkillStage;
}): { load: boolean; reasons: string[] } {
  if (!args.intent) return { load: false, reasons: [] };
  const reasons: string[] = [];
  const actions = new Set<string>(args.intent.actions ?? []);
  const needs = new Set<string>(args.intent.needs ?? []);
  const signals = new Set<string>(args.intent.signals ?? []);
  if (["debug", "recover"].some((value) => actions.has(value))) reasons.push("action-history");
  if (needs.has("history-recovery")) reasons.push("need-history-recovery");
  if (["error-observed", "warning-observed", "conflicting-evidence", "recovery-needed", "repeated-friction"].some((value) => signals.has(value))) {
    reasons.push("non-nominal-history-signal");
  }
  if (["verify", "persist", "close"].includes(args.stage) && ["version", "publish", "maintain"].some((value) => actions.has(value))) {
    reasons.push("release-lifecycle");
  }
  return { load: reasons.length > 0, reasons };
}

export type ProjectChangeConsistencyIssue = {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
};

export function evaluateProjectChangeConsistency(args: {
  packageVersion?: string | null;
  changelog?: VersionChangelogRecord | null;
  indexContainsVersion: boolean;
  changedPaths: string[];
  authorityPaths?: {
    context?: string;
    memory?: string;
    state?: string;
  };
}): {
  ok: boolean;
  issues: ProjectChangeConsistencyIssue[];
  requiredKnowledgeUpdates: Array<"context" | "memory" | "state">;
} {
  const issues: ProjectChangeConsistencyIssue[] = [];
  const changed = new Set(args.changedPaths.map((value) => value.replace(/\\/g, "/").toLowerCase()));
  if (args.packageVersion && !args.changelog) {
    issues.push({ code: "missing-version-changelog", severity: "error", message: `Missing changelogs/${args.packageVersion}.md for the current package version.` });
  }
  if (args.packageVersion && args.changelog && args.packageVersion !== args.changelog.version) {
    issues.push({ code: "version-changelog-mismatch", severity: "error", message: `Package version ${args.packageVersion} does not match changelog version ${args.changelog.version}.` });
  }
  if (args.changelog && !args.indexContainsVersion) {
    issues.push({ code: "changelog-index-missing-version", severity: "error", message: `changelogs/INDEX.md does not reference ${args.changelog.version}.` });
  }

  const requiredKnowledgeUpdates: Array<"context" | "memory" | "state"> = [];
  if (args.changelog) {
    for (const kind of ["context", "memory", "state"] as const) {
      const status = args.changelog.knowledgeImpact[kind];
      if (status === "pending") {
        requiredKnowledgeUpdates.push(kind);
        issues.push({ code: `project-${kind}-pending`, severity: "error", message: `PROJECT_${kind.toUpperCase()} impact is still pending in the version changelog.` });
        continue;
      }
      if (status !== "updated") continue;
      const authorityPath = args.authorityPaths?.[kind]?.replace(/\\/g, "/").toLowerCase();
      if (!authorityPath) {
        issues.push({ code: `project-${kind}-authority-missing`, severity: "error", message: `Changelog declares PROJECT_${kind.toUpperCase()} updated, but no authority path was supplied.` });
      } else if (!changed.has(authorityPath)) {
        issues.push({ code: `project-${kind}-not-in-change-set`, severity: "warning", message: `Changelog declares PROJECT_${kind.toUpperCase()} updated, but ${authorityPath} is not in the observed Git change set.` });
      }
    }
  }

  return {
    ok: !issues.some((issue) => issue.severity === "error"),
    issues,
    requiredKnowledgeUpdates,
  };
}
