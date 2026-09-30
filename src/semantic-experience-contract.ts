import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mssrExplicitVerifierIdentitySchema } from "./explicit-verification.js";

import {
  MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS,
  createMssrSemanticExperienceObservation,
  mssrSemanticExperienceEvidenceUnitSchema,
  mssrSemanticExperienceFeatureSchema,
  mssrSemanticExperienceProposalSchema,
} from "./semantic-experience.js";
import {
  appendMssrSemanticExperienceObservations,
  applyMssrSemanticExperienceFeedback,
  classifyAndObserveMssrSemanticExperienceFromStore,
  summarizeMssrSemanticExperienceLearning,
} from "./semantic-experience-store.js";
import {
  mssrSemanticTraceProjectionSchema,
  projectMssrSemanticTraceLearning,
} from "./semantic-curation-distillation.js";
import { mssrLearningDigestSchema } from "./learning.js";
import { persistMssrLearningDigestSemanticExperiences } from "./semantic-experience-learning.js";

export const MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES = [
  "mssr_semantic_experience_observe",
  "mssr_semantic_experience_status",
  "mssr_semantic_experience_feedback",
  "mssr_semantic_experience_fallback",
  "mssr_semantic_experience_trace_link",
] as const;

const traceIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/);
const workflowKeySchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const projectKeySchema = z.string().trim().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
const boundedValue = z.string().trim().min(1).max(120).refine((value) => !/[\r\n]/.test(value));
const boundedRef = z.string().trim().min(1).max(240).refine((value) => !/[\r\n]/.test(value));

export const mssrSemanticExperienceObserveInputSchema = z.object({
  projectKey: projectKeySchema,
  decisionKind: z.enum(MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS),
  feature: mssrSemanticExperienceFeatureSchema,
  evidenceUnits: z.array(mssrSemanticExperienceEvidenceUnitSchema).max(24).default([]),
  proposal: mssrSemanticExperienceProposalSchema,
  traceId: traceIdSchema.optional(),
  workflowKey: workflowKeySchema.optional(),
}).strict();

export const mssrSemanticExperienceStatusInputSchema = z.object({
  maxRules: z.number().int().min(0).max(100).default(20),
}).strict();

export const mssrSemanticExperienceFeedbackInputSchema = z.object({
  observationId: z.string().regex(/^semantic-experience:[0-9a-f]{24}$/),
  status: z.enum(["confirmed", "corrected", "rejected"]),
  value: boundedValue.optional(),
  evidenceRef: boundedRef,
  evidenceRevision: boundedRef.optional(),
  verificationId: z.string().regex(/^[A-Za-z0-9._:-]{6,200}$/),
  verifier: mssrExplicitVerifierIdentitySchema,
  trace: mssrSemanticTraceProjectionSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "corrected" && !value.value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Corrected semantic experience feedback requires value." });
  }
});

export const mssrSemanticExperienceFallbackInputSchema = z.object({
  decisionKind: z.enum(MSSR_SEMANTIC_EXPERIENCE_DECISION_KINDS),
  feature: mssrSemanticExperienceFeatureSchema,
  projectKey: projectKeySchema.default("semantic-experience-fallback"),
  traceId: traceIdSchema.optional(),
  workflowKey: workflowKeySchema.optional(),
}).strict();

export const mssrSemanticExperienceTraceLinkInputSchema = z.object({
  traceId: traceIdSchema,
  workflowKey: workflowKeySchema.optional(),
  projectKey: projectKeySchema.optional(),
  digest: mssrLearningDigestSchema,
  evidenceRefs: z.array(boundedRef).max(12).default([]),
}).strict();

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

export function registerMssrSemanticExperienceTools(server: McpServer): void {
  server.registerTool(MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES[0], {
    description: "Record one bounded Shef/Jev semantic decision as a shadow experience. Stores only compact features/provenance and provider proposal; raw provider output is not training truth and no canonical authority is changed.",
    inputSchema: mssrSemanticExperienceObserveInputSchema,
  }, async ({ projectKey, decisionKind, feature, evidenceUnits, proposal, traceId, workflowKey }) => {
    const trace = traceId ? mssrSemanticTraceProjectionSchema.parse({ traceId, ...(workflowKey ? { workflowKey } : {}) }) : undefined;
    const observation = createMssrSemanticExperienceObservation({
      projectKey,
      decisionKind,
      feature,
      evidenceUnits,
      proposal,
      ...(trace ? { trace } : {}),
    });
    const stored = await appendMssrSemanticExperienceObservations({ observations: [observation] });
    return response({
      observationId: observation.id,
      decisionKind: observation.decisionKind,
      featureSignature: observation.featureSignature,
      proposal: observation.proposal,
      verification: observation.verification,
      traceAttached: Boolean(observation.trace),
      added: stored.added,
      total: stored.total,
      rawSourceTextStored: false,
      rawProviderIsTrainingTruth: false,
      advisoryOnly: true,
      authorityInfluence: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    });
  });

  server.registerTool(MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES[1], {
    description: "Inspect the bounded Semantic Experience learning capsule: counts by decision kind and a capped set of independently verified distilled rules. Never loads raw traces/source text.",
    inputSchema: mssrSemanticExperienceStatusInputSchema,
  }, async ({ maxRules }) => response(await summarizeMssrSemanticExperienceLearning({ maxRules })));

  server.registerTool(MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES[2], {
    description: "Attach explicitly independent confirmation/correction/rejection to one semantic experience. Verifier/provider/trace provenance is checked before confirmed/corrected feedback can become fallback training evidence; this never applies a learned decision to project authority.",
    inputSchema: mssrSemanticExperienceFeedbackInputSchema,
  }, async ({ observationId, status, value, evidenceRef, evidenceRevision, verificationId, verifier, trace }) => {
    const result = await applyMssrSemanticExperienceFeedback({
      observationId,
      status,
      ...(value ? { value } : {}),
      evidenceRef,
      ...(evidenceRevision ? { evidenceRevision } : {}),
      verificationId,
      verifier,
      ...(trace ? { trace } : {}),
    });
    const learning = await summarizeMssrSemanticExperienceLearning({ maxRules: 20 });
    return response({
      updated: result.updated,
      observationId: result.observation.id,
      decisionKind: result.observation.decisionKind,
      proposal: result.observation.proposal ?? null,
      verification: result.observation.verification,
      traceAttached: Boolean(result.observation.trace),
      learning,
      advisoryOnly: true,
      authorityInfluence: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    });
  });

  server.registerTool(MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES[3], {
    description: "Ask the offline deterministic Semantic Experience fallback for one decision kind. It returns a verified distilled rule when available and otherwise abstains. Abstentions are recorded as trace-linked shadow experience when trace identity is available; output remains advisory and cannot auto-apply or choose canonical authority.",
    inputSchema: mssrSemanticExperienceFallbackInputSchema,
  }, async ({ decisionKind, feature, projectKey, traceId, workflowKey }) => {
    const trace = traceId ? mssrSemanticTraceProjectionSchema.parse({ traceId, ...(workflowKey ? { workflowKey } : {}) }) : undefined;
    const result = await classifyAndObserveMssrSemanticExperienceFromStore({
      decisionKind,
      feature,
      projectKey,
      ...(trace ? { trace } : {}),
    });
    return response({
      ...result.decision,
      abstentionRecorded: result.abstentionRecorded,
      observationId: result.observationId,
    });
  });

  server.registerTool(MSSR_SEMANTIC_EXPERIENCE_TOOL_NAMES[4], {
    description: "Hydrate Semantic Experience shadows associated with one MSSR trace using only its strict privacy-safe learning digest projection. Trace outcome metadata calibrates observations but never confirms their semantic decision.",
    inputSchema: mssrSemanticExperienceTraceLinkInputSchema,
  }, async ({ traceId, workflowKey, projectKey, digest, evidenceRefs }) => {
    const trace = projectMssrSemanticTraceLearning({ traceId, ...(workflowKey ? { workflowKey } : {}), digest, evidenceRefs });
    const linked = await persistMssrLearningDigestSemanticExperiences({
      traceId,
      ...(workflowKey ? { workflowKey } : {}),
      projectKey: projectKey ?? workflowKey ?? `trace:${traceId}`,
      digest,
      evidenceRefs,
    });
    return response({
      ...linked,
      trace: {
        traceId: trace.traceId,
        workflowKey: trace.workflowKey,
        finalStage: trace.finalStage,
        outcomeStatus: trace.outcomeStatus,
        accepted: trace.accepted,
        verificationPassed: trace.verificationPassed,
        persisted: trace.persisted,
        userCorrections: trace.userCorrections,
        evidenceRefCount: trace.evidenceRefHashes.length,
      },
      verificationStateChanged: false,
      rawTraceLoaded: false,
      rawSourceTextStored: false,
      advisoryOnly: true,
      authorityInfluence: false,
      routingInfluence: false,
      canonicalRewriteAllowed: false,
      autoApplyAllowed: false,
    });
  });
}
