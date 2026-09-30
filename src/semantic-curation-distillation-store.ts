import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { defaultMssrStateRoot } from "./state-root.js";
import {
  distillMssrSemanticRelations,
  mssrSemanticDistillationObservationSchema,
  mssrSemanticDistillationVerificationSchema,
  mssrSemanticTraceProjectionSchema,
  type MssrSemanticDistillationObservation,
  type MssrSemanticDistillationProfile,
  type MssrSemanticTraceProjection,
} from "./semantic-curation-distillation.js";

export const MSSR_SEMANTIC_DISTILLATION_STORE_VERSION = 1 as const;
const MAX_OBSERVATIONS = 5_000;

const storeSchema = z.object({
  version: z.literal(MSSR_SEMANTIC_DISTILLATION_STORE_VERSION),
  updatedAt: z.string().datetime({ offset: true }),
  observations: z.array(mssrSemanticDistillationObservationSchema).max(MAX_OBSERVATIONS),
}).strict();

type Store = z.infer<typeof storeSchema>;

export function defaultMssrSemanticDistillationStorePath(stateRoot = defaultMssrStateRoot()): string {
  return path.join(stateRoot, "semantic-curation-learning", "observations-v1.json");
}

async function readStore(storePath: string): Promise<Store> {
  try {
    const raw = await fs.readFile(storePath, "utf8");
    return storeSchema.parse(JSON.parse(raw));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code !== "ENOENT") throw error;
    return { version: 1, updatedAt: new Date(0).toISOString(), observations: [] };
  }
}

async function writeStore(storePath: string, store: Store): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const next = storeSchema.parse(store);
  const temp = `${storePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await fs.rename(temp, storePath);
}

export async function readMssrSemanticDistillationStore(args: { storePath?: string } = {}): Promise<Store> {
  return readStore(args.storePath ?? defaultMssrSemanticDistillationStorePath());
}

export async function appendMssrSemanticDistillationObservations(args: {
  observations: readonly MssrSemanticDistillationObservation[];
  storePath?: string;
}): Promise<{ added: number; total: number; storePath: string }> {
  const storePath = args.storePath ?? defaultMssrSemanticDistillationStorePath();
  const store = await readStore(storePath);
  const byId = new Map(store.observations.map((item) => [item.id, item]));
  let added = 0;
  for (const input of args.observations) {
    const observation = mssrSemanticDistillationObservationSchema.parse(input);
    if (!byId.has(observation.id)) added += 1;
    byId.set(observation.id, observation);
  }
  const observations = [...byId.values()]
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id))
    .slice(-MAX_OBSERVATIONS);
  await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { added, total: observations.length, storePath };
}

export async function attachMssrSemanticDistillationTrace(args: {
  trace: MssrSemanticTraceProjection;
  storePath?: string;
}): Promise<{ matched: number; updated: number; storePath: string }> {
  const trace = mssrSemanticTraceProjectionSchema.parse(args.trace);
  if (!trace.traceId) throw new Error("Semantic distillation trace attachment requires traceId.");
  const storePath = args.storePath ?? defaultMssrSemanticDistillationStorePath();
  const store = await readStore(storePath);
  let matched = 0;
  let updated = 0;
  const observations = store.observations.map((observation) => {
    const observationTrace = observation.trace;
    if (!observationTrace || observationTrace.traceId !== trace.traceId) return observation;
    matched += 1;
    const nextTrace = mssrSemanticTraceProjectionSchema.parse({
      ...observationTrace,
      ...trace,
      traceId: observationTrace.traceId,
      evidenceRefHashes: [...new Set([
        ...(observationTrace.evidenceRefHashes ?? []),
        ...(trace.evidenceRefHashes ?? []),
      ])].slice(0, 12),
    });
    const before = JSON.stringify(observationTrace);
    const after = JSON.stringify(nextTrace);
    if (before === after) return observation;
    updated += 1;
    return mssrSemanticDistillationObservationSchema.parse({ ...observation, trace: nextTrace });
  });
  if (updated > 0) await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { matched, updated, storePath };
}

export async function applyMssrSemanticDistillationFeedback(args: {
  observationId: string;
  status: "confirmed" | "corrected" | "rejected";
  relation?: MssrSemanticDistillationObservation["verification"]["relation"];
  evidenceRef: string;
  trace?: MssrSemanticTraceProjection;
  storePath?: string;
}): Promise<{ updated: boolean; observation: MssrSemanticDistillationObservation; storePath: string }> {
  const storePath = args.storePath ?? defaultMssrSemanticDistillationStorePath();
  const store = await readStore(storePath);
  const index = store.observations.findIndex((item) => item.id === args.observationId);
  if (index < 0) throw new Error(`Unknown semantic distillation observation '${args.observationId}'.`);
  const current = store.observations[index];
  if (args.status === "corrected" && !args.relation) throw new Error("Corrected semantic feedback requires relation.");
  const relation = args.status === "confirmed" ? args.relation ?? current.jev?.relation : args.relation;
  const verification = mssrSemanticDistillationVerificationSchema.parse({
    status: args.status,
    ...(relation ? { relation } : {}),
    evidenceRef: args.evidenceRef,
    verifiedAt: new Date().toISOString(),
  });
  const next = mssrSemanticDistillationObservationSchema.parse({
    ...current,
    ...(args.trace ? { trace: mssrSemanticTraceProjectionSchema.parse(args.trace) } : {}),
    verification,
  });
  const observations = [...store.observations];
  observations[index] = next;
  await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { updated: true, observation: next, storePath };
}

export async function buildMssrSemanticDistillationProfile(args: {
  storePath?: string;
  minObservations?: number;
  minDistinctProjects?: number;
  minLowerBound95?: number;
  minDominance?: number;
} = {}): Promise<MssrSemanticDistillationProfile> {
  const store = await readStore(args.storePath ?? defaultMssrSemanticDistillationStorePath());
  return distillMssrSemanticRelations({
    observations: store.observations,
    ...(args.minObservations !== undefined ? { minObservations: args.minObservations } : {}),
    ...(args.minDistinctProjects !== undefined ? { minDistinctProjects: args.minDistinctProjects } : {}),
    ...(args.minLowerBound95 !== undefined ? { minLowerBound95: args.minLowerBound95 } : {}),
    ...(args.minDominance !== undefined ? { minDominance: args.minDominance } : {}),
  });
}

export async function summarizeMssrSemanticDistillationLearning(args: {
  storePath?: string;
  maxRules?: number;
} = {}) {
  const storePath = args.storePath ?? defaultMssrSemanticDistillationStorePath();
  const store = await readStore(storePath);
  const profile = distillMssrSemanticRelations({ observations: store.observations });
  const maxRules = Math.max(0, Math.min(100, Math.floor(args.maxRules ?? 20)));
  return {
    storePath,
    updatedAt: store.updatedAt,
    ...profile.metrics,
    rules: profile.rules.slice(0, maxRules),
    truncated: profile.rules.length > maxRules,
    policy: profile.policy,
    contextMode: "compact-feature-projection" as const,
    rawTraceLoaded: false as const,
    rawSourceTextStored: false as const,
    rawJevIsTrainingTruth: false as const,
    routingInfluence: false as const,
    canonicalRewriteAllowed: false as const,
  };
}
