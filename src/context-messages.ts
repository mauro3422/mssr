import { z } from "zod";
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

/**
 * Portable, bounded context notices for agent hosts.  These carry only
 * summaries and references: callers must never use them for raw prompts,
 * transcripts, credentials, or private reasoning.
 */
export const MSSR_CONTEXT_MESSAGE_KINDS = [
  "continuation",
  "stale-context",
  "related-incident",
  "architecture-decision",
  "recent-changelog",
  "roadmap-contradiction",
  "provider-degraded",
  "unresolved-reference",
  "publication-receipt-stale",
  "context-request",
  "persistence-proposal",
] as const;
export type MssrContextMessageKind = typeof MSSR_CONTEXT_MESSAGE_KINDS[number];

export const MSSR_CONTEXT_MESSAGE_SEVERITIES = ["info", "attention", "warning"] as const;
export type MssrContextMessageSeverity = typeof MSSR_CONTEXT_MESSAGE_SEVERITIES[number];

export const MSSR_CONTEXT_EVIDENCE_KINDS = [
  "architecture-decision",
  "incident",
  "changelog",
  "project-context",
  "project-memory",
  "project-state",
  "trace",
  "verification",
  "publication",
  "other",
] as const;
export type MssrContextEvidenceKind = typeof MSSR_CONTEXT_EVIDENCE_KINDS[number];

export const MSSR_CONTEXT_PROVENANCE = ["project", "host", "provider", "git", "trace", "manual"] as const;
export type MssrContextProvenance = typeof MSSR_CONTEXT_PROVENANCE[number];
export const MSSR_CONTEXT_FRESHNESS = ["fresh", "stale", "unknown", "conflicting", "unavailable"] as const;
export type MssrContextFreshness = typeof MSSR_CONTEXT_FRESHNESS[number];
export const MSSR_CONTEXT_PERSISTENCE_TARGETS = [
  "project-context",
  "project-memory",
  "project-state",
  "architecture-decision",
  "changelog",
  "incident",
  "skill-module",
  "routing-fixture",
] as const;
export type MssrContextPersistenceTarget = typeof MSSR_CONTEXT_PERSISTENCE_TARGETS[number];

export const MSSR_CONTEXT_ADVISORY_ACTIONS = [
  "inspect-reference",
  "load-context",
  "replan",
  "verify-runtime",
  "record-decision",
  "record-incident",
  "refresh-provider",
  "resume-trace",
] as const;
export type MssrContextAdvisoryAction = typeof MSSR_CONTEXT_ADVISORY_ACTIONS[number];

const boundedId = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/);
const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

export const mssrContextEvidenceReferenceSchema = z.object({
  kind: z.enum(MSSR_CONTEXT_EVIDENCE_KINDS),
  ref: z.string().min(1).max(240),
  summary: z.string().min(1).max(300),
  canonicalOwner: z.string().min(1).max(120),
  provenance: z.enum(MSSR_CONTEXT_PROVENANCE),
  freshness: z.enum(MSSR_CONTEXT_FRESHNESS),
  observedAt: z.string().datetime({ offset: true }).optional(),
  revision: z.string().min(1).max(160).optional(),
}).strict().superRefine((value, ctx) => {
  if (!value.observedAt && !value.revision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Evidence requires observedAt or revision." });
  }
});

export const mssrContextPersistenceProposalSchema = z.object({
  target: z.enum(MSSR_CONTEXT_PERSISTENCE_TARGETS),
  summary: z.string().min(1).max(400),
  evidence: z.array(mssrContextEvidenceReferenceSchema).min(1).max(8),
  reviewRequired: z.literal(true),
}).strict();

export const mssrContinuationReceiptSchema = z.object({
  traceId: boundedId.optional(),
  projectRevision: z.string().min(1).max(160).optional(),
  freshness: z.enum(MSSR_CONTEXT_FRESHNESS).default("unknown"),
  unresolvedRefs: z.array(z.string().min(1).max(240)).max(12).default([]),
  sourceReceipts: z.array(mssrContextEvidenceReferenceSchema).max(8).default([]),
  currentStage: z.enum(SKILL_STAGES),
  completedPhases: z.array(z.enum(["discovery", "safety", "implementation", "verification", "persistence", "maintenance"])).max(6).default([]),
  nextGate: z.string().min(1).max(240),
  summary: z.string().min(1).max(400),
}).strict();

export const mssrContextMessageSchema = z.object({
  id: boundedId,
  kind: z.enum(MSSR_CONTEXT_MESSAGE_KINDS),
  severity: z.enum(MSSR_CONTEXT_MESSAGE_SEVERITIES).default("info"),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  evidence: z.array(mssrContextEvidenceReferenceSchema).max(8).default([]),
  advisoryActions: z.array(z.enum(MSSR_CONTEXT_ADVISORY_ACTIONS)).max(4).default([]),
  continuation: mssrContinuationReceiptSchema.optional(),
  persistenceProposal: mssrContextPersistenceProposalSchema.optional(),
  ...selectorFields,
  required: z.boolean().default(false),
  priority: z.number().int().min(-100).max(100).default(0),
  dedupeKey: boundedId.optional(),
  estimatedChars: z.number().int().min(40).max(2_000).default(320),
}).strict();

export type MssrContextEvidenceReference = z.infer<typeof mssrContextEvidenceReferenceSchema>;
export type MssrContinuationReceipt = z.infer<typeof mssrContinuationReceiptSchema>;
export type MssrContextPersistenceProposal = z.infer<typeof mssrContextPersistenceProposalSchema>;
export type MssrContextMessage = z.infer<typeof mssrContextMessageSchema>;
export const mssrContextMessageBatchSchema = z.array(mssrContextMessageSchema).max(32);

export type MssrContextMessageDecisionReason =
  | "selected"
  | "stage-mismatch"
  | "intent-mismatch"
  | "deduplicated"
  | "budget-exceeded"
  | "max-messages-exceeded"
  | "required-message-overflow";

export type MssrContextMessageDecision = {
  id: string;
  selected: boolean;
  score: number;
  estimatedChars: number;
  reason: MssrContextMessageDecisionReason;
  matched: string[];
};

export type MssrContextMessageSelection = {
  selected: MssrContextMessage[];
  decisions: MssrContextMessageDecision[];
  continuationReceipts: MssrContinuationReceipt[];
  selectedChars: number;
  remainingChars: number;
  remainingMessages: number;
  requiredBudgetExceeded: boolean;
  requiredMessageOverflow: string[];
  advisoryOnly: true;
};

function overlap(left: readonly string[], right: readonly string[]): string[] {
  const wanted = new Set(right);
  return left.filter((value) => wanted.has(value));
}

function effectiveMessageChars(message: MssrContextMessage): number {
  // estimatedChars is an advisory lower bound, never permission to under-budget
  // the exact structured message that will be serialized into a host response.
  return Math.max(message.estimatedChars, JSON.stringify(message).length);
}

function evaluateMessage(message: MssrContextMessage, intent: StructuredSkillIntent, stage: SkillStage) {
  const chars = effectiveMessageChars(message);
  if (message.stages.length > 0 && !message.stages.includes(stage)) {
    return { message, chars, eligible: false, score: -1, matched: [] as string[], reason: "stage-mismatch" as const };
  }

  const dimensions = [
    ["domain", message.domains, intent.domains],
    ["action", message.actions, intent.actions],
    ["artifact", message.artifacts, intent.artifacts],
    ["need", message.needs, intent.needs],
    ["signal", message.signals, intent.signals],
  ] as const;
  const weights: Record<string, number> = { domain: 8, action: 10, artifact: 10, need: 12, signal: 14 };
  let hasSelector = false;
  let allSpecifiedMatch = true;
  let score = message.priority;
  const matched: string[] = [];

  for (const [label, expected, actual] of dimensions) {
    if (expected.length === 0) continue;
    hasSelector = true;
    const hits = overlap(actual, expected);
    if (hits.length === 0) allSpecifiedMatch = false;
    for (const hit of hits) matched.push(`${label}:${hit}`);
    score += hits.length * weights[label];
  }

  const eligible = message.required || (hasSelector && allSpecifiedMatch);
  return { message, chars, eligible, score, matched, reason: eligible ? "selected" as const : "intent-mismatch" as const };
}

/**
 * Selects the smallest relevant set of contextual notices.  The result is
 * advisory data only; it cannot grant tool permissions or trigger I/O.
 */
export function selectMssrContextMessages(args: {
  messages: MssrContextMessage[];
  intent: StructuredSkillIntent;
  stage: SkillStage;
  maxMessages?: number;
  maxChars?: number;
}): MssrContextMessageSelection {
  // The batch schema is the contract-wide hard cap; caller budgets can only
  // narrow it and never permit an unbounded notice queue.
  const messages = mssrContextMessageBatchSchema.parse(args.messages);
  const maxMessages = Math.max(0, Math.min(32, Math.floor(args.maxMessages ?? 12)));
  const maxChars = Math.max(0, Math.min(20_000, Math.floor(args.maxChars ?? 6_000)));
  const evaluated = messages.map((message) => evaluateMessage(message, args.intent, args.stage));
  const ranked = evaluated.filter((item) => item.eligible).sort((left, right) =>
    Number(right.message.required) - Number(left.message.required)
    || right.score - left.score
    || right.message.priority - left.message.priority
    || left.message.id.localeCompare(right.message.id));

  const selectedIds = new Set<string>();
  const selectedDedupeKeys = new Set<string>();
  const reasons = new Map<string, MssrContextMessageDecisionReason>();
  const selected: MssrContextMessage[] = [];
  let remainingChars = maxChars;
  let selectedChars = 0;
  let requiredBudgetExceeded = false;
  const requiredMessageOverflow: string[] = [];

  for (const item of ranked) {
    const dedupeKey = item.message.dedupeKey ?? item.message.id;
    if (selectedDedupeKeys.has(dedupeKey)) {
      reasons.set(item.message.id, "deduplicated");
      continue;
    }
    const exceedsHardMessageCap = selected.length >= 32;
    const exceedsHardCharCap = item.chars > Math.max(0, 20_000 - selectedChars);
    if (item.message.required && (exceedsHardMessageCap || exceedsHardCharCap)) {
      reasons.set(item.message.id, "required-message-overflow");
      requiredMessageOverflow.push(item.message.id);
      continue;
    }
    if (!item.message.required && selected.length >= maxMessages) {
      reasons.set(item.message.id, "max-messages-exceeded");
      continue;
    }
    if (!item.message.required && item.chars > remainingChars) {
      reasons.set(item.message.id, "budget-exceeded");
      continue;
    }
    if (item.message.required && (selected.length >= maxMessages || item.chars > remainingChars)) requiredBudgetExceeded = true;
    selected.push(item.message);
    selectedIds.add(item.message.id);
    selectedDedupeKeys.add(dedupeKey);
    remainingChars -= item.chars;
    selectedChars += item.chars;
  }

  return {
    selected,
    decisions: evaluated.map((item): MssrContextMessageDecision => ({
      id: item.message.id,
      selected: selectedIds.has(item.message.id),
      score: item.score,
      estimatedChars: item.chars,
      reason: selectedIds.has(item.message.id) ? "selected" : reasons.get(item.message.id) ?? item.reason,
      matched: item.matched,
    })),
    continuationReceipts: selected.flatMap((message) => message.continuation ? [message.continuation] : []),
    selectedChars,
    remainingChars: Math.max(0, remainingChars),
    remainingMessages: Math.max(0, maxMessages - selected.length),
    requiredBudgetExceeded,
    requiredMessageOverflow,
    advisoryOnly: true,
  };
}
