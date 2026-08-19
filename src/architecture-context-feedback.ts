import { z } from "zod";
import {
  architectureImpactManifestSchema,
  validateArchitectureImpactContextRefs,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import {
  architectureImpactProjectionSchema,
  type ArchitectureImpactProjection,
} from "./architecture-impact-projection.js";
import {
  projectContextManifestSchema,
  type ProjectContextManifest,
} from "./project-context.js";
import {
  mssrSituationContextRequestSchema,
  resolveMssrSituationContextAuthorityRef,
  resolveMssrSituationContextEntryId,
} from "./situation-context-feedback.js";

export const MSSR_ARCHITECTURE_CONTEXT_FEEDBACK_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_CONTEXT_FEEDBACK_REQUESTS = 2;

export const architectureContextFeedbackRequestSchema = z.object({
  role: z.enum(["context", "authority"]),
  contextRef: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
  request: mssrSituationContextRequestSchema,
}).strict().superRefine((value, ctx) => {
  if (value.role === "context" && !value.contextRef) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Architecture context feedback requires contextRef for context-role requests.", path: ["contextRef"] });
  }
  if (value.role === "authority" && value.contextRef !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Architecture authority feedback must not carry contextRef.", path: ["contextRef"] });
  }
});

export const architectureContextFeedbackSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_CONTEXT_FEEDBACK_SCHEMA_VERSION),
  architectureId: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  architectureStatus: z.enum(["aligned", "possible-impact", "unresolved"]),
  architectureLevel: z.enum(["ok", "review"]),
  trigger: z.literal("natural-replan"),
  requests: z.array(architectureContextFeedbackRequestSchema).max(MAX_ARCHITECTURE_CONTEXT_FEEDBACK_REQUESTS),
  replanOnly: z.literal(true),
  semanticRetrievalRerun: z.literal(false),
  autoLoad: z.literal(false),
  budgetOverride: z.literal(false),
  selectionPolicy: z.literal("normal-budgeted-selection"),
  advisoryOnly: z.literal(true),
}).strict().superRefine((value, ctx) => {
  if (value.architectureLevel === "ok" && value.requests.length > 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Aligned architecture must not emit context feedback requests.", path: ["requests"] });
  }
  if (value.architectureLevel === "review" && value.requests.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Active architecture review must emit at least one bounded context feedback request.", path: ["requests"] });
  }
});

export type ArchitectureContextFeedbackRequest = z.infer<typeof architectureContextFeedbackRequestSchema>;
export type ArchitectureContextFeedback = z.infer<typeof architectureContextFeedbackSchema>;

export type BuildArchitectureContextFeedbackArgs = Readonly<{
  architectureManifest: ArchitectureImpactManifest;
  projection: ArchitectureImpactProjection;
  projectContextManifest: ProjectContextManifest;
}>;

function requestReasonCodes(projection: ArchitectureImpactProjection, reasonCode?: string): string[] {
  return [...new Set([
    "architecture-review-active",
    ...projection.reasonCodes,
    ...(reasonCode ? [reasonCode] : []),
  ])].sort().slice(0, 20);
}

/**
 * C2f-D bounded Architecture Impact -> Context Plane feedback.
 *
 * This function runs only at a caller-selected natural MSSR replan boundary. It
 * never loads context, reruns semantic retrieval, edits project knowledge, or
 * changes context budgets. It merely resolves the already-declared contextRef
 * and authorityRef through C2e-E's exact context-resolution helpers so the host
 * can feed them into its normal budgeted selection path.
 */
export function buildArchitectureContextFeedback(
  args: BuildArchitectureContextFeedbackArgs,
): ArchitectureContextFeedback {
  const architectureManifest = validateArchitectureImpactContextRefs(
    architectureImpactManifestSchema.parse(args.architectureManifest),
    projectContextManifestSchema.parse(args.projectContextManifest),
  );
  const projection = architectureImpactProjectionSchema.parse(args.projection);
  const projectContextManifest = projectContextManifestSchema.parse(args.projectContextManifest);
  const architecture = architectureManifest.architectures.find((entry) => entry.architectureId === projection.architectureId);
  if (!architecture) {
    throw new Error(`Architecture context feedback references unknown architectureId: ${projection.architectureId}`);
  }

  if (projection.level === "ok") {
    return architectureContextFeedbackSchema.parse({
      schemaVersion: MSSR_ARCHITECTURE_CONTEXT_FEEDBACK_SCHEMA_VERSION,
      architectureId: projection.architectureId,
      architectureStatus: projection.status,
      architectureLevel: projection.level,
      trigger: "natural-replan",
      requests: [],
      replanOnly: true,
      semanticRetrievalRerun: false,
      autoLoad: false,
      budgetOverride: false,
      selectionPolicy: "normal-budgeted-selection",
      advisoryOnly: true,
    });
  }

  const requests: ArchitectureContextFeedbackRequest[] = [];
  if (architecture.contextRef) {
    const resolvedContext = resolveMssrSituationContextEntryId(architecture.contextRef, projectContextManifest);
    if (!resolvedContext.entry || resolvedContext.resolution !== "exact-entry") {
      throw new Error(`Architecture contextRef could not resolve exactly at replan: ${architecture.architectureId}:${architecture.contextRef}`);
    }
    requests.push({
      role: "context",
      contextRef: architecture.contextRef,
      request: mssrSituationContextRequestSchema.parse({
        kind: "project-context-entry",
        resolution: resolvedContext.resolution,
        key: `architecture.review:${architecture.architectureId}:context`,
        action: "load-canonical-authority",
        authorityRef: resolvedContext.entry.sourcePath,
        category: "architecture",
        priority: 90,
        required: false,
        entry: resolvedContext.entry,
        reasonCodes: requestReasonCodes(projection, resolvedContext.reasonCode),
        advisoryOnly: true,
      }),
    });
  }

  const resolvedAuthority = resolveMssrSituationContextAuthorityRef(architecture.authorityRef, projectContextManifest);
  requests.push({
    role: "authority",
    request: mssrSituationContextRequestSchema.parse({
      kind: resolvedAuthority.entry ? "project-context-entry" : "canonical-authority",
      resolution: resolvedAuthority.resolution,
      key: `architecture.review:${architecture.architectureId}:authority`,
      action: "load-canonical-authority",
      authorityRef: architecture.authorityRef,
      category: "architecture",
      priority: 90,
      required: false,
      ...(resolvedAuthority.entry ? { entry: resolvedAuthority.entry } : {}),
      reasonCodes: requestReasonCodes(projection, resolvedAuthority.reasonCode),
      advisoryOnly: true,
    }),
  });

  return architectureContextFeedbackSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_CONTEXT_FEEDBACK_SCHEMA_VERSION,
    architectureId: projection.architectureId,
    architectureStatus: projection.status,
    architectureLevel: projection.level,
    trigger: "natural-replan",
    requests,
    replanOnly: true,
    semanticRetrievalRerun: false,
    autoLoad: false,
    budgetOverride: false,
    selectionPolicy: "normal-budgeted-selection",
    advisoryOnly: true,
  });
}
