import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  PROJECT_CONTEXT_TOPICS,
  projectContextManifestSchema,
  type ProjectContextCore,
  type ProjectContextManifest,
  type ProjectContextModule,
  type ProjectContextTopic,
} from "./project-context.js";
import { extractProjectContextSections } from "./project-context-loader.js";
import { MSSR_PROJECT_CONTROL_FILES, MSSR_PROJECT_HOME_DIR } from "./project-home.js";
import { auditMssrProjectContextHealth } from "./project-context-health.js";

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);

function slug(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^#{1,6}\s+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44);
  return normalized || "section";
}

function boundedId(base: string, suffix: string): string {
  const joined = `${base}.${suffix}`.replace(/[^a-z0-9._-]+/g, "-").toLowerCase();
  const clipped = joined.slice(0, 80).replace(/[-._]+$/g, "");
  return idSchema.parse(clipped.length >= 2 ? clipped : `${base}.section`.slice(0, 80));
}

function inferredTopic(entry: ProjectContextCore | ProjectContextModule): ProjectContextTopic {
  if (entry.topic && PROJECT_CONTEXT_TOPICS.includes(entry.topic)) return entry.topic;
  if (entry.kind === "state") return "state";
  if (entry.kind === "memory") return "decision";
  if (entry.kind === "directive") return "operations";
  return "reference";
}

function headingLevel(line: string): number | null {
  const match = /^(#{1,6})\s+\S/.exec(line.trim());
  return match ? match[1].length : null;
}

type MarkdownSection = {
  heading: string;
  level: number;
  chars: number;
  sha256: string;
};

type ModularizationCandidate = {
  action: "extract-indexed-section";
  entryId: string;
  core: boolean;
  sourcePath: string;
  heading: string;
  chars: number;
  sha256: string;
  topic: ProjectContextTopic;
  topicInferred: boolean;
  area: string | null;
  suggestedPath: string;
  suggestedModuleId: string;
  preserveSelectorsFrom: string;
  preserveKind: string;
  requiresCoreDecision: boolean;
  rationale: string;
};

function enumerateSections(markdown: string, level = 2): MarkdownSection[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: MarkdownSection[] = [];
  for (let start = 0; start < lines.length; start += 1) {
    const currentLevel = headingLevel(lines[start]);
    if (currentLevel !== level) continue;
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const nextLevel = headingLevel(lines[index]);
      if (nextLevel !== null && nextLevel <= level) {
        end = index;
        break;
      }
    }
    const text = lines.slice(start, end).join("\n").trim();
    out.push({
      heading: lines[start].trim(),
      level,
      chars: Buffer.byteLength(text, "utf8"),
      sha256: createHash("sha256").update(text, "utf8").digest("hex"),
    });
  }
  return out.sort((a, b) => b.chars - a.chars || a.heading.localeCompare(b.heading));
}

async function readManifest(projectRoot: string): Promise<ProjectContextManifest> {
  const manifestPath = path.join(projectRoot, MSSR_PROJECT_HOME_DIR, MSSR_PROJECT_CONTROL_FILES.projectContextManifest);
  return projectContextManifestSchema.parse(JSON.parse(await fs.readFile(manifestPath, "utf8")));
}

async function selectedSectionBytes(projectRoot: string, sourcePath: string, heading: string): Promise<{ chars: number; sha256: string }> {
  const text = await fs.readFile(path.resolve(projectRoot, sourcePath), "utf8");
  const selected = extractProjectContextSections(text, [heading]);
  return {
    chars: Buffer.byteLength(selected, "utf8"),
    sha256: createHash("sha256").update(selected, "utf8").digest("hex"),
  };
}

export async function planMssrProjectContextModularization(projectRootInput: string) {
  const projectRoot = path.resolve(projectRootInput);
  const health = await auditMssrProjectContextHealth(projectRoot);
  if (health.manifestStatus !== "valid") {
    return {
      projectRoot,
      health,
      status: "blocked" as const,
      reason: "project-context-not-initialized",
      candidates: [] as ModularizationCandidate[],
      authoritySections: [],
      advisoryOnly: true as const,
    };
  }

  const manifest = await readManifest(projectRoot);
  const entries = [
    ...manifest.core.map((entry) => ({ entry, core: true as const })),
    ...manifest.modules.map((entry) => ({ entry, core: false as const })),
  ];
  const pressuredIds = new Set(
    health.findings
      .filter((finding) => finding.code === "oversized-core-module"
        || finding.code === "growing-core-module"
        || finding.code === "oversized-module"
        || finding.code === "growing-module")
      .map((finding) => finding.target),
  );
  const pressuredAuthorities = new Set(
    health.findings
      .filter((finding) => finding.code === "oversized-authority" || finding.code === "growing-authority")
      .map((finding) => finding.target.toLowerCase()),
  );

  const candidates: ModularizationCandidate[] = [];
  const indexedHeadings = new Map<string, Set<string>>();
  for (const { entry, core } of entries) {
    const normalizedPath = entry.source.path.replace(/\\/g, "/");
    const sourceKey = normalizedPath.toLowerCase();
    const headings = entry.source.sections ?? [];
    if (!indexedHeadings.has(sourceKey)) indexedHeadings.set(sourceKey, new Set());
    for (const heading of headings) indexedHeadings.get(sourceKey)!.add(heading);

    const entryPressured = pressuredIds.has(entry.id);
    const authorityPressured = pressuredAuthorities.has(normalizedPath.toLowerCase());
    if (!entryPressured && !authorityPressured) continue;
    if (!headings.length) continue;

    for (const heading of headings) {
      let materialized: { chars: number; sha256: string };
      try {
        materialized = await selectedSectionBytes(projectRoot, normalizedPath, heading);
      } catch {
        continue;
      }
      if (materialized.chars < 1_000 && !entryPressured) continue;
      const topic = inferredTopic(entry);
      const suffix = slug(heading);
      const moduleId = boundedId(entry.id, suffix);
      const fileName = `${moduleId.replace(/[.]+/g, "-")}.md`;
      candidates.push({
        action: "extract-indexed-section",
        entryId: entry.id,
        core,
        sourcePath: normalizedPath,
        heading,
        chars: materialized.chars,
        sha256: materialized.sha256,
        topic,
        topicInferred: !entry.topic,
        area: entry.area ?? null,
        suggestedPath: path.posix.join(".mssr", "knowledge", topic, fileName),
        suggestedModuleId: moduleId,
        preserveSelectorsFrom: entry.id,
        preserveKind: entry.kind,
        requiresCoreDecision: core,
        rationale: core
          ? "Core pressure requires an explicit decision about which minimum invariant remains always loaded."
          : "Move exact indexed section bytes to knowledge/ and preserve the parent module selectors; no semantic rewrite is required.",
      });
    }
  }

  const authoritySections = [];
  for (const finding of health.findings.filter((item) => item.code === "oversized-authority" || item.code === "growing-authority")) {
    const rel = finding.target.replace(/\\/g, "/");
    let text: string;
    try {
      text = await fs.readFile(path.resolve(projectRoot, rel), "utf8");
    } catch {
      continue;
    }
    const indexed = indexedHeadings.get(rel.toLowerCase()) ?? new Set<string>();
    authoritySections.push({
      authority: rel,
      largestSections: enumerateSections(text)
        .slice(0, 12)
        .map((section) => ({
          ...section,
          indexed: indexed.has(section.heading),
          recommendation: indexed.has(section.heading)
            ? "EXTRACT_INDEXED_SECTION"
            : section.chars >= 4_000
              ? "REVIEW_FOR_KNOWLEDGE_CAPTURE"
              : "KEEP_OR_CURATE",
        })),
    });
  }

  return {
    projectRoot,
    health,
    status: health.level === "ok" ? "not-needed" as const : health.level,
    candidates: candidates.sort((a, b) => Number(a.core) - Number(b.core) || b.chars - a.chars || a.entryId.localeCompare(b.entryId)),
    authoritySections,
    policy: {
      automaticWrites: false,
      exactBytesPreferred: true,
      coreRequiresHumanOrAgentReview: true,
      note: "This planner never deletes or rewrites project knowledge. A host may apply reviewed exact-section moves with hash preconditions and manifest readback.",
    },
    advisoryOnly: true as const,
  };
}
