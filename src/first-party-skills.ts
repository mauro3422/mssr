import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * The one portable ownership contract for skills shipped with MSSR itself.
 * It names future bundled directories before their content migration, so
 * adapters can reserve their names without importing an external skill catalog.
 */
export const mssrFirstPartySkillManifestSchema = z.object({
  schemaVersion: z.literal(1),
  skills: z.array(z.object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/),
  }).strict()).min(1).max(32).superRefine((skills, context) => {
    const names = new Set<string>();
    for (const [index, skill] of skills.entries()) {
      if (names.has(skill.name)) context.addIssue({ code: z.ZodIssueCode.custom, path: [index, "name"], message: `Duplicate first-party skill name: ${skill.name}` });
      names.add(skill.name);
    }
  }),
}).strict();

export type MssrFirstPartySkillManifest = z.infer<typeof mssrFirstPartySkillManifestSchema>;

function moduleRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/** The package-shipped manifest is the authoritative reserved-name contract. */
export function mssrFirstPartySkillManifestPath(): string {
  return path.join(moduleRoot(), "config", "first-party-skills.json");
}

export const MSSR_FIRST_PARTY_SKILL_MANIFEST = mssrFirstPartySkillManifestSchema.parse(
  JSON.parse(fs.readFileSync(mssrFirstPartySkillManifestPath(), "utf8")),
);

export const MSSR_FIRST_PARTY_SKILL_NAMES = Object.freeze(
  new Set(MSSR_FIRST_PARTY_SKILL_MANIFEST.skills.map((skill) => skill.name)),
);

export function isMssrFirstPartySkillName(name: string): boolean {
  return MSSR_FIRST_PARTY_SKILL_NAMES.has(name);
}

function packageRoot(): string {
  return path.resolve(process.env.MSSR_PROJECT_ROOT?.trim() || moduleRoot());
}

/** Source root shipped by the MSSR package. It may be absent before migration. */
export function mssrFirstPartySkillsRoot(): string {
  return path.resolve(
    process.env.MSSR_FIRST_PARTY_SKILLS_ROOT?.trim()
    || path.join(packageRoot(), "skills"),
  );
}

/** Default Codex mount location; adapters may choose a different host mount. */
export function mssrFirstPartyCodexSkillsRoot(): string {
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  return path.resolve(path.join(codexHome, "skills"));
}
