import { z } from "zod";
import { projectContextManifestSchema, projectContextModuleSchema, type ProjectContextManifest } from "./project-context.js";

export const PROJECT_KNOWLEDGE_KINDS = ["context", "memory", "state"] as const;
export type ProjectKnowledgeKind = typeof PROJECT_KNOWLEDGE_KINDS[number];

export const projectKnowledgeSectionUpdateSchema = z.object({
  kind: z.enum(PROJECT_KNOWLEDGE_KINDS),
  heading: z.string().regex(/^#{1,6}\s+\S(?:.*\S)?$/).max(160),
  content: z.string().max(80_000),
}).strict();

export type ProjectKnowledgeSectionUpdate = z.infer<typeof projectKnowledgeSectionUpdateSchema>;

function headingLevel(line: string): number | null {
  const match = /^(#{1,6})\s+\S/.exec(line.trim());
  return match ? match[1].length : null;
}

export function upsertMarkdownSection(markdown: string, heading: string, content: string): {
  text: string;
  created: boolean;
  replaced: boolean;
} {
  const normalizedHeading = heading.trim();
  const level = headingLevel(normalizedHeading);
  if (!level) throw new Error(`Invalid markdown section heading: ${heading}`);

  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\s+$/, "");
  const lines = normalized ? normalized.split("\n") : [];
  const matches = lines
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((item) => item.line === normalizedHeading);
  if (matches.length > 1) {
    throw new Error(`Cannot safely update duplicate project section '${normalizedHeading}' (${matches.length} matches).`);
  }

  const body = content.replace(/\r\n/g, "\n").trim();
  const replacement = [normalizedHeading, ...(body ? [body] : [])];

  if (matches.length === 0) {
    const appended = [...lines];
    if (appended.length > 0) appended.push("");
    appended.push(...replacement);
    return { text: `${appended.join("\n").replace(/\s+$/, "")}\n`, created: true, replaced: false };
  }

  const start = matches[0].index;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const nextLevel = headingLevel(lines[index]);
    if (nextLevel !== null && nextLevel <= level) {
      end = index;
      break;
    }
  }

  const updated = [...lines.slice(0, start), ...replacement];
  if (end < lines.length) {
    updated.push("", ...lines.slice(end));
  }
  return { text: `${updated.join("\n").replace(/\s+$/, "")}\n`, created: false, replaced: true };
}

export function upsertProjectContextManifestModule(args: {
  manifest?: unknown;
  module: unknown;
}): { manifest: ProjectContextManifest; created: boolean; replaced: boolean } {
  const manifest = args.manifest === undefined
    ? projectContextManifestSchema.parse({ schemaVersion: 1, core: [], modules: [] })
    : projectContextManifestSchema.parse(args.manifest);
  const module = projectContextModuleSchema.parse(args.module);
  if (manifest.core.some((entry) => entry.id === module.id)) {
    throw new Error(`Project context module id '${module.id}' conflicts with a core entry.`);
  }
  const index = manifest.modules.findIndex((entry) => entry.id === module.id);
  const modules = [...manifest.modules];
  if (index >= 0) modules[index] = module;
  else modules.push(module);
  return {
    manifest: projectContextManifestSchema.parse({ ...manifest, modules }),
    created: index < 0,
    replaced: index >= 0,
  };
}
