import { createHash } from "node:crypto";
import { z } from "zod";

export const MSSR_SEMANTIC_CURATION_SCHEMA_VERSION = 1 as const;
export const MSSR_SEMANTIC_CURATION_MAX_HEADS = 64 as const;

export const MSSR_SEMANTIC_CURATION_ROLES = [
  "current-state",
  "durable-decision",
  "architecture",
  "procedure",
  "history",
  "noise",
] as const;
export type MssrSemanticCurationRole = typeof MSSR_SEMANTIC_CURATION_ROLES[number];

export const MSSR_SEMANTIC_CURATION_DESTINATIONS = [
  "state",
  "memory",
  "knowledge-ref",
  "context",
  "drop",
] as const;
export type MssrSemanticCurationDestination = typeof MSSR_SEMANTIC_CURATION_DESTINATIONS[number];

export const MSSR_SEMANTIC_CURATION_RELATIONS = [
  "duplicate",
  "supports",
  "supersedes",
  "contradicts",
  "unrelated",
] as const;
export type MssrSemanticCurationRelation = typeof MSSR_SEMANTIC_CURATION_RELATIONS[number];

export const MSSR_SEMANTIC_CURATION_CONNECTORS = [
  "none",
  "moreover",
  "therefore",
  "however",
  "specifically",
] as const;
export type MssrSemanticCurationConnector = typeof MSSR_SEMANTIC_CURATION_CONNECTORS[number];

export const MSSR_SEMANTIC_CURATION_VALIDITIES = ["current", "historical", "superseded", "unknown"] as const;
export type MssrSemanticCurationValidity = typeof MSSR_SEMANTIC_CURATION_VALIDITIES[number];

const idSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,119}$/);
const boundedRefSchema = z.string().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
const boundedTopicSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
const probabilitySchema = z.number().min(0).max(1);

export function hashSemanticCurationText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const mssrSemanticCurationBlockSchema = z.object({
  id: idSchema,
  text: z.string().min(1).max(24_000),
  sourceRef: boundedRefSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
  protected: z.boolean().default(false),
  validity: z.enum(MSSR_SEMANTIC_CURATION_VALIDITIES).default("unknown"),
  topicCandidates: z.array(boundedTopicSchema).min(1).max(24).default(["reference"]),
}).strict().superRefine((value, ctx) => {
  if (value.startLine !== undefined && value.endLine !== undefined && value.endLine < value.startLine) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Semantic curation block endLine must be >= startLine." });
  }
  if (hashSemanticCurationText(value.text) !== value.sha256) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sha256"], message: "Semantic curation block sha256 must match exact text bytes." });
  }
});

const choiceJudgment = <T extends readonly [string, ...string[]]>(values: T) => z.object({
  value: z.enum(values),
  confidence: probabilitySchema,
}).strict();

export const mssrSemanticCurationBlockJudgmentSchema = z.object({
  blockId: idSchema,
  role: choiceJudgment(MSSR_SEMANTIC_CURATION_ROLES),
  destination: choiceJudgment(MSSR_SEMANTIC_CURATION_DESTINATIONS),
  protectedProbability: probabilitySchema,
  topic: z.object({ value: boundedTopicSchema, confidence: probabilitySchema }).strict(),
}).strict();

export const mssrSemanticCurationPairJudgmentSchema = z.object({
  leftId: idSchema,
  rightId: idSchema,
  relation: choiceJudgment(MSSR_SEMANTIC_CURATION_RELATIONS),
  continuationProbability: probabilitySchema.optional(),
  connector: choiceJudgment(MSSR_SEMANTIC_CURATION_CONNECTORS).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.leftId === value.rightId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Semantic curation pair endpoints must differ." });
});

export const mssrSemanticCurationPairCandidateSchema = z.object({
  leftId: idSchema,
  rightId: idSchema,
}).strict().superRefine((value, ctx) => {
  if (value.leftId === value.rightId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Semantic curation pair candidates must differ." });
});

export type MssrSemanticCurationPairCandidate = z.infer<typeof mssrSemanticCurationPairCandidateSchema>;

export const mssrSemanticCurationProviderResultSchema = z.object({
  schemaVersion: z.literal(MSSR_SEMANTIC_CURATION_SCHEMA_VERSION),
  provider: z.string().min(1).max(120),
  modelId: z.string().min(1).max(120),
  modelRevision: z.string().min(1).max(120).optional(),
  blockJudgments: z.array(mssrSemanticCurationBlockJudgmentSchema).max(256),
  pairJudgments: z.array(mssrSemanticCurationPairJudgmentSchema).max(256).default([]),
}).strict();

export type MssrSemanticCurationBlockInput = z.input<typeof mssrSemanticCurationBlockSchema>;
export type MssrSemanticCurationBlock = z.output<typeof mssrSemanticCurationBlockSchema>;
export type MssrSemanticCurationProviderResult = z.output<typeof mssrSemanticCurationProviderResultSchema>;

export interface MssrSemanticCuratorProvider {
  curate(input: {
    goal: string;
    blocks: readonly MssrSemanticCurationBlock[];
    pairCandidates: readonly { leftId: string; rightId: string }[];
  }): Promise<MssrSemanticCurationProviderResult>;
}

export type MssrSemanticCurationReviewReason =
  | "missing-block-judgment"
  | "unknown-topic"
  | "low-role-confidence"
  | "low-destination-confidence"
  | "low-topic-confidence"
  | "model-protected-signal"
  | "protected-drop-conflict"
  | "historical-drop-conflict"
  | "low-relation-confidence"
  | "pair-not-offered"
  | "contradiction-candidate";

export type MssrSemanticCurationBlockDecision = {
  blockId: string;
  destination: MssrSemanticCurationDestination | "review";
  topic: string | null;
  protected: boolean;
  exactTextPreserved: true;
  automaticDropAllowed: boolean;
  reviewReasons: MssrSemanticCurationReviewReason[];
};

export type MssrSemanticCurationPairDecision = {
  leftId: string;
  rightId: string;
  relation: MssrSemanticCurationRelation;
  accepted: boolean;
  connector: MssrSemanticCurationConnector;
  reviewReasons: MssrSemanticCurationReviewReason[];
};

export type MssrSemanticCurationEvaluation = {
  blocks: MssrSemanticCurationBlockDecision[];
  pairs: MssrSemanticCurationPairDecision[];
  reviewRequired: boolean;
  advisoryOnly: true;
  canonicalRewriteAllowed: false;
  exactTextMutationAllowed: false;
};

export function evaluateMssrSemanticCuration(args: {
  blocks: readonly MssrSemanticCurationBlockInput[];
  result: unknown;
  pairCandidates?: readonly MssrSemanticCurationPairCandidate[];
  roleConfidence?: number;
  destinationConfidence?: number;
  topicConfidence?: number;
  relationConfidence?: number;
  protectedProbability?: number;
}): MssrSemanticCurationEvaluation {
  const blocks = args.blocks.map((block) => mssrSemanticCurationBlockSchema.parse(block));
  const result = mssrSemanticCurationProviderResultSchema.parse(args.result);
  const roleConfidence = args.roleConfidence ?? 0.7;
  const destinationConfidence = args.destinationConfidence ?? 0.72;
  const topicConfidence = args.topicConfidence ?? 0.7;
  const relationConfidence = args.relationConfidence ?? 0.75;
  const protectedProbability = args.protectedProbability ?? 0.8;
  const judgments = new Map(result.blockJudgments.map((judgment) => [judgment.blockId, judgment]));
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const pairCandidates = (args.pairCandidates ?? []).map((pair) => mssrSemanticCurationPairCandidateSchema.parse(pair));
  const offeredPairs = new Set(pairCandidates.map((pair) => `${pair.leftId}\u0000${pair.rightId}`));
  if (new Set(pairCandidates.map((pair) => `${pair.leftId}\u0000${pair.rightId}`)).size !== pairCandidates.length) {
    throw new Error("Semantic curation pair candidates must be unique.");
  }
  if (pairCandidates.some((pair) => !blockById.has(pair.leftId) || !blockById.has(pair.rightId))) {
    throw new Error("Semantic curation pair candidates must reference supplied blocks.");
  }

  const blockDecisions = blocks.map((block): MssrSemanticCurationBlockDecision => {
    const judgment = judgments.get(block.id);
    const reasons: MssrSemanticCurationReviewReason[] = [];
    if (!judgment) {
      return {
        blockId: block.id,
        destination: "review",
        topic: null,
        protected: block.protected,
        exactTextPreserved: true,
        automaticDropAllowed: false,
        reviewReasons: ["missing-block-judgment"],
      };
    }
    const topicKnown = block.topicCandidates.includes(judgment.topic.value);
    if (!topicKnown) reasons.push("unknown-topic");
    if (judgment.role.confidence < roleConfidence) reasons.push("low-role-confidence");
    if (judgment.destination.confidence < destinationConfidence) reasons.push("low-destination-confidence");
    if (judgment.topic.confidence < topicConfidence) reasons.push("low-topic-confidence");
    const modelProtected = judgment.protectedProbability >= protectedProbability;
    if (modelProtected && !block.protected) reasons.push("model-protected-signal");
    const effectiveProtected = block.protected || modelProtected;
    if (effectiveProtected && judgment.destination.value === "drop") reasons.push("protected-drop-conflict");
    if ((block.validity === "historical" || block.validity === "superseded") && judgment.destination.value === "drop") reasons.push("historical-drop-conflict");
    const automaticDropAllowed = judgment.destination.value === "drop"
      && !effectiveProtected
      && judgment.role.value === "noise"
      && judgment.role.confidence >= 0.85
      && judgment.destination.confidence >= 0.85;
    const destination = reasons.length > 0 && !automaticDropAllowed ? "review" : judgment.destination.value;
    return {
      blockId: block.id,
      destination,
      topic: topicKnown ? judgment.topic.value : null,
      protected: effectiveProtected,
      exactTextPreserved: true,
      automaticDropAllowed,
      reviewReasons: reasons,
    };
  });

  const pairDecisions = result.pairJudgments.map((judgment): MssrSemanticCurationPairDecision => {
    if (!blockById.has(judgment.leftId) || !blockById.has(judgment.rightId)) {
      throw new Error("Semantic curation pair judgments must reference supplied blocks.");
    }
    const reasons: MssrSemanticCurationReviewReason[] = [];
    if (!offeredPairs.has(`${judgment.leftId}\u0000${judgment.rightId}`)) reasons.push("pair-not-offered");
    if (judgment.relation.confidence < relationConfidence) reasons.push("low-relation-confidence");
    if (judgment.relation.value === "contradicts") reasons.push("contradiction-candidate");
    const connector = judgment.connector && judgment.connector.confidence >= relationConfidence
      ? judgment.connector.value
      : "none";
    return {
      leftId: judgment.leftId,
      rightId: judgment.rightId,
      relation: judgment.relation.value,
      accepted: reasons.length === 0,
      connector,
      reviewReasons: reasons,
    };
  });

  return {
    blocks: blockDecisions,
    pairs: pairDecisions,
    reviewRequired: blockDecisions.some((decision) => decision.destination === "review") || pairDecisions.some((decision) => decision.reviewReasons.length > 0),
    advisoryOnly: true,
    canonicalRewriteAllowed: false,
    exactTextMutationAllowed: false,
  };
}

const connectorText: Record<MssrSemanticCurationConnector, string> = {
  none: "",
  moreover: "Additionally,",
  therefore: "Therefore,",
  however: "However,",
  specifically: "Specifically,",
};

export function assembleMssrSemanticReferenceProposals(args: {
  blocks: readonly MssrSemanticCurationBlockInput[];
  evaluation: MssrSemanticCurationEvaluation;
}): Array<{ topic: string; blockIds: string[]; markdown: string; exactSourceTextOnly: boolean }> {
  const blocks = args.blocks.map((block) => mssrSemanticCurationBlockSchema.parse(block));
  const decisionById = new Map(args.evaluation.blocks.map((decision) => [decision.blockId, decision]));
  const pairByKey = new Map(args.evaluation.pairs.map((pair) => [`${pair.leftId}:${pair.rightId}`, pair]));
  const groups = new Map<string, MssrSemanticCurationBlock[]>();
  for (const block of blocks) {
    const decision = decisionById.get(block.id);
    if (!decision || decision.destination !== "knowledge-ref" || !decision.topic) continue;
    const group = groups.get(decision.topic) ?? [];
    group.push(block);
    groups.set(decision.topic, group);
  }

  return [...groups.entries()].map(([topic, group]) => {
    const pieces: string[] = [];
    for (let index = 0; index < group.length; index += 1) {
      const block = group[index];
      if (index > 0) {
        const pair = pairByKey.get(`${group[index - 1].id}:${block.id}`);
        if (pair?.accepted && pair.connector !== "none") pieces.push(connectorText[pair.connector]);
      }
      pieces.push(block.text);
    }
    return {
      topic,
      blockIds: group.map((block) => block.id),
      markdown: `# ${topic}\n\n${pieces.join("\n\n")}\n`,
      exactSourceTextOnly: pieces.every((piece) => !Object.values(connectorText).includes(piece) || piece === ""),
    };
  });
}
