import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  mssrProducerObservationSchema,
  produceContextMessages,
  type MssrProducerObservation,
  type ProducerSourceKind,
} from "./context-message-producers.js";
import {
  MSSR_CONTEXT_ADVISORY_ACTIONS,
  type MssrContextMessage,
} from "./context-messages.js";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_SIGNALS,
  SKILL_STAGES,
  type SkillStage,
  type StructuredSkillIntent,
} from "./skill-routing.js";

const MAX_FILE_FACTS = 32;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_DIAGNOSTICS = 64;
const MAX_MANIFEST_ENTRIES = 32;
const CONTEXT_MESSAGES_MANIFEST_REL_PATH = ".bridge/context-messages.json";
const CONTEXT_MESSAGES_MANIFEST_FALLBACK_REL_PATH = "config/context-messages.json";

const CANONICAL_PROJECT_CONTEXT_FACTS: ReadonlyArray<{ relPath: string; sourceKind: ProducerSourceKind }> = [
  { relPath: ".bridge/PROJECT_CONTEXT.md", sourceKind: "project-context" },
  { relPath: ".bridge/PROJECT_MEMORY.md", sourceKind: "project-memory" },
  { relPath: ".bridge/PROJECT_STATE.md", sourceKind: "project-state" },
  { relPath: "docs/PROJECT_CONTEXT.md", sourceKind: "project-context" },
];

type CanonicalFact = {
  relPath: string;
  sourceKind: ProducerSourceKind;
};

type SkillDomain = StructuredSkillIntent["domains"][number];
type SkillAction = StructuredSkillIntent["actions"][number];
type SkillArtifact = StructuredSkillIntent["artifacts"][number];
type SkillNeed = StructuredSkillIntent["needs"][number];
type SkillSignal = StructuredSkillIntent["signals"][number];

type RepositoryFactSelectors = {
  stages: readonly SkillStage[];
  domains: readonly SkillDomain[];
  actions: readonly SkillAction[];
  artifacts: readonly SkillArtifact[];
  needs: readonly SkillNeed[];
  signals: readonly SkillSignal[];
};

/**
 * Conservative selector defaults that activate a produced repository
 * observation for the intent dimensions its evidence is relevant to.  Every
 * produced observation keeps at least one selector so it stays derivable by
 * `selectMssrContextMessages`; an explicit manifest entry replaces a dimension
 * but never eliminates every selector.
 */
const SOURCE_KIND_DEFAULT_SELECTORS: Record<ProducerSourceKind, RepositoryFactSelectors> = {
  "architecture-decision": {
    stages: [],
    domains: [],
    actions: ["design", "review", "verify"],
    artifacts: ["code", "project", "repository", "mcp", "skill"],
    needs: [],
    signals: [],
  },
  incident: {
    stages: [],
    domains: [],
    actions: [],
    artifacts: [],
    needs: [],
    signals: ["error-observed", "warning-observed", "repeated-friction", "recovery-needed"],
  },
  changelog: {
    stages: ["persist", "close"],
    domains: [],
    actions: ["version", "publish"],
    artifacts: [],
    needs: [],
    signals: [],
  },
  "git-receipt": {
    stages: ["persist", "close"],
    domains: [],
    actions: ["version", "publish"],
    artifacts: [],
    needs: [],
    signals: [],
  },
  "provider-receipt": {
    stages: [],
    domains: [],
    actions: [],
    artifacts: [],
    needs: [],
    signals: ["provider-refresh-needed", "degraded-capability", "recovery-needed"],
  },
  "project-context": {
    stages: ["start", "resume"],
    domains: [],
    actions: [],
    artifacts: [],
    needs: ["history-recovery", "cross-agent"],
    signals: [],
  },
  "project-memory": {
    stages: ["start", "resume"],
    domains: [],
    actions: [],
    artifacts: [],
    needs: ["history-recovery", "cross-agent"],
    signals: [],
  },
  "project-state": {
    stages: ["start", "resume"],
    domains: [],
    actions: [],
    artifacts: [],
    needs: ["history-recovery", "cross-agent"],
    signals: [],
  },
};

export const mssrContextMessagesManifestEntrySchema = z.object({
  stages: z.array(z.enum(SKILL_STAGES)).max(6).optional(),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).optional(),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).optional(),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).optional(),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).optional(),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).optional(),
  priority: z.number().int().min(-100).max(100).optional(),
  required: z.boolean().optional(),
  advisoryActions: z.array(z.enum(MSSR_CONTEXT_ADVISORY_ACTIONS)).max(4).optional(),
}).strict().superRefine((value, ctx) => {
  const hasSelector = (["stages", "domains", "actions", "artifacts", "needs", "signals"] as const)
    .some((key) => (value[key]?.length ?? 0) > 0);
  if (!hasSelector) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manifest entry requires at least one selector." });
  }
});

export type MssrContextMessagesManifestEntry = z.infer<typeof mssrContextMessagesManifestEntrySchema>;

export const mssrContextMessagesManifestSchema = z.object({
  schemaVersion: z.literal(1),
  entries: z.record(z.string().min(1).max(240), mssrContextMessagesManifestEntrySchema)
    .refine(
      (value) => Object.keys(value).length <= MAX_MANIFEST_ENTRIES,
      { message: "Manifest supports at most 32 entries." },
    ),
}).strict();

export type MssrContextMessagesManifest = z.infer<typeof mssrContextMessagesManifestSchema>;

export type MssrRepositoryProviderDiagnostic = {
  ref: string;
  issue: string;
};

function isSafeRelativeRef(ref: string): boolean {
  if (!ref || ref.length > 240) return false;
  if (ref.includes("\0") || ref.includes("\\")) return false;
  if (path.posix.isAbsolute(ref)) return false;
  if (/^[A-Za-z]:/.test(ref)) return false;
  const segments = ref.split("/");
  return segments.length > 0 && segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

/**
 * Detects duplicate member names inside the same JSON object.  Duplicate keys
 * across sibling objects are legitimate and must not be flagged, so each open
 * object tracks its own member names.  Tolerates malformed input: it only
 * reports keys actually observed and never throws.
 */
function findDuplicateJsonObjectKeys(text: string): string[] {
  const duplicates: string[] = [];
  const openObjects: Array<Set<string>> = [];
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (ch === '"') {
      index += 1;
      let key = "";
      while (index < text.length && text[index] !== '"') {
        const current = text[index];
        if (current === "\\") {
          key += current;
          const escaped = text[index + 1] ?? "";
          key += escaped;
          if (escaped === "u") {
            key += text.slice(index + 2, index + 6);
            index += 6;
          } else {
            index += 2;
          }
        } else {
          key += current;
          index += 1;
        }
      }
      if (index < text.length) index += 1;
      while (index < text.length && /\s/.test(text[index])) index += 1;
      if (text[index] !== ":" || openObjects.length === 0) continue;
      index += 1;
      const current = openObjects[openObjects.length - 1];
      if (current.has(key)) duplicates.push(key);
      current.add(key);
    } else if (ch === "{") {
      openObjects.push(new Set<string>());
      index += 1;
    } else if (ch === "}") {
      openObjects.pop();
      index += 1;
    } else if (ch === "[" || ch === "]") {
      index += 1;
    } else {
      index += 1;
    }
  }
  return duplicates;
}

async function firstExistingManifestPath(projectRoot: string): Promise<string | null> {
  for (const rel of [CONTEXT_MESSAGES_MANIFEST_REL_PATH, CONTEXT_MESSAGES_MANIFEST_FALLBACK_REL_PATH]) {
    try {
      await fs.access(path.join(projectRoot, ...rel.split("/")));
      return rel;
    } catch {
      // Absent manifests are optional; fall back to defaults.
    }
  }
  return null;
}

/**
 * Loads the strict optional repository selector manifest.  Any duplicate ref,
 * unsafe path, unknown ref, or malformed document yields bounded diagnostics
 * and fails closed: no override is applied and default selectors survive.
 */
async function loadContextMessagesManifest(
  projectRoot: string,
  knownRefs: ReadonlySet<string>,
): Promise<{ overrides: Map<string, MssrContextMessagesManifestEntry>; diagnostics: MssrRepositoryProviderDiagnostic[] }> {
  const overrides = new Map<string, MssrContextMessagesManifestEntry>();
  const diagnostics: MssrRepositoryProviderDiagnostic[] = [];

  const manifestRel = await firstExistingManifestPath(projectRoot);
  if (!manifestRel) return { overrides, diagnostics };

  let text: string;
  try {
    text = await fs.readFile(path.join(projectRoot, ...manifestRel.split("/")), "utf8");
  } catch (error) {
    if (!isMissingError(error)) pushDiagnostic(diagnostics, manifestRel, "context-messages-manifest-unreadable");
    return { overrides, diagnostics };
  }

  const duplicateRefs = findDuplicateJsonObjectKeys(text);
  for (const ref of duplicateRefs) {
    pushDiagnostic(diagnostics, manifestRel, `context-messages-manifest-duplicate-ref ${ref}`);
  }
  if (duplicateRefs.length > 0) return { overrides, diagnostics };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    pushDiagnostic(diagnostics, manifestRel, "context-messages-manifest-invalid-json");
    return { overrides, diagnostics };
  }

  const validated = mssrContextMessagesManifestSchema.safeParse(parsed);
  if (!validated.success) {
    pushDiagnostic(diagnostics, manifestRel, "context-messages-manifest-invalid");
    return { overrides, diagnostics };
  }

  const refs = Object.keys(validated.data.entries);
  let safe = true;
  for (const ref of refs) {
    if (!isSafeRelativeRef(ref)) {
      pushDiagnostic(diagnostics, ref, "context-messages-manifest-unsafe-ref");
      safe = false;
    } else if (!knownRefs.has(ref)) {
      pushDiagnostic(diagnostics, ref, "context-messages-manifest-unknown-ref");
      safe = false;
    }
  }
  if (!safe) return { overrides, diagnostics };

  for (const [ref, entry] of Object.entries(validated.data.entries)) overrides.set(ref, entry);
  return { overrides, diagnostics };
}

function selectorsFor(
  sourceKind: ProducerSourceKind,
  override: MssrContextMessagesManifestEntry | undefined,
): RepositoryFactSelectors {
  const defaults = SOURCE_KIND_DEFAULT_SELECTORS[sourceKind];
  if (!override) return defaults;
  return {
    stages: override.stages ?? defaults.stages,
    domains: override.domains ?? defaults.domains,
    actions: override.actions ?? defaults.actions,
    artifacts: override.artifacts ?? defaults.artifacts,
    needs: override.needs ?? defaults.needs,
    signals: override.signals ?? defaults.signals,
  };
}

export const mssrRepositoryProviderOptionsSchema = z.object({
  projectRoot: z.string().min(1),
  gitReceipts: z.array(mssrProducerObservationSchema).optional(),
  providerReceipts: z.array(mssrProducerObservationSchema).optional(),
  maxObservations: z.number().int().min(0).max(MAX_FILE_FACTS).default(MAX_FILE_FACTS),
}).strict();

export type MssrRepositoryProviderOptions = z.infer<typeof mssrRepositoryProviderOptionsSchema>;

export type MssrRepositoryProviderResult = {
  observations: MssrProducerObservation[];
  messages: MssrContextMessage[];
  diagnostics: MssrRepositoryProviderDiagnostic[];
  overflow: string[];
};

function clampText(value: string, max: number): string {
  const bounded = value.length > max ? value.slice(0, max) : value;
  return bounded.trim();
}

function toPosixPath(value: string): string {
  return path.normalize(value).replace(/\\/g, "/");
}

function stableObservationId(kind: ProducerSourceKind, relPath: string): string {
  const slug = relPath
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");
  return `${kind}:${slug || "entry"}`.slice(0, 120);
}

function firstHeading(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const match = /^#{1,6}\s+(.+)$/.exec(line.trim());
    if (match) return match[1].trim();
  }
  return null;
}

function firstProseLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,6}\s+/.test(trimmed)) continue;
    return trimmed;
  }
  return null;
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name);
}

async function walkNamedMarkdownFiles(directory: string, target: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name === target) {
      found.push(entry.name);
    } else if (entry.isDirectory()) {
      const nested = await walkNamedMarkdownFiles(path.join(directory, entry.name), target);
      for (const rel of nested) found.push(`${entry.name}/${rel}`);
    }
  }
  return found;
}

async function newestVersionChangelog(directory: string): Promise<string | null> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  const versions = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .map((name) => /^(\d+)\.(\d+)\.(\d+)\.md$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      name: match[0],
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    }))
    .sort((left, right) =>
      right.major - left.major
      || right.minor - left.minor
      || right.patch - left.patch
      || right.name.localeCompare(left.name));
  return versions[0]?.name ?? null;
}

async function enumerateCanonicalFacts(root: string): Promise<CanonicalFact[]> {
  const facts: CanonicalFact[] = [];

  const decisions = await listMarkdownFiles(path.join(root, "docs", "decisions"));
  for (const name of decisions) {
    if (name.toLowerCase() === "readme.md") continue;
    facts.push({ relPath: `docs/decisions/${name}`, sourceKind: "architecture-decision" });
  }

  const incidents = await walkNamedMarkdownFiles(path.join(root, "docs"), "INCIDENTS.md");
  for (const rel of incidents) {
    facts.push({ relPath: `docs/${rel}`, sourceKind: "incident" });
  }

  facts.push({ relPath: "CHANGELOG.md", sourceKind: "changelog" });

  const newest = await newestVersionChangelog(path.join(root, "changelogs"));
  if (newest) facts.push({ relPath: `changelogs/${newest}`, sourceKind: "changelog" });

  facts.push(...CANONICAL_PROJECT_CONTEXT_FACTS);

  const seen = new Set<string>();
  const unique = facts.filter((fact) => {
    if (seen.has(fact.relPath)) return false;
    seen.add(fact.relPath);
    return true;
  });

  unique.sort((left, right) => (left.relPath < right.relPath ? -1 : left.relPath > right.relPath ? 1 : 0));
  return unique;
}

function isMissingError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}

type BoundedFile = {
  ok: true;
  buffer: Buffer;
  truncated: boolean;
  mtimeMs: number;
};

type BoundedFileError = {
  ok: false;
  missing: boolean;
};

async function readFileBounded(absPath: string, maxBytes: number): Promise<BoundedFile | BoundedFileError> {
  let handle: fs.FileHandle;
  try {
    handle = await fs.open(absPath, "r");
  } catch (error) {
    return { ok: false, missing: isMissingError(error) };
  }
  try {
    const stat = await handle.stat();
    const size = Math.min(maxBytes, Math.max(0, stat.size));
    const buffer = Buffer.allocUnsafe(size);
    let offset = 0;
    while (offset < size) {
      const { bytesRead } = await handle.read(buffer, offset, size - offset, offset);
      if (bytesRead <= 0) break;
      offset += bytesRead;
    }
    return { ok: true, buffer, truncated: stat.size > maxBytes, mtimeMs: stat.mtimeMs };
  } catch {
    return { ok: false, missing: false };
  } finally {
    await handle.close().catch(() => {});
  }
}

function receiptRef(receipt: MssrProducerObservation): string {
  const ref = typeof receipt?.ref === "string" ? receipt.ref : "unknown";
  return clampText(ref, 240);
}

function pushDiagnostic(
  diagnostics: MssrRepositoryProviderDiagnostic[],
  ref: string,
  issue: string,
): void {
  if (diagnostics.length >= MAX_DIAGNOSTICS) return;
  diagnostics.push({ ref: clampText(ref, 240), issue });
}

function mergeReceipts(
  observations: MssrProducerObservation[],
  diagnostics: MssrRepositoryProviderDiagnostic[],
  overflow: string[],
  maxObservations: number,
  receipts: readonly MssrProducerObservation[] | undefined,
  expectedKind: ProducerSourceKind,
): void {
  for (const receipt of receipts ?? []) {
    if (observations.length >= maxObservations) {
      overflow.push(receiptRef(receipt));
      continue;
    }
    const parsed = mssrProducerObservationSchema.safeParse(receipt);
    if (!parsed.success) {
      pushDiagnostic(diagnostics, receiptRef(receipt), "invalid-receipt");
      continue;
    }
    if (parsed.data.sourceKind !== expectedKind) {
      pushDiagnostic(diagnostics, parsed.data.ref, "source-kind-mismatch");
      continue;
    }
    const defaults = SOURCE_KIND_DEFAULT_SELECTORS[parsed.data.sourceKind];
    observations.push({
      ...parsed.data,
      stages: parsed.data.stages.length > 0 ? parsed.data.stages : [...defaults.stages],
      domains: parsed.data.domains.length > 0 ? parsed.data.domains : [...defaults.domains],
      actions: parsed.data.actions.length > 0 ? parsed.data.actions : [...defaults.actions],
      artifacts: parsed.data.artifacts.length > 0 ? parsed.data.artifacts : [...defaults.artifacts],
      needs: parsed.data.needs.length > 0 ? parsed.data.needs : [...defaults.needs],
      signals: parsed.data.signals.length > 0 ? parsed.data.signals : [...defaults.signals],
    });
  }
}

export async function collectRepositoryContextMessages(
  options: MssrRepositoryProviderOptions,
): Promise<MssrRepositoryProviderResult> {
  const parsed = mssrRepositoryProviderOptionsSchema.parse(options);
  const maxObservations = parsed.maxObservations;
  const projectRoot = path.resolve(parsed.projectRoot);
  const canonicalOwner = clampText(toPosixPath(projectRoot), 120);
  const observations: MssrProducerObservation[] = [];
  const diagnostics: MssrRepositoryProviderDiagnostic[] = [];
  const overflow: string[] = [];

  const facts = await enumerateCanonicalFacts(projectRoot);
  const knownRefs = new Set(facts.map((fact) => fact.relPath));
  const manifest = await loadContextMessagesManifest(projectRoot, knownRefs);
  for (const item of manifest.diagnostics) pushDiagnostic(diagnostics, item.ref, item.issue);

  for (const fact of facts) {
    if (observations.length >= maxObservations) {
      overflow.push(clampText(fact.relPath, 240));
      continue;
    }
    const absPath = path.join(projectRoot, ...fact.relPath.split("/"));
    const file = await readFileBounded(absPath, MAX_FILE_BYTES);
    if (!file.ok) {
      if (!file.missing) pushDiagnostic(diagnostics, fact.relPath, "unreadable");
      continue;
    }
    if (file.truncated) pushDiagnostic(diagnostics, fact.relPath, "truncated-at-128kib");

    const text = file.buffer.toString("utf8");
    const fallbackTitle = clampText(path.basename(fact.relPath, path.extname(fact.relPath)), MAX_TITLE_CHARS);
    const title = clampText(firstHeading(text) ?? (fallbackTitle || fact.relPath), MAX_TITLE_CHARS);
    const summary = clampText(firstProseLine(text) ?? title, MAX_SUMMARY_CHARS);

    const override = manifest.overrides.get(fact.relPath);
    const selectors = selectorsFor(fact.sourceKind, override);

    observations.push(
      mssrProducerObservationSchema.parse({
        id: stableObservationId(fact.sourceKind, fact.relPath),
        sourceKind: fact.sourceKind,
        ref: clampText(fact.relPath, 240),
        title,
        summary,
        canonicalOwner,
        provenance: "project",
        availability: true,
        authoritative: true,
        observedAt: new Date(file.mtimeMs).toISOString(),
        revision: createHash("sha256").update(file.buffer).digest("hex"),
        ...(override ? { priority: override.priority, required: override.required, advisoryActions: override.advisoryActions } : {}),
        stages: [...selectors.stages],
        domains: [...selectors.domains],
        actions: [...selectors.actions],
        artifacts: [...selectors.artifacts],
        needs: [...selectors.needs],
        signals: [...selectors.signals],
      }),
    );
  }

  mergeReceipts(observations, diagnostics, overflow, maxObservations, parsed.gitReceipts, "git-receipt");
  mergeReceipts(observations, diagnostics, overflow, maxObservations, parsed.providerReceipts, "provider-receipt");

  return {
    observations,
    messages: produceContextMessages(observations),
    diagnostics,
    overflow,
  };
}