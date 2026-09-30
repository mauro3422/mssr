import { z } from "zod";
import { MSSR_SEMANTIC_CURATION_MAX_HEADS } from "./semantic-curation.js";

export const MSSR_SEMANTIC_CURATION_QUEUE_REASONS = [
  "project-context-entry-budget-exceeded",
  "project-root-file-growing",
  "semantic-segmentation-review-required",
  "skill-context-budget-exceeded",
  "duplicate-candidate",
  "contradiction-candidate",
  "stale-current-state",
  "manual-review",
] as const;
export type MssrSemanticCurationQueueReason = typeof MSSR_SEMANTIC_CURATION_QUEUE_REASONS[number];

const queueIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const projectKeySchema = z.string().min(1).max(240).refine((value) => !/[\r\n]/.test(value));
const sourceRefSchema = z.string().min(1).max(320).refine((value) => !/[\r\n]/.test(value));

export const mssrSemanticCurationQueueItemSchema = z.object({
  id: queueIdSchema,
  projectKey: projectKeySchema,
  corpusKey: projectKeySchema.optional(),
  sourceRef: sourceRefSchema,
  reasons: z.array(z.enum(MSSR_SEMANTIC_CURATION_QUEUE_REASONS)).min(1).max(8),
  estimatedHeads: z.number().int().min(1).max(MSSR_SEMANTIC_CURATION_MAX_HEADS),
  estimatedStateChars: z.number().int().min(1).max(262_144),
  priority: z.number().int().min(-100).max(100).default(0),
  createdAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export type MssrSemanticCurationQueueItemInput = z.input<typeof mssrSemanticCurationQueueItemSchema>;
export type MssrSemanticCurationQueueItem = z.output<typeof mssrSemanticCurationQueueItemSchema>;

export type MssrSemanticCurationBatch = {
  batchId: string;
  projectKey: string;
  corpusKey: string;
  itemIds: string[];
  sourceRefs: string[];
  estimatedHeads: number;
  remainingHeads: number;
  estimatedStateChars: number;
  maxHeads: number;
  maxStateChars: number;
  canRunInParallelWithOtherProjects: true;
  mixedProjectState: false;
};

export type MssrSemanticCurationQueuePlan = {
  batches: MssrSemanticCurationBatch[];
  rejected: Array<{ itemId: string; reason: "state-budget-exceeded" }>;
  totalItems: number;
  totalBatches: number;
  parallelProjectGroups: number;
  policy: {
    mixedProjectState: false;
    fillSpareHeadsWithinProject: true;
    crossProjectParallelismAllowed: true;
  };
};

function stableBatchId(projectKey: string, corpusKey: string, ordinal: number): string {
  const projectSlug = projectKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "project";
  const corpusSlug = corpusKey.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 28) || "corpus";
  return `semantic-curation:${projectSlug}:${corpusSlug}:${ordinal}`;
}

/**
 * Greedily fills Jev/System-One head capacity without mixing unrelated semantic
 * corpora. Different project/corpus scopes may execute concurrently; spare heads
 * are only filled by items that share the same state corpus.
 * MSSR only plans the queue; it does not perform network calls or persist files.
 */
export function planMssrSemanticCurationQueue(args: {
  items: readonly MssrSemanticCurationQueueItemInput[];
  maxHeads?: number;
  maxStateChars?: number;
}): MssrSemanticCurationQueuePlan {
  const maxHeads = Math.max(1, Math.min(MSSR_SEMANTIC_CURATION_MAX_HEADS, Math.floor(args.maxHeads ?? MSSR_SEMANTIC_CURATION_MAX_HEADS)));
  const maxStateChars = Math.max(1_000, Math.min(262_144, Math.floor(args.maxStateChars ?? 24_000)));
  const items = args.items.map((item) => {
    const parsed = mssrSemanticCurationQueueItemSchema.parse(item);
    return { ...parsed, corpusKey: parsed.corpusKey ?? parsed.sourceRef };
  });
  const byCorpus = new Map<string, MssrSemanticCurationQueueItem[]>();
  for (const item of items) {
    const scopeKey = `${item.projectKey}\0${item.corpusKey}`;
    const group = byCorpus.get(scopeKey) ?? [];
    group.push(item);
    byCorpus.set(scopeKey, group);
  }

  const batches: MssrSemanticCurationBatch[] = [];
  const rejected: MssrSemanticCurationQueuePlan["rejected"] = [];
  const projectKeys = new Set(items.map((item) => item.projectKey));

  for (const [, corpusItems] of [...byCorpus.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const projectKey = corpusItems[0].projectKey;
    const corpusKey = corpusItems[0].corpusKey!;
    const sorted = [...corpusItems].sort((left, right) => right.priority - left.priority
      || left.createdAt?.localeCompare(right.createdAt ?? "") || 0
      || left.id.localeCompare(right.id));
    let ordinal = 1;
    let current: MssrSemanticCurationQueueItem[] = [];
    let currentHeads = 0;
    let currentStateChars = 0;

    const flush = () => {
      if (current.length === 0) return;
      batches.push({
        batchId: stableBatchId(projectKey, corpusKey, ordinal++),
        projectKey,
        corpusKey,
        itemIds: current.map((item) => item.id),
        sourceRefs: current.map((item) => item.sourceRef),
        estimatedHeads: currentHeads,
        remainingHeads: maxHeads - currentHeads,
        estimatedStateChars: currentStateChars,
        maxHeads,
        maxStateChars,
        canRunInParallelWithOtherProjects: true,
        mixedProjectState: false,
      });
      current = [];
      currentHeads = 0;
      currentStateChars = 0;
    };

    for (const item of sorted) {
      if (item.estimatedStateChars > maxStateChars) {
        rejected.push({ itemId: item.id, reason: "state-budget-exceeded" });
        continue;
      }
      const wouldOverflowHeads = currentHeads + item.estimatedHeads > maxHeads;
      const wouldOverflowState = currentStateChars + item.estimatedStateChars > maxStateChars;
      if (wouldOverflowHeads || wouldOverflowState) flush();
      current.push(item);
      currentHeads += item.estimatedHeads;
      currentStateChars += item.estimatedStateChars;
      if (currentHeads === maxHeads) flush();
    }
    flush();
  }

  return {
    batches,
    rejected,
    totalItems: items.length,
    totalBatches: batches.length,
    parallelProjectGroups: projectKeys.size,
    policy: {
      mixedProjectState: false,
      fillSpareHeadsWithinProject: true,
      crossProjectParallelismAllowed: true,
    },
  };
}
