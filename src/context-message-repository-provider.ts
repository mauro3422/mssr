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
import type { MssrContextMessage } from "./context-messages.js";

const MAX_FILE_FACTS = 32;
const MAX_FILE_BYTES = 128 * 1024;
const MAX_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 300;
const MAX_DIAGNOSTICS = 64;

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

export type MssrRepositoryProviderDiagnostic = {
  ref: string;
  issue: string;
};

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
    observations.push(parsed.data);
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