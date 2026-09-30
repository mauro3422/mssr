import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { defaultMssrStateRoot } from "./state-root.js";
import { buildMssrSemanticCurationJobsFromMarkdown } from "./semantic-curation-source.js";
import { assembleMssrSemanticReferenceProposals } from "./semantic-curation.js";
import {
  executeMssrJevSemanticCurationJobs,
  type MssrJevSemanticCurationRun,
  type MssrJevSemanticCuratorOptions,
} from "./semantic-curation-jev.js";
import { MSSR_SEMANTIC_CURATION_QUEUE_REASONS } from "./semantic-curation-queue.js";

const QUEUE_SCHEMA_VERSION = 1 as const;
const MAX_QUEUE_ENTRIES = 2_000;
const LOCK_STALE_MS = 30_000;
const LOCK_RETRIES = 80;
const LOCK_RETRY_MS = 25;

const queueEntrySchema = z.object({
  id: z.string().regex(/^curate:[a-f0-9]{24}$/),
  projectRoot: z.string().min(1).max(520),
  sourceRef: z.string().min(1).max(320).refine((value) => !/[\r\n]/.test(value)),
  reasons: z.array(z.enum(MSSR_SEMANTIC_CURATION_QUEUE_REASONS)).min(1).max(8),
  priority: z.number().int().min(-100).max(100).default(0),
  queuedAt: z.string().datetime({ offset: true }),
  attempts: z.number().int().min(0).max(1000).default(0),
  lastAttemptAt: z.string().datetime({ offset: true }).optional(),
  lastError: z.string().max(600).optional(),
}).strict();

const queueStateSchema = z.object({
  schemaVersion: z.literal(QUEUE_SCHEMA_VERSION),
  entries: z.array(queueEntrySchema).max(MAX_QUEUE_ENTRIES),
}).strict();

export type MssrSemanticCurationPersistentQueueEntry = z.infer<typeof queueEntrySchema>;
export type MssrSemanticCurationPersistentQueueState = z.infer<typeof queueStateSchema>;

function queueId(projectRoot: string, sourceRef: string): string {
  return `curate:${createHash("sha256").update(`${path.resolve(projectRoot)}\0${sourceRef}`).digest("hex").slice(0, 24)}`;
}

export function defaultMssrSemanticCurationQueuePath(stateRoot = defaultMssrStateRoot()): string {
  return path.join(stateRoot, "semantic-curation-queue.json");
}

export function defaultMssrSemanticCurationReviewRoot(stateRoot = defaultMssrStateRoot()): string {
  return path.join(stateRoot, "semantic-curation-reviews");
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withQueueLock<T>(queuePath: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${queuePath}.lock`;
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  let acquired = false;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt += 1) {
    try {
      await fs.mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      const record = error as NodeJS.ErrnoException;
      if (record.code !== "EEXIST") throw error;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockPath, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      await delay(LOCK_RETRY_MS);
    }
  }
  if (!acquired) throw new Error(`Timed out acquiring MSSR semantic curation queue lock: ${lockPath}`);
  try {
    return await fn();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

async function readQueueUnlocked(queuePath: string): Promise<MssrSemanticCurationPersistentQueueState> {
  try {
    const raw = await fs.readFile(queuePath, "utf8");
    return queueStateSchema.parse(JSON.parse(raw));
  } catch (error) {
    const record = error as NodeJS.ErrnoException;
    if (record.code === "ENOENT") return { schemaVersion: QUEUE_SCHEMA_VERSION, entries: [] };
    throw error;
  }
}

async function writeQueueUnlocked(queuePath: string, state: MssrSemanticCurationPersistentQueueState): Promise<void> {
  const parsed = queueStateSchema.parse(state);
  await fs.mkdir(path.dirname(queuePath), { recursive: true });
  const temporary = `${queuePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await fs.rename(temporary, queuePath);
}

export async function readMssrSemanticCurationQueue(queuePath = defaultMssrSemanticCurationQueuePath()): Promise<MssrSemanticCurationPersistentQueueState> {
  return withQueueLock(queuePath, () => readQueueUnlocked(queuePath));
}

export async function enqueueMssrSemanticCurationSource(args: {
  projectRoot: string;
  sourceRef: string;
  reasons: readonly (typeof MSSR_SEMANTIC_CURATION_QUEUE_REASONS)[number][];
  priority?: number;
  queuePath?: string;
}): Promise<{ entry: MssrSemanticCurationPersistentQueueEntry; inserted: boolean; merged: boolean }> {
  const queuePath = args.queuePath ?? defaultMssrSemanticCurationQueuePath();
  const id = queueId(args.projectRoot, args.sourceRef);
  return withQueueLock(queuePath, async () => {
    const state = await readQueueUnlocked(queuePath);
    const existingIndex = state.entries.findIndex((entry) => entry.id === id);
    if (existingIndex >= 0) {
      const existing = state.entries[existingIndex];
      const merged = queueEntrySchema.parse({
        ...existing,
        reasons: [...new Set([...existing.reasons, ...args.reasons])],
        priority: Math.max(existing.priority, args.priority ?? 0),
      });
      state.entries[existingIndex] = merged;
      await writeQueueUnlocked(queuePath, state);
      return { entry: merged, inserted: false, merged: true };
    }
    if (state.entries.length >= MAX_QUEUE_ENTRIES) throw new Error(`MSSR semantic curation queue reached ${MAX_QUEUE_ENTRIES} entries.`);
    const entry = queueEntrySchema.parse({
      id,
      projectRoot: path.resolve(args.projectRoot),
      sourceRef: args.sourceRef,
      reasons: [...new Set(args.reasons)],
      priority: args.priority ?? 0,
      queuedAt: new Date().toISOString(),
      attempts: 0,
    });
    state.entries.push(entry);
    state.entries.sort((left, right) => right.priority - left.priority || left.queuedAt.localeCompare(right.queuedAt) || left.id.localeCompare(right.id));
    await writeQueueUnlocked(queuePath, state);
    return { entry, inserted: true, merged: false };
  });
}

async function updateQueueEntries(queuePath: string, updater: (state: MssrSemanticCurationPersistentQueueState) => void): Promise<void> {
  await withQueueLock(queuePath, async () => {
    const state = await readQueueUnlocked(queuePath);
    updater(state);
    await writeQueueUnlocked(queuePath, state);
  });
}

function reviewFileName(entry: MssrSemanticCurationPersistentQueueEntry): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${entry.id.replace(":", "-")}-${stamp}.json`;
}

export async function processMssrSemanticCurationQueue(args: {
  queuePath?: string;
  reviewRoot?: string;
  maxEntries?: number;
  jev?: MssrJevSemanticCuratorOptions;
  concurrency?: number;
  maxHeadsPerRequest?: number;
  maxStateChars?: number;
} = {}): Promise<{
  selectedEntries: string[];
  processedEntries: string[];
  failedEntries: Array<{ entryId: string; error: string }>;
  reviewFiles: string[];
  run: MssrJevSemanticCurationRun | null;
}> {
  const queuePath = args.queuePath ?? defaultMssrSemanticCurationQueuePath();
  const reviewRoot = args.reviewRoot ?? defaultMssrSemanticCurationReviewRoot();
  const maxEntries = Math.max(1, Math.min(100, Math.floor(args.maxEntries ?? 12)));
  const snapshot = await readMssrSemanticCurationQueue(queuePath);
  const selected = snapshot.entries.slice(0, maxEntries);
  const failedEntries: Array<{ entryId: string; error: string }> = [];
  const resolved: Array<{ entry: MssrSemanticCurationPersistentQueueEntry; jobs: Awaited<ReturnType<typeof buildMssrSemanticCurationJobsFromMarkdown>> }> = [];

  for (const entry of selected) {
    try {
      const jobs = await buildMssrSemanticCurationJobsFromMarkdown({ projectRoot: entry.projectRoot, sourceRef: entry.sourceRef, reasons: entry.reasons });
      if (jobs.length === 0) throw new Error("No semantic blocks were produced from the source.");
      resolved.push({ entry, jobs });
    } catch (error) {
      failedEntries.push({ entryId: entry.id, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const jobs = resolved.flatMap((item) => item.jobs);
  let run: MssrJevSemanticCurationRun | null = null;
  if (jobs.length > 0) {
    run = await executeMssrJevSemanticCurationJobs({
      jobs,
      options: args.jev,
      concurrency: args.concurrency,
      maxHeadsPerRequest: args.maxHeadsPerRequest,
      maxStateChars: args.maxStateChars,
    });
  }

  const reviewFiles: string[] = [];
  const processedEntries: string[] = [];
  const resultByScopeAndJob = new Map((run?.results ?? []).map((result) => [`${result.projectKey}\0${result.corpusKey}\0${result.jobId}`, result]));
  const rejected = new Set((run?.rejected ?? []).map((item) => `${item.projectKey}\0${item.corpusKey}\0${item.jobId}`));

  await fs.mkdir(reviewRoot, { recursive: true });
  for (const item of resolved) {
    const jobResults = item.jobs.map((job) => resultByScopeAndJob.get(`${job.projectKey}\0${job.corpusKey}\0${job.id}`)).filter((value) => value !== undefined);
    const incomplete = item.jobs.some((job) => rejected.has(`${job.projectKey}\0${job.corpusKey}\0${job.id}`)) || jobResults.length !== item.jobs.length;
    if (incomplete) {
      failedEntries.push({ entryId: item.entry.id, error: "One or more semantic curation windows were rejected or missing." });
      continue;
    }
    const reviewPath = path.join(reviewRoot, reviewFileName(item.entry));
    const review = {
      schemaVersion: 1,
      entry: item.entry,
      createdAt: new Date().toISOString(),
      advisoryOnly: true,
      canonicalRewriteAllowed: false,
      sourceTextDuplicated: false,
      jobs: item.jobs.map((job, index) => {
        const result = jobResults[index]!;
        return {
          jobId: job.id,
          blockProvenance: job.blocks.map((block) => ({
            id: block.id,
            sourceRef: block.sourceRef,
            sha256: block.sha256,
            startLine: block.startLine,
            endLine: block.endLine,
            protected: block.protected,
            validity: block.validity,
          })),
          providerResult: result.providerResult,
          evaluation: result.evaluation,
          referenceProposals: assembleMssrSemanticReferenceProposals({ blocks: job.blocks, evaluation: result.evaluation }).map((proposal) => ({
            topic: proposal.topic,
            blockIds: proposal.blockIds,
            exactSourceTextOnly: proposal.exactSourceTextOnly,
          })),
          batchId: result.batchId,
          usage: result.usage,
          elapsedMs: result.elapsedMs,
        };
      }),
    };
    await fs.writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
    reviewFiles.push(reviewPath);
    processedEntries.push(item.entry.id);
  }

  const failedMap = new Map(failedEntries.map((entry) => [entry.entryId, entry.error]));
  await updateQueueEntries(queuePath, (state) => {
    state.entries = state.entries.flatMap((entry) => {
      if (processedEntries.includes(entry.id)) return [];
      const failure = failedMap.get(entry.id);
      if (!failure) return [entry];
      return [queueEntrySchema.parse({
        ...entry,
        attempts: entry.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: failure.slice(0, 600),
      })];
    });
  });

  return {
    selectedEntries: selected.map((entry) => entry.id),
    processedEntries,
    failedEntries,
    reviewFiles,
    run,
  };
}
