import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { projectContextManifestSchema, projectContextModuleSchema, type ProjectContextManifest, type ProjectContextModule } from "./project-context.js";
import { auditMssrProjectContextHealth, type ProjectDocumentReferenceCandidate } from "./project-context-health.js";
import { MAX_PROJECT_CONTEXT_CHARS, loadProjectContextModuleManifest, readBoundedMarkdown, safeMarkdownPath } from "./project-context-loader.js";
import { upsertProjectContextManifestModule } from "./project-context-update.js";

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/i);
const registrationInputSchema = z.object({
  projectRoot: z.string().min(1),
  sourcePath: z.string().min(1).max(240),
  module: projectContextModuleSchema,
}).strict();

const applyRegistrationInputSchema = registrationInputSchema.extend({
  confirmSourcePath: z.string().min(1).max(240),
  expectedSourceSha256: sha256Schema,
  expectedManifestSha256: sha256Schema,
}).strict();

const referenceOnMissInputSchema = z.object({
  projectRoot: z.string().min(1),
  query: z.string().trim().max(600).default(""),
  candidatePath: z.string().min(1).max(240).optional(),
  maxChars: z.number().int().min(200).max(12_000).default(6_000),
}).strict();

function normalizeRelative(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedTokens(value: string): string[] {
  return [...new Set(value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3))];
}

function scoreCandidate(candidate: ProjectDocumentReferenceCandidate, query: string): { score: number; matched: string[] } {
  const queryTokens = normalizedTokens(query);
  if (queryTokens.length === 0) return { score: 0, matched: [] };
  const haystack = normalizedTokens(`${candidate.path} ${candidate.reasons.join(" ")}`);
  const available = new Set(haystack);
  const matched = queryTokens.filter((token) => available.has(token));
  if (matched.length === 0) return { score: 0, matched: [] };
  const priorityBonus = candidate.reviewPriority === "high" ? 3 : candidate.reviewPriority === "medium" ? 1 : 0;
  return { score: matched.length * 10 + priorityBonus, matched };
}

async function readRawManifest(projectRoot: string): Promise<{ path: string; text: string; sha256: string; manifest: ProjectContextManifest }> {
  const loaded = await loadProjectContextModuleManifest(projectRoot);
  if (!loaded.found) throw new Error("Project-context manifest is missing; initialize MSSR before registering project documentation.");
  const text = await fs.readFile(loaded.path, "utf8");
  return { path: loaded.path, text, sha256: sha256(text), manifest: projectContextManifestSchema.parse(JSON.parse(text)) };
}

async function readRegistrationSource(projectRoot: string, sourcePath: string) {
  const absolute = safeMarkdownPath(projectRoot, sourcePath);
  const raw = await readBoundedMarkdown(absolute, MAX_PROJECT_CONTEXT_CHARS);
  return { absolute, ...raw };
}

export type MssrProjectDocumentReferenceRegistrationPlan = {
  sourcePath: string;
  sourceSha256: string;
  sourceBytes: number;
  manifestPath: string;
  expectedManifestSha256: string;
  module: ProjectContextModule;
  proposedManifest: ProjectContextManifest;
  proposedManifestText: string;
  created: boolean;
  replaced: boolean;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
  policy: string;
};

export async function planMssrProjectDocumentReferenceRegistration(input: z.input<typeof registrationInputSchema>): Promise<MssrProjectDocumentReferenceRegistrationPlan> {
  const parsed = registrationInputSchema.parse(input);
  const sourcePath = parsed.sourcePath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalizeRelative(parsed.module.source.path) !== normalizeRelative(sourcePath)) {
    throw new Error(`Registration module source '${parsed.module.source.path}' must exactly identify requested source '${sourcePath}'.`);
  }

  const source = await readRegistrationSource(parsed.projectRoot, sourcePath);
  const current = await readRawManifest(parsed.projectRoot);
  const existingOwner = [...current.manifest.core, ...current.manifest.modules]
    .find((entry) => normalizeRelative(entry.source.path) === normalizeRelative(sourcePath) && entry.id !== parsed.module.id);
  if (existingOwner) {
    throw new Error(`Project document '${sourcePath}' is already registered by '${existingOwner.id}'.`);
  }

  const proposed = upsertProjectContextManifestModule({ manifest: current.manifest, module: parsed.module });
  const proposedManifestText = `${JSON.stringify(proposed.manifest, null, 2)}\n`;
  return {
    sourcePath,
    sourceSha256: source.sha256,
    sourceBytes: source.bytes,
    manifestPath: current.path,
    expectedManifestSha256: current.sha256,
    module: parsed.module,
    proposedManifest: proposed.manifest,
    proposedManifestText,
    created: proposed.created,
    replaced: proposed.replaced,
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
    policy: "Forward registration is explicit reviewed persistence. Discovery, filenames, reference-on-miss, telemetry, or model output never authorize this manifest write.",
  };
}

async function atomicWriteText(filePath: string, value: string): Promise<void> {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(temporary, "wx");
    await handle.writeFile(value, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, filePath);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}

export async function applyMssrProjectDocumentReferenceRegistration(input: z.input<typeof applyRegistrationInputSchema>) {
  const parsed = applyRegistrationInputSchema.parse(input);
  const requested = normalizeRelative(parsed.sourcePath);
  if (requested !== normalizeRelative(parsed.confirmSourcePath)) {
    throw new Error("Project-document registration requires exact sourcePath confirmation.");
  }

  const plan = await planMssrProjectDocumentReferenceRegistration({
    projectRoot: parsed.projectRoot,
    sourcePath: parsed.sourcePath,
    module: parsed.module,
  });
  if (plan.sourceSha256 !== parsed.expectedSourceSha256.toLowerCase()) {
    throw new Error(`Project document changed before registration; expected ${parsed.expectedSourceSha256.toLowerCase()}, observed ${plan.sourceSha256}.`);
  }
  if (plan.expectedManifestSha256 !== parsed.expectedManifestSha256.toLowerCase()) {
    throw new Error(`Project-context manifest changed before registration; expected ${parsed.expectedManifestSha256.toLowerCase()}, observed ${plan.expectedManifestSha256}.`);
  }

  await atomicWriteText(plan.manifestPath, plan.proposedManifestText);
  const persistedText = await fs.readFile(plan.manifestPath, "utf8");
  const persisted = projectContextManifestSchema.parse(JSON.parse(persistedText));
  const persistedModule = persisted.modules.find((entry) => entry.id === plan.module.id);
  if (!persistedModule || normalizeRelative(persistedModule.source.path) !== requested) {
    throw new Error("Project-document registration readback did not preserve the requested module/source identity.");
  }

  const health = await auditMssrProjectContextHealth(parsed.projectRoot);
  const remainsCandidate = health.referenceAudit?.candidates.some((candidate) => normalizeRelative(candidate.path) === requested) ?? false;
  if (remainsCandidate) throw new Error("Project-document registration persisted but the source remains an unconnected reference candidate.");

  return {
    registered: true,
    sourcePath: plan.sourcePath,
    moduleId: plan.module.id,
    manifestPath: plan.manifestPath,
    manifestSha256: sha256(persistedText),
    sourceSha256: plan.sourceSha256,
    created: plan.created,
    replaced: plan.replaced,
    healthLevel: health.level,
    advisoryOnly: false,
    canonicalRewriteAllowed: true,
    authorityBasis: "explicit-reviewed-registration" as const,
  };
}

export async function readMssrProjectDocumentReferenceOnMiss(input: z.input<typeof referenceOnMissInputSchema>) {
  const parsed = referenceOnMissInputSchema.parse(input);
  const health = await auditMssrProjectContextHealth(parsed.projectRoot);
  const candidates = health.referenceAudit?.candidates ?? [];
  if (candidates.length === 0) {
    return {
      status: "no-match" as const,
      candidates: [],
      authority: "candidate-only" as const,
      advisoryOnly: true,
      truthAuthority: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      registrationRequired: true,
    };
  }

  let selected: ProjectDocumentReferenceCandidate | null = null;
  let ranked = candidates.map((candidate) => ({ candidate, ...scoreCandidate(candidate, parsed.query) }));
  if (parsed.candidatePath) {
    const exact = normalizeRelative(parsed.candidatePath);
    selected = candidates.find((candidate) => normalizeRelative(candidate.path) === exact) ?? null;
    if (!selected) {
      return {
        status: "no-match" as const,
        candidates: candidates.slice(0, 8),
        authority: "candidate-only" as const,
        advisoryOnly: true,
        truthAuthority: false,
        routingInfluence: false,
        canonicalRewriteAllowed: false,
        registrationRequired: true,
      };
    }
  } else {
    ranked = ranked.sort((left, right) => right.score - left.score || left.candidate.path.localeCompare(right.candidate.path));
    const topScore = ranked[0]?.score ?? 0;
    if (topScore <= 0) {
      return {
        status: "no-match" as const,
        candidates: ranked.slice(0, 8).map(({ candidate, score, matched }) => ({ ...candidate, score, matched })),
        authority: "candidate-only" as const,
        advisoryOnly: true,
        truthAuthority: false,
        routingInfluence: false,
        canonicalRewriteAllowed: false,
        registrationRequired: true,
      };
    }
    const tied = ranked.filter((item) => item.score === topScore);
    if (tied.length !== 1) {
      return {
        status: "ambiguous" as const,
        candidates: tied.slice(0, 8).map(({ candidate, score, matched }) => ({ ...candidate, score, matched })),
        authority: "candidate-only" as const,
        advisoryOnly: true,
        truthAuthority: false,
        routingInfluence: false,
        canonicalRewriteAllowed: false,
        registrationRequired: true,
      };
    }
    selected = tied[0].candidate;
  }

  const source = await readRegistrationSource(parsed.projectRoot, selected.path);
  const content = source.content.length > parsed.maxChars ? source.content.slice(0, parsed.maxChars) : source.content;
  const selectedRank = ranked.find((item) => normalizeRelative(item.candidate.path) === normalizeRelative(selected!.path));
  return {
    status: "selected" as const,
    candidate: {
      ...selected,
      score: selectedRank?.score ?? null,
      matched: selectedRank?.matched ?? [],
    },
    content,
    contentTruncated: content.length < source.content.length,
    sourceSha256: source.sha256,
    sourceBytes: source.bytes,
    authority: "candidate-only" as const,
    advisoryOnly: true,
    truthAuthority: false,
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    registrationRequired: true,
    policy: "Reference-on-miss may recover bounded evidence from a disconnected candidate, but that evidence does not become project truth or selectable durable context until explicit reviewed registration.",
  };
}
