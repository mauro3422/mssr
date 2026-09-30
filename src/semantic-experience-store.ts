import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { defaultMssrStateRoot } from "./state-root.js";
import {
  classifyMssrSemanticExperienceDeterministically,
  createMssrSemanticExperienceObservation,
  distillMssrSemanticExperience,
  mssrSemanticExperienceObservationSchema,
  mssrSemanticExperienceVerificationSchema,
  type MssrSemanticExperienceDecisionKind,
  type MssrSemanticExperienceFeature,
  type MssrSemanticExperienceObservation,
  type MssrSemanticExperienceProfile,
} from "./semantic-experience.js";
import {
  mssrSemanticTraceProjectionSchema,
  type MssrSemanticTraceProjection,
} from "./semantic-curation-distillation.js";
import {
  assertMssrExplicitVerificationIndependent,
  type MssrExplicitVerifierIdentity,
} from "./explicit-verification.js";

export const MSSR_SEMANTIC_EXPERIENCE_STORE_VERSION = 1 as const;
const MAX_OBSERVATIONS = 10_000;

const storeSchema = z.object({
  version: z.literal(MSSR_SEMANTIC_EXPERIENCE_STORE_VERSION),
  updatedAt: z.string().datetime({ offset: true }),
  observations: z.array(mssrSemanticExperienceObservationSchema).max(MAX_OBSERVATIONS),
}).strict();
type Store = z.infer<typeof storeSchema>;

export function defaultMssrSemanticExperienceStorePath(stateRoot = defaultMssrStateRoot()): string {
  return path.join(stateRoot, "semantic-experience", "observations-v1.json");
}

async function readStore(storePath: string): Promise<Store> {
  try {
    return storeSchema.parse(JSON.parse(await fs.readFile(storePath, "utf8")));
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code !== "ENOENT") throw error;
    return { version: 1, updatedAt: new Date(0).toISOString(), observations: [] };
  }
}

async function writeStore(storePath: string, store: Store): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  const parsed = storeSchema.parse(store);
  const temp = `${storePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temp, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await fs.rename(temp, storePath);
}

export async function readMssrSemanticExperienceStore(args: { storePath?: string } = {}): Promise<Store> {
  return readStore(args.storePath ?? defaultMssrSemanticExperienceStorePath());
}

export async function appendMssrSemanticExperienceObservations(args: {
  observations: readonly MssrSemanticExperienceObservation[];
  storePath?: string;
}): Promise<{ added: number; total: number; storePath: string }> {
  const storePath = args.storePath ?? defaultMssrSemanticExperienceStorePath();
  const store = await readStore(storePath);
  const byId = new Map(store.observations.map((item) => [item.id, item]));
  let added = 0;
  for (const input of args.observations) {
    const observation = mssrSemanticExperienceObservationSchema.parse(input);
    if (!byId.has(observation.id)) added += 1;
    byId.set(observation.id, observation);
  }
  const observations = [...byId.values()]
    .sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.id.localeCompare(right.id))
    .slice(-MAX_OBSERVATIONS);
  await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { added, total: observations.length, storePath };
}

export async function attachMssrSemanticExperienceTrace(args: {
  trace: MssrSemanticTraceProjection;
  storePath?: string;
}): Promise<{ matched: number; updated: number; storePath: string }> {
  const trace = mssrSemanticTraceProjectionSchema.parse(args.trace);
  if (!trace.traceId) throw new Error("Semantic experience trace attachment requires traceId.");
  const storePath = args.storePath ?? defaultMssrSemanticExperienceStorePath();
  const store = await readStore(storePath);
  let matched = 0;
  let updated = 0;
  const observations = store.observations.map((observation) => {
    const current = observation.trace;
    if (!current || current.traceId !== trace.traceId) return observation;
    matched += 1;
    const nextTrace = mssrSemanticTraceProjectionSchema.parse({
      ...current,
      ...trace,
      traceId: current.traceId,
      evidenceRefHashes: [...new Set([...(current.evidenceRefHashes ?? []), ...(trace.evidenceRefHashes ?? [])])].slice(0, 12),
    });
    if (JSON.stringify(current) === JSON.stringify(nextTrace)) return observation;
    updated += 1;
    return mssrSemanticExperienceObservationSchema.parse({ ...observation, trace: nextTrace });
  });
  if (updated > 0) await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { matched, updated, storePath };
}

export async function applyMssrSemanticExperienceFeedback(args: {
  observationId: string;
  status: "confirmed" | "corrected" | "rejected";
  value?: string;
  evidenceRef: string;
  evidenceRevision?: string;
  verificationId: string;
  verifier: MssrExplicitVerifierIdentity;
  trace?: MssrSemanticTraceProjection;
  storePath?: string;
}): Promise<{ updated: boolean; observation: MssrSemanticExperienceObservation; storePath: string }> {
  const storePath = args.storePath ?? defaultMssrSemanticExperienceStorePath();
  const store = await readStore(storePath);
  const index = store.observations.findIndex((item) => item.id === args.observationId);
  if (index < 0) throw new Error(`Unknown semantic experience observation '${args.observationId}'.`);
  const current = store.observations[index];
  if (args.status === "corrected" && !args.value) throw new Error("Corrected semantic experience feedback requires value.");
  const value = args.status === "confirmed" ? args.value ?? current.proposal?.value : args.value;
  if (args.status === "confirmed" && !value) throw new Error("Confirmed semantic experience feedback requires a proposal or explicit value.");

  const explicit = assertMssrExplicitVerificationIndependent({
    schemaVersion: 1,
    verificationId: args.verificationId,
    subject: {
      namespace: "experience",
      kind: "observation",
      identity: current.id,
      ...(current.proposal?.provider ? { proposalProvider: current.proposal.provider } : {}),
      ...(current.trace?.traceId ? { proposalTraceId: current.trace.traceId } : {}),
    },
    status: args.status,
    ...(value ? { value } : {}),
    evidenceRef: args.evidenceRef,
    ...(args.evidenceRevision ? { evidenceRevision: args.evidenceRevision } : {}),
    verifier: args.verifier,
    observedAt: new Date().toISOString(),
  });

  const verificationIdentity = {
    verificationId: explicit.verificationId,
    status: explicit.status,
    value: explicit.value ?? null,
    evidenceRef: explicit.evidenceRef,
    evidenceRevision: explicit.evidenceRevision ?? null,
    verifier: explicit.verifier,
    independent: true,
  };
  const currentIdentity = {
    verificationId: current.verification.verificationId ?? null,
    status: current.verification.status,
    value: current.verification.value ?? null,
    evidenceRef: current.verification.evidenceRef ?? null,
    evidenceRevision: current.verification.evidenceRevision ?? null,
    verifier: current.verification.verifier ?? null,
    independent: current.verification.independent === true,
  };
  if (current.verification.verificationId === explicit.verificationId) {
    if (JSON.stringify(currentIdentity) === JSON.stringify(verificationIdentity)) {
      return { updated: false, observation: current, storePath };
    }
    throw new Error(`Semantic experience verification identity collision '${explicit.verificationId}'.`);
  }

  const verification = mssrSemanticExperienceVerificationSchema.parse({
    status: explicit.status,
    ...(explicit.value ? { value: explicit.value } : {}),
    evidenceRef: explicit.evidenceRef,
    ...(explicit.evidenceRevision ? { evidenceRevision: explicit.evidenceRevision } : {}),
    verificationId: explicit.verificationId,
    verifier: explicit.verifier,
    independent: true,
    verifiedAt: explicit.observedAt,
  });
  const next = mssrSemanticExperienceObservationSchema.parse({
    ...current,
    ...(args.trace ? { trace: mssrSemanticTraceProjectionSchema.parse(args.trace) } : {}),
    verification,
  });
  const observations = [...store.observations];
  observations[index] = next;
  await writeStore(storePath, { version: 1, updatedAt: new Date().toISOString(), observations });
  return { updated: true, observation: next, storePath };
}

export async function buildMssrSemanticExperienceProfile(args: {
  storePath?: string;
  minObservations?: number;
  minDistinctProjects?: number;
  minLowerBound95?: number;
  minDominance?: number;
} = {}): Promise<MssrSemanticExperienceProfile> {
  const store = await readStore(args.storePath ?? defaultMssrSemanticExperienceStorePath());
  return distillMssrSemanticExperience({
    observations: store.observations,
    ...(args.minObservations !== undefined ? { minObservations: args.minObservations } : {}),
    ...(args.minDistinctProjects !== undefined ? { minDistinctProjects: args.minDistinctProjects } : {}),
    ...(args.minLowerBound95 !== undefined ? { minLowerBound95: args.minLowerBound95 } : {}),
    ...(args.minDominance !== undefined ? { minDominance: args.minDominance } : {}),
  });
}

export async function classifyMssrSemanticExperienceFromStore(args: {
  decisionKind: MssrSemanticExperienceDecisionKind;
  feature: MssrSemanticExperienceFeature;
  storePath?: string;
}) {
  const profile = await buildMssrSemanticExperienceProfile(args.storePath ? { storePath: args.storePath } : {});
  return classifyMssrSemanticExperienceDeterministically({ decisionKind: args.decisionKind, feature: args.feature, profile });
}

/**
 * Run the deterministic fallback and, only when it abstains, record one bounded
 * shadow experience describing that abstention. The observation is never
 * self-verified and retries from the same trace/feature are deduplicated.
 */
export async function classifyAndObserveMssrSemanticExperienceFromStore(args: {
  decisionKind: MssrSemanticExperienceDecisionKind;
  feature: MssrSemanticExperienceFeature;
  projectKey: string;
  trace?: MssrSemanticTraceProjection;
  storePath?: string;
}) {
  const storePath = args.storePath ?? defaultMssrSemanticExperienceStorePath();
  const profile = await buildMssrSemanticExperienceProfile({ storePath });
  const decision = classifyMssrSemanticExperienceDeterministically({ decisionKind: args.decisionKind, feature: args.feature, profile });
  if (decision.basis !== "abstain") return { decision, abstentionRecorded: false, observationId: null as string | null };

  const observation = createMssrSemanticExperienceObservation({
    projectKey: args.projectKey,
    decisionKind: "abstention-policy",
    feature: {
      subjectKind: "deterministic-fallback",
      candidateKinds: [args.decisionKind, args.feature.subjectKind],
      signals: ["no-distilled-rule"],
      flags: { reviewRequired: true },
      buckets: { originalDecisionKind: args.decisionKind, originalSubjectKind: args.feature.subjectKind },
    },
    proposal: {
      value: "abstain",
      confidence: 1,
      provider: "mssr-deterministic-fallback",
      modelId: "semantic-experience-v1",
    },
    ...(args.trace ? { trace: args.trace } : {}),
  });
  const store = await readStore(storePath);
  const duplicate = store.observations.some((item) => item.decisionKind === "abstention-policy"
    && item.projectKey === observation.projectKey
    && item.featureSignature === observation.featureSignature
    && (item.trace?.traceId ?? null) === (observation.trace?.traceId ?? null));
  if (duplicate) return { decision, abstentionRecorded: false, observationId: observation.id };
  await appendMssrSemanticExperienceObservations({ observations: [observation], storePath });
  return { decision, abstentionRecorded: true, observationId: observation.id };
}

export async function summarizeMssrSemanticExperienceLearning(args: {
  storePath?: string;
  maxRules?: number;
} = {}) {
  const storePath = args.storePath ?? defaultMssrSemanticExperienceStorePath();
  const store = await readStore(storePath);
  const profile = distillMssrSemanticExperience({ observations: store.observations });
  const maxRules = Math.max(0, Math.min(100, Math.floor(args.maxRules ?? 20)));
  return {
    storePath,
    updatedAt: store.updatedAt,
    ...profile.metrics,
    rules: profile.rules.slice(0, maxRules),
    truncated: profile.rules.length > maxRules,
    policy: profile.policy,
    contextMode: "compact-semantic-experience-projection" as const,
    rawTraceLoaded: false as const,
    rawSourceTextStored: false as const,
    rawProviderIsTrainingTruth: false as const,
    authorityInfluence: false as const,
    routingInfluence: false as const,
    canonicalRewriteAllowed: false as const,
    autoApplyAllowed: false as const,
  };
}
