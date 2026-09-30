import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  enqueueMssrOwnedSkillCurationCandidates,
  enqueueMssrProjectContextCurationCandidates,
} from "./semantic-curation-enqueue.js";
import {
  defaultMssrSemanticCurationQueuePath,
  defaultMssrSemanticCurationReviewRoot,
  processMssrSemanticCurationQueue,
  readMssrSemanticCurationQueue,
} from "./semantic-curation-queue-store.js";
import {
  applyMssrProjectContextReferencePlan,
  planMssrProjectContextReferenceSplit,
} from "./project-context-semantic-curation.js";
import {
  buildMssrProjectEvidenceGraph,
  reviewMssrProjectEvidenceGraph,
  reviewMssrProjectEvidenceGraphDeterministically,
  summarizeMssrProjectEvidenceGraph,
} from "./semantic-curation-evidence-graph.js";
import {
  applyMssrSemanticDistillationFeedback,
  attachMssrSemanticDistillationTrace,
  summarizeMssrSemanticDistillationLearning,
} from "./semantic-curation-distillation-store.js";
import {
  mssrSemanticTraceProjectionSchema,
  projectMssrSemanticTraceLearning,
} from "./semantic-curation-distillation.js";
import { MSSR_SEMANTIC_CURATION_RELATIONS } from "./semantic-curation.js";
import { mssrLearningDigestSchema } from "./learning.js";
import { registerMssrSemanticExperienceTools } from "./semantic-experience-contract.js";
import { MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES, registerMssrSemanticEvidenceTools } from "./semantic-evidence-mcp.js";
import type { MssrSemanticEvidenceToolOptions } from "./semantic-evidence-mcp.js";

export const MSSR_SEMANTIC_CURATION_TOOL_NAMES = [
  "mssr_semantic_curation_status",
  "mssr_semantic_curation_enqueue",
  "mssr_semantic_curation_process",
  "mssr_project_context_ref_split_plan",
  "mssr_project_context_ref_split_apply",
  "mssr_semantic_curation_evidence_graph",
  "mssr_semantic_curation_project_review",
  "mssr_semantic_curation_learning_status",
  "mssr_semantic_curation_learning_feedback",
  "mssr_semantic_curation_fallback_review",
  "mssr_semantic_curation_learning_trace_link",
  ...MSSR_SEMANTIC_EVIDENCE_TOOL_NAMES,
] as const;

const projectRootSchema = z.string().min(1).max(4096);
const traceIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/);
const workflowKeySchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);

export const mssrSemanticCurationStatusInputSchema = z.object({
  maxEntries: z.number().int().min(0).max(200).default(50),
}).strict();

export const mssrSemanticCurationEnqueueInputSchema = z.object({
  projectRoots: z.array(projectRootSchema).max(64).default([]),
  skillRoots: z.array(projectRootSchema).max(32).default([]),
  includeWatch: z.boolean().default(false),
}).strict().refine((value) => value.projectRoots.length > 0 || value.skillRoots.length > 0, {
  message: "Provide at least one projectRoot or skillRoot to scan for semantic curation candidates.",
});

export const mssrSemanticCurationProcessInputSchema = z.object({
  maxEntries: z.number().int().min(1).max(100).default(12),
  concurrency: z.number().int().min(1).max(16).default(4),
  maxHeadsPerRequest: z.number().int().min(1).max(64).default(64),
  maxStateChars: z.number().int().min(1_000).max(262_144).default(24_000),
  model: z.string().min(1).max(120).optional(),
}).strict();

export const mssrSemanticCurationEvidenceGraphInputSchema = z.object({
  projectRoot: projectRootSchema,
  maxSources: z.number().int().min(1).max(128).default(64),
  maxBlocks: z.number().int().min(2).max(1024).default(384),
  maxPairs: z.number().int().min(0).max(64).default(24),
  minScore: z.number().min(0).max(1).default(0.24),
}).strict();

export const mssrSemanticCurationProjectReviewInputSchema = z.object({
  projectRoot: projectRootSchema,
  maxSources: z.number().int().min(1).max(128).default(64),
  maxBlocks: z.number().int().min(2).max(1024).default(384),
  maxPairs: z.number().int().min(1).max(32).default(12),
  minScore: z.number().min(0).max(1).default(0.24),
  concurrency: z.number().int().min(1).max(16).default(4),
  maxHeadsPerRequest: z.number().int().min(1).max(64).default(64),
  maxStateChars: z.number().int().min(1_000).max(262_144).default(24_000),
  model: z.string().min(1).max(120).optional(),
  persist: z.boolean().default(true),
  mode: z.enum(["auto", "jev", "deterministic"]).default("auto"),
  detail: z.enum(["summary", "full"]).default("summary"),
  traceId: traceIdSchema.optional(),
  workflowKey: workflowKeySchema.optional(),
}).strict();

export const mssrSemanticCurationLearningStatusInputSchema = z.object({
  maxRules: z.number().int().min(0).max(100).default(20),
}).strict();

export const mssrSemanticCurationLearningFeedbackInputSchema = z.object({
  observationId: z.string().regex(/^semantic-observation:[0-9a-f]{24}$/),
  status: z.enum(["confirmed", "corrected", "rejected"]),
  relation: z.enum(MSSR_SEMANTIC_CURATION_RELATIONS).optional(),
  evidenceRef: z.string().min(1).max(240).refine((value) => !/[\r\n]/.test(value)),
  trace: mssrSemanticTraceProjectionSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.status === "corrected" && !value.relation) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["relation"], message: "Corrected semantic feedback requires relation." });
  }
});

export const mssrSemanticCurationFallbackReviewInputSchema = z.object({
  projectRoot: projectRootSchema,
  maxSources: z.number().int().min(1).max(128).default(64),
  maxBlocks: z.number().int().min(2).max(1024).default(384),
  maxPairs: z.number().int().min(1).max(32).default(12),
  minScore: z.number().min(0).max(1).default(0.24),
  detail: z.enum(["summary", "full"]).default("summary"),
}).strict();

export const mssrSemanticCurationLearningTraceLinkInputSchema = z.object({
  traceId: traceIdSchema,
  workflowKey: workflowKeySchema.optional(),
  digest: mssrLearningDigestSchema,
  evidenceRefs: z.array(z.string().min(1).max(240).refine((value) => !/[\r\n]/.test(value))).max(12).default([]),
}).strict();

export const mssrProjectContextRefSplitPlanInputSchema = z.object({
  projectRoot: projectRootSchema,
  moduleId: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  model: z.string().min(1).max(120).optional(),
  traceId: traceIdSchema.optional(),
  workflowKey: workflowKeySchema.optional(),
}).strict();

export const mssrProjectContextRefSplitApplyInputSchema = z.object({
  planId: z.string().regex(/^mssr-ref-plan:[0-9a-f]{24}$/),
  confirmPlanId: z.string().regex(/^mssr-ref-plan:[0-9a-f]{24}$/),
}).strict();


function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function summarizeQueue(entries: Awaited<ReturnType<typeof readMssrSemanticCurationQueue>>["entries"], maxEntries: number) {
  const byProject = new Map<string, number>();
  const byReason = new Map<string, number>();
  for (const entry of entries) {
    byProject.set(entry.projectRoot, (byProject.get(entry.projectRoot) ?? 0) + 1);
    for (const reason of entry.reasons) byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
  }
  return {
    queuePath: defaultMssrSemanticCurationQueuePath(),
    reviewRoot: defaultMssrSemanticCurationReviewRoot(),
    pendingCount: entries.length,
    projects: [...byProject.entries()].map(([projectRoot, count]) => ({ projectRoot, count })).sort((a, b) => b.count - a.count || a.projectRoot.localeCompare(b.projectRoot)),
    reasons: [...byReason.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    entries: entries.slice(0, maxEntries).map((entry) => ({
      id: entry.id,
      projectRoot: entry.projectRoot,
      sourceRef: entry.sourceRef,
      reasons: entry.reasons,
      priority: entry.priority,
      queuedAt: entry.queuedAt,
      attempts: entry.attempts,
      ...(entry.lastAttemptAt ? { lastAttemptAt: entry.lastAttemptAt } : {}),
      ...(entry.lastError ? { lastError: entry.lastError } : {}),
    })),
    truncated: entries.length > maxEntries,
    advisoryOnly: true,
  };
}

function compactJevReview(result: Awaited<ReturnType<typeof reviewMssrProjectEvidenceGraph>>) {
  const judgments = result.run.results.flatMap((item) => item.providerResult.pairJudgments.map((pair) => ({
    jobId: item.jobId,
    leftId: pair.leftId,
    rightId: pair.rightId,
    relation: pair.relation.value,
    confidence: pair.relation.confidence,
    accepted: item.evaluation.pairs.find((decision) => decision.leftId === pair.leftId && decision.rightId === pair.rightId)?.accepted ?? false,
  })));
  const relationCounts = new Map<string, number>();
  for (const judgment of judgments) relationCounts.set(judgment.relation, (relationCounts.get(judgment.relation) ?? 0) + 1);
  return {
    mode: "jev" as const,
    projectRoot: result.graph.projectRoot,
    sources: result.graph.sources.length,
    nodes: result.graph.nodes.length,
    edges: result.graph.edges.length,
    jobs: result.jobs.length,
    relationCounts: Object.fromEntries([...relationCounts.entries()].sort()),
    reviewRequired: judgments.filter((item) => !item.accepted).length,
    sample: judgments.slice(0, 12),
    sampleTruncated: judgments.length > 12,
    totals: {
      heads: result.run.totalHeads,
      inputTokens: result.run.totalInputTokens,
      outputTokens: result.run.totalOutputTokens,
      rejected: result.run.rejected.length,
    },
    reviewPath: result.reviewPath,
    learning: result.learning,
    responseDetail: "summary" as const,
    rawTraceLoaded: false as const,
    sourceTextReturned: false as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
  };
}

function compactFallbackReview(result: Awaited<ReturnType<typeof reviewMssrProjectEvidenceGraphDeterministically>>) {
  const decided = result.decisions.filter((item) => item.decision.relation !== null);
  const abstained = result.decisions.length - decided.length;
  const relationCounts = new Map<string, number>();
  for (const item of decided) relationCounts.set(item.decision.relation!, (relationCounts.get(item.decision.relation!) ?? 0) + 1);
  return {
    mode: result.mode,
    projectRoot: result.graph.projectRoot,
    sources: result.graph.sources.length,
    nodes: result.graph.nodes.length,
    edges: result.graph.edges.length,
    relationCounts: Object.fromEntries([...relationCounts.entries()].sort()),
    decided: decided.length,
    abstained,
    sample: result.decisions.slice(0, 12),
    sampleTruncated: result.decisions.length > 12,
    profile: result.profile,
    responseDetail: "summary" as const,
    rawTraceLoaded: false as const,
    sourceTextReturned: false as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
  };
}

function isJevUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /TYPESAFE_API_KEY|api[ -]?key|credential|unauthori[sz]ed|fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT|timeout|rate.?limit|quota|429|503|unavailable/i.test(message);
}

/** Register the same semantic-curation surface on native, Codex and OpenCode MSSR MCP hosts. */
export function registerMssrSemanticCurationTools(server: McpServer, options: MssrSemanticEvidenceToolOptions = {}): void {
  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[0], {
    description: "Inspect the global MSSR semantic-curation queue. Returns bounded source refs, reasons and retry state only; it never loads Jev or changes project knowledge.",
    inputSchema: mssrSemanticCurationStatusInputSchema,
  }, async ({ maxEntries }) => {
    const state = await readMssrSemanticCurationQueue();
    return response(summarizeQueue(state.entries, maxEntries));
  });

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[1], {
    description: "Scan explicit MSSR project/skill roots for existing context pressure and enqueue only source references that need semantic curation. Uses Project Context modularization and skill context manifests; it does not call Jev or rewrite canonical files.",
    inputSchema: mssrSemanticCurationEnqueueInputSchema,
  }, async ({ projectRoots, skillRoots, includeWatch }) => {
    const projects = [];
    for (const projectRoot of projectRoots) {
      projects.push({
        projectRoot,
        result: await enqueueMssrProjectContextCurationCandidates({ projectRoot, includeWatch }),
      });
    }
    const skills = skillRoots.length > 0
      ? await enqueueMssrOwnedSkillCurationCandidates({ roots: skillRoots })
      : { queued: [], skipped: [] };
    const state = await readMssrSemanticCurationQueue();
    return response({ projects, skills, queue: summarizeQueue(state.entries, 50) });
  });

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[2], {
    description: "Process a bounded slice of the global semantic-curation queue with Jev/System-One. Related heads share one corpus state; unrelated corpora run as separate requests and may run in parallel. Writes advisory review artifacts under MSSR state only and never rewrites project/skill authorities.",
    inputSchema: mssrSemanticCurationProcessInputSchema,
  }, async ({ maxEntries, concurrency, maxHeadsPerRequest, maxStateChars, model }) => response(await processMssrSemanticCurationQueue({
    maxEntries,
    concurrency,
    maxHeadsPerRequest,
    maxStateChars,
    ...(model ? { jev: { model } } : {}),
  })));

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[3], {
    description: "Plan a safe physical Project Context split with Jev. The plan moves only exact existing Markdown sections behind selective external refs, persists under MSSR state, and never mutates canonical project files.",
    inputSchema: mssrProjectContextRefSplitPlanInputSchema,
  }, async ({ projectRoot, moduleId, model, traceId, workflowKey }) => response(await planMssrProjectContextReferenceSplit({
    projectRoot,
    moduleId,
    ...(model ? { jev: { model } } : {}),
    ...(traceId ? { trace: mssrSemanticTraceProjectionSchema.parse({ traceId, ...(workflowKey ? { workflowKey } : {}) }) } : {}),
    persist: true,
  })));

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[4], {
    description: "Apply one previously persisted auto-safe Project Context ref-split plan. Requires exact planId confirmation, revalidates source/section hashes and module structure, writes exact source bytes only, and aborts stale or review-required plans.",
    inputSchema: mssrProjectContextRefSplitApplyInputSchema,
  }, async ({ planId, confirmPlanId }) => response(await applyMssrProjectContextReferencePlan({ planId, confirmPlanId })));

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[5], {
    description: "Build a bounded cross-document evidence graph for one project. It scans high-signal MSSR/docs/changelog/small-QA sources, keeps exact block provenance, and retrieves comparison candidates only. It never calls Jev and lexical/freshness hints are never truth authority.",
    inputSchema: mssrSemanticCurationEvidenceGraphInputSchema,
  }, async ({ projectRoot, maxSources, maxBlocks, maxPairs, minScore }) => response(summarizeMssrProjectEvidenceGraph(await buildMssrProjectEvidenceGraph({
    projectRoot,
    maxSources,
    maxBlocks,
    maxPairs,
    minScore,
  }))));

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[6], {
    description: "Run one bounded cross-document semantic review for a project. In auto mode MSSR uses Jev first and falls back only when the provider is explicitly unavailable. Persisted Jev reviews create shadow learning observations; raw Jev output never becomes training truth. Summary detail is bounded by default to avoid context pressure.",
    inputSchema: mssrSemanticCurationProjectReviewInputSchema,
  }, async ({ projectRoot, maxSources, maxBlocks, maxPairs, minScore, concurrency, maxHeadsPerRequest, maxStateChars, model, persist, mode, detail, traceId, workflowKey }) => {
    const graphArgs = { projectRoot, maxSources, maxBlocks, maxPairs, minScore };
    const trace = traceId ? mssrSemanticTraceProjectionSchema.parse({ traceId, ...(workflowKey ? { workflowKey } : {}) }) : undefined;
    if (mode === "deterministic") {
      const fallback = await reviewMssrProjectEvidenceGraphDeterministically(graphArgs);
      return response(detail === "full" ? fallback : compactFallbackReview(fallback));
    }
    try {
      const result = await reviewMssrProjectEvidenceGraph({
        ...graphArgs,
        concurrency,
        maxHeadsPerRequest,
        maxStateChars,
        ...(model ? { jev: { model } } : {}),
        persist,
        ...(trace ? { trace } : {}),
      });
      return response(detail === "full" ? result : compactJevReview(result));
    } catch (error) {
      if (mode !== "auto" || !isJevUnavailableError(error)) throw error;
      const fallback = await reviewMssrProjectEvidenceGraphDeterministically(graphArgs);
      const value = detail === "full" ? fallback : compactFallbackReview(fallback);
      return response({ ...value, fallbackReason: "jev-unavailable", jevErrorClass: "provider-unavailable" });
    }
  });

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[7], {
    description: "Inspect compact semantic-distillation learning state. Shows shadow/verified/corrected/rejected counts and only bounded distilled rules; it never loads raw traces or source text and has no routing or canonical-write authority.",
    inputSchema: mssrSemanticCurationLearningStatusInputSchema,
  }, async ({ maxRules }) => response(await summarizeMssrSemanticDistillationLearning({ maxRules })));

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[8], {
    description: "Attach independent verification feedback to one Jev shadow observation. Confirmed/corrected evidence may later contribute to deterministic distillation; rejected/unknown Jev output never becomes training truth. Optional trace metadata must be the compact privacy-safe projection only.",
    inputSchema: mssrSemanticCurationLearningFeedbackInputSchema,
  }, async ({ observationId, status, relation, evidenceRef, trace }) => {
    const result = await applyMssrSemanticDistillationFeedback({
      observationId,
      status,
      ...(relation ? { relation } : {}),
      evidenceRef,
      ...(trace ? { trace } : {}),
    });
    const learning = await summarizeMssrSemanticDistillationLearning({ maxRules: 20 });
    return response({
      updated: result.updated,
      observationId: result.observation.id,
      verification: result.observation.verification,
      jev: result.observation.jev ?? null,
      traceAttached: Boolean(result.observation.trace),
      learning,
      advisoryOnly: true,
      canonicalRewriteAllowed: false,
    });
  });

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[9], {
    description: "Review a bounded project evidence graph without Jev. Uses only exact deterministic evidence plus previously distilled rules backed by independent verification; otherwise it abstains. Summary detail is bounded by default.",
    inputSchema: mssrSemanticCurationFallbackReviewInputSchema,
  }, async ({ projectRoot, maxSources, maxBlocks, maxPairs, minScore, detail }) => {
    const result = await reviewMssrProjectEvidenceGraphDeterministically({ projectRoot, maxSources, maxBlocks, maxPairs, minScore });
    return response(detail === "full" ? result : compactFallbackReview(result));
  });

  server.registerTool(MSSR_SEMANTIC_CURATION_TOOL_NAMES[10], {
    description: "Hydrate Jev shadow observations already linked to one MSSR trace when its strict learning digest becomes available. Only the privacy-safe trace projection is stored; this never confirms a semantic relation, changes verification status, or loads raw trace text.",
    inputSchema: mssrSemanticCurationLearningTraceLinkInputSchema,
  }, async ({ traceId, workflowKey, digest, evidenceRefs }) => {
    const trace = projectMssrSemanticTraceLearning({ traceId, ...(workflowKey ? { workflowKey } : {}), digest, evidenceRefs });
    const linked = await attachMssrSemanticDistillationTrace({ trace });
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
      canonicalRewriteAllowed: false,
    });
  });

  registerMssrSemanticExperienceTools(server);
  registerMssrSemanticEvidenceTools(server, options);
}
