import fs from "node:fs/promises";
import path from "node:path";
import { mssrFirstPartySkillsRoot } from "./first-party-skills.js";
import { planMssrProjectContextModularization } from "./project-context-modularization.js";
import { skillContextManifestSchema, type SkillContextSource } from "./skill-context.js";
import { extractMarkdownSections } from "./skill-context-loader.js";
import {
  enqueueMssrSemanticCurationSource,
  type MssrSemanticCurationPersistentQueueEntry,
} from "./semantic-curation-queue-store.js";
import type { MssrSemanticCurationQueueReason } from "./semantic-curation-queue.js";

export type MssrSemanticCurationEnqueueResult = {
  queued: Array<{ entry: MssrSemanticCurationPersistentQueueEntry; inserted: boolean; merged: boolean }>;
  skipped: Array<{ sourceRef: string; reason: string }>;
};

function uniqueReasons(reasons: readonly MssrSemanticCurationQueueReason[]): MssrSemanticCurationQueueReason[] {
  return [...new Set(reasons)];
}

export async function enqueueMssrProjectContextCurationCandidates(args: {
  projectRoot: string;
  queuePath?: string;
  includeWatch?: boolean;
}): Promise<MssrSemanticCurationEnqueueResult> {
  const plan = await planMssrProjectContextModularization(args.projectRoot);
  const queued: MssrSemanticCurationEnqueueResult["queued"] = [];
  const skipped: MssrSemanticCurationEnqueueResult["skipped"] = [];
  if (plan.status === "blocked") return { queued, skipped: [{ sourceRef: ".mssr/project-context.json", reason: plan.reason }] };

  for (const source of plan.authoritySections) {
    const reasons: MssrSemanticCurationQueueReason[] = [];
    if (source.pressureSource === "entry-budget") reasons.push("project-context-entry-budget-exceeded");
    if (source.pressureSource === "authority-size") reasons.push("project-root-file-growing");
    if (source.requiresSelectorReview) reasons.push("semantic-segmentation-review-required");
    const hasReviewSection = source.largestSections.some((section) => section.recommendation === "REVIEW_FOR_MODULE_SPLIT" || section.recommendation === "REVIEW_FOR_KNOWLEDGE_CAPTURE");
    const onlyWatch = !source.requiresSelectorReview && !hasReviewSection && plan.health.level === "watch";
    if (onlyWatch && !args.includeWatch) {
      skipped.push({ sourceRef: source.authority, reason: "watch-only-pressure" });
      continue;
    }
    if (reasons.length === 0) reasons.push("manual-review");
    queued.push(await enqueueMssrSemanticCurationSource({
      projectRoot: args.projectRoot,
      sourceRef: source.authority,
      reasons: uniqueReasons(reasons),
      priority: source.requiresSelectorReview ? 80 : hasReviewSection ? 60 : 30,
      queuePath: args.queuePath,
    }));
  }
  return { queued, skipped };
}

async function collectSkillFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (directory: string) => {
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile() && entry.name.toLowerCase() === "skill.md") files.push(target);
    }
  };
  await walk(root);
  return files;
}

function insideSkillDirectory(skillDir: string, relative: string): string {
  if (path.isAbsolute(relative) || relative.split(/[\\/]+/).includes("..")) throw new Error(`Skill context path must stay inside the skill directory: ${relative}`);
  const root = path.resolve(skillDir);
  const candidate = path.resolve(root, relative);
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Skill context path escapes the skill directory: ${relative}`);
  return candidate;
}

async function materializeSkillSource(source: SkillContextSource, skillDir: string, fullSkill: string): Promise<{ text: string; absolute: string }> {
  if (source.path) {
    const absolute = insideSkillDirectory(skillDir, source.path);
    return { text: await fs.readFile(absolute, "utf8"), absolute };
  }
  return { text: extractMarkdownSections(fullSkill, source.sections ?? []), absolute: path.join(skillDir, "SKILL.md") };
}

async function enqueueSkillSource(args: {
  root: string;
  absolute: string;
  queuePath?: string;
  priority: number;
  reasons?: readonly MssrSemanticCurationQueueReason[];
}): Promise<{ entry: MssrSemanticCurationPersistentQueueEntry; inserted: boolean; merged: boolean }> {
  return enqueueMssrSemanticCurationSource({
    projectRoot: args.root,
    sourceRef: path.relative(args.root, args.absolute).replace(/\\/g, "/"),
    reasons: args.reasons ?? ["skill-context-budget-exceeded"],
    priority: args.priority,
    queuePath: args.queuePath,
  });
}

export async function enqueueMssrOwnedSkillCurationCandidates(args: {
  roots?: readonly string[];
  queuePath?: string;
  skillCharsThreshold?: number;
  referenceCharsThreshold?: number;
} = {}): Promise<MssrSemanticCurationEnqueueResult> {
  const roots = [...new Set((args.roots?.length ? args.roots : [mssrFirstPartySkillsRoot()]).map((root) => path.resolve(root)))];
  const skillCharsThreshold = Math.max(4_000, Math.floor(args.skillCharsThreshold ?? 12_000));
  const referenceCharsThreshold = Math.max(4_000, Math.floor(args.referenceCharsThreshold ?? 14_000));
  const queued: MssrSemanticCurationEnqueueResult["queued"] = [];
  const skipped: MssrSemanticCurationEnqueueResult["skipped"] = [];

  for (const root of roots) {
    for (const skillPath of await collectSkillFiles(root)) {
      const skillDir = path.dirname(skillPath);
      let fullSkill: string;
      try { fullSkill = await fs.readFile(skillPath, "utf8"); } catch {
        skipped.push({ sourceRef: path.relative(root, skillPath).replace(/\\/g, "/"), reason: "unreadable-skill" });
        continue;
      }

      let manifest: ReturnType<typeof skillContextManifestSchema.parse> | null = null;
      let manifestInvalid = false;
      try {
        manifest = skillContextManifestSchema.parse(JSON.parse(await fs.readFile(path.join(skillDir, "context-modules.json"), "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") manifestInvalid = true;
      }

      if (!manifest) {
        const monolithic = fullSkill.length > skillCharsThreshold || fullSkill.split(/\r?\n/).length > 500;
        if (monolithic) queued.push(await enqueueSkillSource({ root, absolute: skillPath, queuePath: args.queuePath, priority: 70, reasons: manifestInvalid ? ["skill-context-budget-exceeded", "manual-review"] : ["skill-context-budget-exceeded"] }));
        else if (manifestInvalid) skipped.push({ sourceRef: path.relative(root, skillPath).replace(/\\/g, "/"), reason: "invalid-context-manifest-small-core" });
        continue;
      }

      try {
        const core = await materializeSkillSource(manifest.core, skillDir, fullSkill);
        if (core.text.length > skillCharsThreshold) queued.push(await enqueueSkillSource({ root, absolute: core.absolute, queuePath: args.queuePath, priority: 80 }));
      } catch (error) {
        skipped.push({ sourceRef: path.relative(root, skillPath).replace(/\\/g, "/"), reason: `core-materialization-failed:${error instanceof Error ? error.message : String(error)}`.slice(0, 300) });
      }

      for (const module of manifest.modules) {
        try {
          const materialized = await materializeSkillSource(module.source, skillDir, fullSkill);
          const budget = module.maxChars ?? referenceCharsThreshold;
          if (materialized.text.length <= budget) continue;
          queued.push(await enqueueSkillSource({ root, absolute: materialized.absolute, queuePath: args.queuePath, priority: module.required ? 80 : 60 }));
        } catch (error) {
          skipped.push({ sourceRef: `${path.relative(root, skillPath).replace(/\\/g, "/")}#${module.id}`, reason: `module-materialization-failed:${error instanceof Error ? error.message : String(error)}`.slice(0, 300) });
        }
      }
    }
  }
  return { queued, skipped };
}

export async function enqueueMssrSemanticMaintenanceCandidates(args: {
  projectRoots?: readonly string[];
  skillRoots?: readonly string[];
  queuePath?: string;
  includeWatch?: boolean;
}): Promise<{
  projects: Array<{ projectRoot: string; result: MssrSemanticCurationEnqueueResult }>;
  skills: MssrSemanticCurationEnqueueResult;
}> {
  const projects = [];
  for (const projectRoot of args.projectRoots ?? []) {
    projects.push({
      projectRoot: path.resolve(projectRoot),
      result: await enqueueMssrProjectContextCurationCandidates({ projectRoot, queuePath: args.queuePath, includeWatch: args.includeWatch }),
    });
  }
  const skills = await enqueueMssrOwnedSkillCurationCandidates({ roots: args.skillRoots, queuePath: args.queuePath });
  return { projects, skills };
}
