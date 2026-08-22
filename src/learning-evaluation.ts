import { z } from "zod";

import { mssrLearningDigestSchema, type MssrLearningDigest } from "./learning.js";

/**
 * Gates B--E for historical learning.  This module deliberately has no
 * dependency on the router: it audits and evaluates privacy-bounded digests,
 * but cannot supply a score, callback, or side effect to route selection.
 */
export const MSSR_LEARNING_EVALUATION_MODE = "observe-only" as const;

const boundedText = z.string().trim().min(1).max(160);
const revision = z.string().trim().min(1).max(240);

export const mssrLearningDatasetRecordSchema = z.object({
  traceId: boundedText,
  observedAt: z.string().datetime({ offset: true }),
  source: z.enum(["strict-learning-digest", "legacy-selection-telemetry"]),
  digest: mssrLearningDigestSchema,
  /** Identifies a retry/attempt family without containing prompt content. */
  correlationKey: boundedText.optional(),
  host: boundedText.optional(),
  model: boundedText.optional(),
  runtime: boundedText.optional(),
  routingRevision: revision.optional(),
  skillRevisions: z.record(revision).default({}),
}).strict();

export type MssrLearningDatasetRecord = z.infer<typeof mssrLearningDatasetRecordSchema>;

export type MssrLearningRevisionSnapshot = Readonly<{
  routingRevision?: string;
  skillRevisions?: Readonly<Record<string, string>>;
}>;

export type MssrLearningDatasetAudit = Readonly<{
  mode: "observe-only";
  routingInfluence: false;
  status: "ready" | "abstained";
  abstentionReasons: readonly string[];
  inputRecords: number;
  validRecords: number;
  invalidRecords: number;
  strictDigestRecords: number;
  legacyRecords: number;
  eligibleStrictRecords: number;
  decisionEvidence: Readonly<{
    accepted: number;
    skipped: number;
    notEvaluated: number;
    ambiguous: number;
  }>;
  outcomes: Readonly<{
    complete: number;
    incomplete: number;
    unknownAcceptance: number;
  }>;
  duplicateTraceIds: readonly string[];
  correlatedAttemptGroups: readonly string[];
  staleRoutingTraceIds: readonly string[];
  staleSkillTraceIds: readonly string[];
  unknownRevisionTraceIds: readonly string[];
  environmentDrift: Readonly<{
    hosts: readonly string[];
    models: readonly string[];
    runtimes: readonly string[];
  }>;
}>;

export type MssrLearningEvaluationOptions = Readonly<{
  minDistinctTraces?: number;
  minHoldoutRecords?: number;
  holdoutFraction?: number;
  halfLifeDays?: number;
  acceptThreshold?: number;
  skipThreshold?: number;
  currentRevisions?: MssrLearningRevisionSnapshot;
}>;

export type MssrLearningPrediction = Readonly<{
  traceId: string;
  observedAt: string;
  semanticSignature: string;
  skillName: string;
  actual: "accepted" | "skipped";
  deterministicBaselineCandidate: boolean;
  suggestion: "accept" | "skip" | "abstain";
  probabilityAccepted: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  distinctTraceSupport: number;
}>;

export type MssrLearningMetrics = Readonly<{
  targetCount: number;
  predictedCount: number;
  abstainedCount: number;
  suggestedAccepts: number;
  suggestedSkips: number;
  correctAccepts: number;
  correctSkips: number;
  acceptPrecision: number | null;
  acceptRecall: number | null;
  overActivationRate: number | null;
  falseSkipRate: number | null;
  brierScore: number | null;
  deterministicBaselineDisagreements: number;
  requiredLoadMisses: Readonly<{ status: "not-measurable"; reason: string }>;
}>;

export type MssrLearningReplayResult = Readonly<{
  mode: "observe-only";
  routingInfluence: false;
  status: "evaluated" | "abstained";
  abstentionReasons: readonly string[];
  predictions: readonly MssrLearningPrediction[];
  metrics: MssrLearningMetrics;
}>;

export type MssrLearningCalibrationResult = Readonly<{
  mode: "observe-only";
  routingInfluence: false;
  status: "evaluated" | "abstained";
  abstentionReasons: readonly string[];
  method: "beta(1,1)-smoothing + Wilson-95";
  bins: readonly Readonly<{ lower: number; upper: number; count: number; meanPredicted: number | null; observedAcceptance: number | null; gap: number | null }> [];
  meanAbsoluteCalibrationError: number | null;
}>;

export type MssrLearningShadowResult = Readonly<{
  mode: "observe-only";
  routingInfluence: false;
  status: "evaluated" | "abstained";
  abstentionReasons: readonly string[];
  trainingRecordCount: number;
  shadowRecordCount: number;
  disagreementsWithExecutedDecision: number;
  predictions: readonly MssrLearningPrediction[];
  metrics: MssrLearningMetrics;
}>;

export type MssrLearningEvaluation = Readonly<{
  mode: "observe-only";
  routingInfluence: false;
  automaticPromotionPerformed: false;
  audit: MssrLearningDatasetAudit;
  replay: MssrLearningReplayResult;
  holdout: MssrLearningReplayResult;
  calibration: MssrLearningCalibrationResult;
  shadow: MssrLearningShadowResult;
}>;

type Candidate = Readonly<{
  traceId: string;
  observedAt: string;
  semanticSignature: string;
  skillName: string;
  actual: "accepted" | "skipped";
  deterministicBaselineCandidate: boolean;
  correlationKey?: string;
}>;

const defaults = {
  minDistinctTraces: 5,
  minHoldoutRecords: 3,
  holdoutFraction: 0.2,
  halfLifeDays: 90,
  acceptThreshold: 0.65,
  skipThreshold: 0.35,
} as const;

function config(input: MssrLearningEvaluationOptions = {}) {
  const minDistinctTraces = z.number().int().min(2).max(100).default(defaults.minDistinctTraces).parse(input.minDistinctTraces);
  const minHoldoutRecords = z.number().int().min(1).max(1000).default(defaults.minHoldoutRecords).parse(input.minHoldoutRecords);
  const holdoutFraction = z.number().gt(0).lt(0.5).default(defaults.holdoutFraction).parse(input.holdoutFraction);
  const halfLifeDays = z.number().positive().max(3650).default(defaults.halfLifeDays).parse(input.halfLifeDays);
  const acceptThreshold = z.number().min(0.5).max(1).default(defaults.acceptThreshold).parse(input.acceptThreshold);
  const skipThreshold = z.number().min(0).max(0.5).default(defaults.skipThreshold).parse(input.skipThreshold);
  if (skipThreshold >= acceptThreshold) throw new Error("skipThreshold must be below acceptThreshold");
  return { minDistinctTraces, minHoldoutRecords, holdoutFraction, halfLifeDays, acceptThreshold, skipThreshold };
}

function uniq(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function count(values: readonly string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function isCompleteOutcome(digest: MssrLearningDigest): boolean {
  return digest.outcome.status !== "partial";
}

/** Gate B: validate provenance/quality while leaving strict and legacy data separate. */
export function auditMssrLearningDataset(
  input: readonly unknown[],
  options: MssrLearningEvaluationOptions = {},
): MssrLearningDatasetAudit {
  const settings = config(options);
  const records: MssrLearningDatasetRecord[] = [];
  let invalidRecords = 0;
  for (const item of input) {
    const parsed = mssrLearningDatasetRecordSchema.safeParse(item);
    if (parsed.success) records.push(parsed.data);
    else invalidRecords += 1;
  }
  const strict = records.filter((record) => record.source === "strict-learning-digest");
  const duplicateTraceIds = [...count(strict.map((record) => record.traceId)).entries()]
    .filter(([, value]) => value > 1).map(([value]) => value).sort();
  const correlationCounts = count(strict.flatMap((record) => record.correlationKey ? [record.correlationKey] : []));
  const correlatedAttemptGroups = [...correlationCounts.entries()].filter(([, value]) => value > 1).map(([value]) => value).sort();
  const duplicateSet = new Set(duplicateTraceIds);
  const staleRoutingTraceIds: string[] = [];
  const staleSkillTraceIds: string[] = [];
  const unknownRevisionTraceIds: string[] = [];
  const skillSnapshot = options.currentRevisions?.skillRevisions ?? {};
  for (const record of strict) {
    const routingExpected = options.currentRevisions?.routingRevision;
    if (!record.routingRevision && routingExpected) unknownRevisionTraceIds.push(record.traceId);
    if (routingExpected && record.routingRevision && record.routingRevision !== routingExpected) staleRoutingTraceIds.push(record.traceId);
    const skills = new Set([...record.digest.recommendedSkills, ...record.digest.loadedSkills, ...record.digest.skillDecisions.map((item) => item.skillName)]);
    let missing = false;
    let stale = false;
    for (const skill of skills) {
      if (!(skill in skillSnapshot)) continue;
      const observed = record.skillRevisions[skill];
      if (!observed) missing = true;
      else if (observed !== skillSnapshot[skill]) stale = true;
    }
    if (missing) unknownRevisionTraceIds.push(record.traceId);
    if (stale) staleSkillTraceIds.push(record.traceId);
  }
  let accepted = 0;
  let skipped = 0;
  let notEvaluated = 0;
  const decisionsByTraceSkill = new Map<string, Set<"accepted" | "skipped">>();
  let complete = 0;
  let incomplete = 0;
  let unknownAcceptance = 0;
  for (const record of strict) {
    if (isCompleteOutcome(record.digest)) complete += 1;
    else incomplete += 1;
    if (typeof record.digest.outcome.accepted !== "boolean") unknownAcceptance += 1;
    for (const decision of record.digest.skillDecisions) {
      if (decision.reasonCode === "not-evaluated") notEvaluated += 1;
      else if (decision.decision === "accepted") accepted += 1;
      else skipped += 1;
      const key = `${record.traceId}\n${decision.skillName}`;
      const values = decisionsByTraceSkill.get(key) ?? new Set<"accepted" | "skipped">();
      values.add(decision.decision);
      decisionsByTraceSkill.set(key, values);
    }
  }
  const ambiguous = [...decisionsByTraceSkill.values()].filter((values) => values.size > 1).length;
  // A repeated trace id is unusable, but a retry family can contribute exactly
  // one earliest trace.  This retains evidence without inflating support.
  const correlationExtras = [...correlationCounts.values()].reduce((sum, value) => sum + Math.max(0, value - 1), 0);
  const excluded = strict.filter((record) => duplicateSet.has(record.traceId)).length + correlationExtras;
  const abstentionReasons: string[] = [];
  if (strict.length < settings.minDistinctTraces) abstentionReasons.push("insufficient-strict-digest-records");
  if (strict.length - excluded < settings.minDistinctTraces) abstentionReasons.push("insufficient-independent-trace-support");
  if (accepted + skipped === 0) abstentionReasons.push("no-explicit-optional-decisions");
  return {
    mode: MSSR_LEARNING_EVALUATION_MODE,
    routingInfluence: false,
    status: abstentionReasons.length ? "abstained" : "ready",
    abstentionReasons: uniq(abstentionReasons),
    inputRecords: input.length,
    validRecords: records.length,
    invalidRecords,
    strictDigestRecords: strict.length,
    legacyRecords: records.length - strict.length,
    eligibleStrictRecords: strict.length - excluded,
    decisionEvidence: { accepted, skipped, notEvaluated, ambiguous },
    outcomes: { complete, incomplete, unknownAcceptance },
    duplicateTraceIds,
    correlatedAttemptGroups,
    staleRoutingTraceIds: uniq(staleRoutingTraceIds),
    staleSkillTraceIds: uniq(staleSkillTraceIds),
    unknownRevisionTraceIds: uniq(unknownRevisionTraceIds),
    environmentDrift: {
      hosts: uniq(strict.flatMap((record) => record.host ? [record.host] : [])),
      models: uniq(strict.flatMap((record) => record.model ? [record.model] : [])),
      runtimes: uniq(strict.flatMap((record) => record.runtime ? [record.runtime] : [])),
    },
  };
}

function candidates(records: readonly MssrLearningDatasetRecord[], audit: MssrLearningDatasetAudit): Candidate[] {
  const duplicate = new Set(audit.duplicateTraceIds);
  const stale = new Set([...audit.staleRoutingTraceIds, ...audit.staleSkillTraceIds]);
  const values: Candidate[] = [];
  for (const record of records) {
    if (record.source !== "strict-learning-digest" || duplicate.has(record.traceId) || stale.has(record.traceId)) continue;
    const perSkill = new Map<string, typeof record.digest.skillDecisions[number][]>();
    for (const decision of record.digest.skillDecisions) {
      const list = perSkill.get(decision.skillName) ?? [];
      list.push(decision);
      perSkill.set(decision.skillName, list);
    }
    for (const [skillName, decisions] of perSkill) {
      if (decisions.length !== 1 || decisions[0].reasonCode === "not-evaluated") continue;
      values.push({
        traceId: record.traceId,
        observedAt: record.observedAt,
        semanticSignature: record.digest.semanticSignature,
        skillName,
        actual: decisions[0].decision,
        deterministicBaselineCandidate: record.digest.recommendedSkills.includes(skillName),
        correlationKey: record.correlationKey,
      });
    }
  }
  // Keep exactly the earliest retry record when a correlation key was supplied.
  const firstByCorrelation = new Set<string>();
  return values.sort((left, right) => left.observedAt.localeCompare(right.observedAt) || left.traceId.localeCompare(right.traceId))
    .filter((candidate) => {
      if (!candidate.correlationKey) return true;
      const key = `${candidate.correlationKey}\n${candidate.skillName}`;
      if (firstByCorrelation.has(key)) return false;
      firstByCorrelation.add(key);
      return true;
    });
}

function key(candidate: Pick<Candidate, "semanticSignature" | "skillName">): string {
  return `${candidate.semanticSignature}\n${candidate.skillName}`;
}

function wilson(successes: number, total: number): readonly [number, number] {
  if (total <= 0) return [0, 1];
  const z95 = 1.959963984540054;
  const p = successes / total;
  const base = 1 + z95 ** 2 / total;
  const center = (p + z95 ** 2 / (2 * total)) / base;
  const spread = z95 * Math.sqrt((p * (1 - p) + z95 ** 2 / (4 * total)) / total) / base;
  return [Math.max(0, center - spread), Math.min(1, center + spread)];
}

function prediction(history: readonly Candidate[], target: Candidate, settings: ReturnType<typeof config>): MssrLearningPrediction {
  const distinct = new Set(history.map((item) => item.traceId));
  if (distinct.size < settings.minDistinctTraces) {
    return { ...target, suggestion: "abstain", probabilityAccepted: null, lowerBound: null, upperBound: null, distinctTraceSupport: distinct.size };
  }
  const targetAt = Date.parse(target.observedAt);
  let accepted = 0;
  let total = 0;
  for (const item of history) {
    const ageDays = Math.max(0, targetAt - Date.parse(item.observedAt)) / 86_400_000;
    const weight = Math.pow(0.5, ageDays / settings.halfLifeDays);
    total += weight;
    if (item.actual === "accepted") accepted += weight;
  }
  const probabilityAccepted = (accepted + 1) / (total + 2);
  const [lowerBound, upperBound] = wilson(accepted + 1, total + 2);
  const suggestion = lowerBound >= settings.acceptThreshold ? "accept"
    : upperBound <= settings.skipThreshold ? "skip"
      : "abstain";
  return { ...target, suggestion, probabilityAccepted, lowerBound, upperBound, distinctTraceSupport: distinct.size };
}

function metrics(predictions: readonly MssrLearningPrediction[]): MssrLearningMetrics {
  const suggestedAccepts = predictions.filter((item) => item.suggestion === "accept");
  const suggestedSkips = predictions.filter((item) => item.suggestion === "skip");
  const correctAccepts = suggestedAccepts.filter((item) => item.actual === "accepted").length;
  const correctSkips = suggestedSkips.filter((item) => item.actual === "skipped").length;
  const actualAccepted = predictions.filter((item) => item.actual === "accepted").length;
  const scored = predictions.filter((item) => item.probabilityAccepted !== null);
  const brierScore = scored.length === 0 ? null : scored.reduce((sum, item) => {
    const actual = item.actual === "accepted" ? 1 : 0;
    return sum + (item.probabilityAccepted! - actual) ** 2;
  }, 0) / scored.length;
  return {
    targetCount: predictions.length,
    predictedCount: suggestedAccepts.length + suggestedSkips.length,
    abstainedCount: predictions.filter((item) => item.suggestion === "abstain").length,
    suggestedAccepts: suggestedAccepts.length,
    suggestedSkips: suggestedSkips.length,
    correctAccepts,
    correctSkips,
    acceptPrecision: suggestedAccepts.length === 0 ? null : correctAccepts / suggestedAccepts.length,
    acceptRecall: actualAccepted === 0 ? null : correctAccepts / actualAccepted,
    overActivationRate: suggestedAccepts.length === 0 ? null : (suggestedAccepts.length - correctAccepts) / suggestedAccepts.length,
    falseSkipRate: suggestedSkips.length === 0 ? null : (suggestedSkips.length - correctSkips) / suggestedSkips.length,
    brierScore,
    deterministicBaselineDisagreements: predictions.filter((item) => (item.suggestion === "accept") !== item.deterministicBaselineCandidate && item.suggestion !== "abstain").length,
    requiredLoadMisses: { status: "not-measurable", reason: "learning-digest-v1 does not encode required-load execution per candidate" },
  };
}

function result(predictions: readonly MssrLearningPrediction[], minTargets: number): MssrLearningReplayResult {
  const abstentionReasons = predictions.length < minTargets ? ["insufficient-evaluable-holdout-records"] : [];
  return {
    mode: MSSR_LEARNING_EVALUATION_MODE,
    routingInfluence: false,
    status: abstentionReasons.length ? "abstained" : "evaluated",
    abstentionReasons,
    predictions,
    metrics: metrics(predictions),
  };
}

/** Gate C: chronological replay; each suggestion sees only earlier evidence. */
export function replayMssrLearningDecisions(
  records: readonly unknown[],
  options: MssrLearningEvaluationOptions = {},
): MssrLearningReplayResult {
  const audit = auditMssrLearningDataset(records, options);
  const parsed = records.flatMap((record) => {
    const value = mssrLearningDatasetRecordSchema.safeParse(record);
    return value.success ? [value.data] : [];
  });
  const settings = config(options);
  if (audit.status === "abstained") return { ...result([], settings.minHoldoutRecords), abstentionReasons: audit.abstentionReasons };
  const history = new Map<string, Candidate[]>();
  const predictions: MssrLearningPrediction[] = [];
  for (const candidate of candidates(parsed, audit)) {
    const existing = history.get(key(candidate)) ?? [];
    predictions.push(prediction(existing, candidate, settings));
    history.set(key(candidate), [...existing, candidate]);
  }
  return result(predictions, settings.minHoldoutRecords);
}

/** Gate C holdout: training evidence is frozen before the held-out period. */
export function evaluateMssrLearningHoldout(
  records: readonly unknown[],
  options: MssrLearningEvaluationOptions = {},
): MssrLearningReplayResult {
  const audit = auditMssrLearningDataset(records, options);
  const parsed = records.flatMap((record) => {
    const value = mssrLearningDatasetRecordSchema.safeParse(record);
    return value.success ? [value.data] : [];
  });
  const settings = config(options);
  if (audit.status === "abstained") return { ...result([], settings.minHoldoutRecords), abstentionReasons: audit.abstentionReasons };
  const values = candidates(parsed, audit);
  const boundary = Math.max(1, Math.floor(values.length * (1 - settings.holdoutFraction)));
  const training = values.slice(0, boundary);
  const heldOut = values.slice(boundary);
  if (heldOut.length < settings.minHoldoutRecords) return result([], settings.minHoldoutRecords);
  const history = new Map<string, Candidate[]>();
  for (const item of training) history.set(key(item), [...(history.get(key(item)) ?? []), item]);
  return result(heldOut.map((item) => prediction(history.get(key(item)) ?? [], item, settings)), settings.minHoldoutRecords);
}

/** Gate D: calibrate only scored historical predictions; sparse data abstains. */
export function calibrateMssrLearningPredictions(
  predictions: readonly MssrLearningPrediction[],
  minPredictions = 3,
): MssrLearningCalibrationResult {
  const scored = predictions.filter((item) => item.probabilityAccepted !== null);
  if (scored.length < minPredictions) return {
    mode: MSSR_LEARNING_EVALUATION_MODE, routingInfluence: false, status: "abstained",
    abstentionReasons: ["insufficient-scored-predictions"], method: "beta(1,1)-smoothing + Wilson-95", bins: [], meanAbsoluteCalibrationError: null,
  };
  const bins = Array.from({ length: 5 }, (_, index) => {
    const lower = index / 5;
    const upper = (index + 1) / 5;
    const members = scored.filter((item) => item.probabilityAccepted! >= lower && (index === 4 ? item.probabilityAccepted! <= upper : item.probabilityAccepted! < upper));
    const meanPredicted = members.length === 0 ? null : members.reduce((sum, item) => sum + item.probabilityAccepted!, 0) / members.length;
    const observedAcceptance = members.length === 0 ? null : members.filter((item) => item.actual === "accepted").length / members.length;
    return { lower, upper, count: members.length, meanPredicted, observedAcceptance, gap: meanPredicted === null || observedAcceptance === null ? null : observedAcceptance - meanPredicted };
  });
  return {
    mode: MSSR_LEARNING_EVALUATION_MODE, routingInfluence: false, status: "evaluated", abstentionReasons: [],
    method: "beta(1,1)-smoothing + Wilson-95", bins,
    meanAbsoluteCalibrationError: scored.reduce((sum, item) => sum + Math.abs((item.actual === "accepted" ? 1 : 0) - item.probabilityAccepted!), 0) / scored.length,
  };
}

/** Gate E: compute counterfactual suggestions for future traces without execution control. */
export function shadowMssrLearningDecisions(
  records: readonly unknown[],
  options: MssrLearningEvaluationOptions = {},
): MssrLearningShadowResult {
  const settings = config(options);
  const holdout = evaluateMssrLearningHoldout(records, options);
  const allCandidates = records.flatMap((record) => {
    const value = mssrLearningDatasetRecordSchema.safeParse(record);
    return value.success ? [value.data] : [];
  });
  const audit = auditMssrLearningDataset(records, options);
  const total = candidates(allCandidates, audit).length;
  const trainingRecordCount = Math.max(1, Math.floor(total * (1 - settings.holdoutFraction)));
  return {
    mode: MSSR_LEARNING_EVALUATION_MODE,
    routingInfluence: false,
    status: holdout.status,
    abstentionReasons: holdout.abstentionReasons,
    trainingRecordCount: holdout.status === "abstained" ? 0 : trainingRecordCount,
    shadowRecordCount: holdout.predictions.length,
    disagreementsWithExecutedDecision: holdout.predictions.filter((item) => item.suggestion !== "abstain"
      && (item.suggestion === "accept" ? "accepted" : "skipped") !== item.actual).length,
    predictions: holdout.predictions,
    metrics: holdout.metrics,
  };
}

/** Runs gates B--E as a pure, non-mutating evaluation bundle. */
export function evaluateMssrLearningObserveOnly(
  records: readonly unknown[],
  options: MssrLearningEvaluationOptions = {},
): MssrLearningEvaluation {
  const replay = replayMssrLearningDecisions(records, options);
  const holdout = evaluateMssrLearningHoldout(records, options);
  return {
    mode: MSSR_LEARNING_EVALUATION_MODE,
    routingInfluence: false,
    automaticPromotionPerformed: false,
    audit: auditMssrLearningDataset(records, options),
    replay,
    holdout,
    calibration: calibrateMssrLearningPredictions(holdout.predictions),
    shadow: shadowMssrLearningDecisions(records, options),
  };
}
