import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  architectureImpactManifestSchema,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import { architectureGraphEdgeSchema, architectureGraphEdgeKindSchema, type ArchitectureGraphEdge } from "./architecture-derived-graph.js";
import { MSSR_PROJECT_CONTROL_FILES, mssrProjectRelativePath, resolveMssrProjectFile } from "./project-home.js";

export const MSSR_ARCHITECTURE_INVARIANT_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_INVARIANTS = 128;
export const MAX_ARCHITECTURE_INVARIANT_EDGES = 1024;
export const DEFAULT_ARCHITECTURE_INVARIANT_MANIFEST_RELATIVE = mssrProjectRelativePath(
  MSSR_PROJECT_CONTROL_FILES.architectureInvariantManifest,
);

const stableIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/);
const descriptionSchema = z.string().min(1).max(240).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Invariant descriptions must be bounded single-line strings without surrounding whitespace.",
);
const analyzerIdSchema = z.string().min(1).max(160).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Analyzer ids must be bounded single-line strings without surrounding whitespace.",
);

export const architectureInvariantRuleSchema = z.object({
  invariantId: stableIdSchema,
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  description: descriptionSchema,
  kind: z.enum(["forbid-edge", "require-edge"]),
  edgeKind: architectureGraphEdgeKindSchema,
  sourceRef: architectureImpactExactRefSchema,
  targetRef: architectureImpactExactRefSchema,
}).strict();

export const architectureInvariantManifestSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_INVARIANT_SCHEMA_VERSION),
  invariants: z.array(architectureInvariantRuleSchema).max(MAX_ARCHITECTURE_INVARIANTS).default([]),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.invariants.length; index += 1) {
    const id = value.invariants[index].invariantId;
    if (seen.has(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate architecture invariant id: ${id}`, path: ["invariants", index, "invariantId"] });
    }
    seen.add(id);
  }
});

export const architectureInvariantGraphEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_INVARIANT_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  analyzerId: analyzerIdSchema,
  coverage: z.enum(["complete", "partial"]),
  edges: z.array(architectureGraphEdgeSchema).max(MAX_ARCHITECTURE_INVARIANT_EDGES),
}).strict();

export const architectureInvariantEvaluationSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_INVARIANT_SCHEMA_VERSION),
  invariantId: stableIdSchema,
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  status: z.enum(["satisfied", "violated", "unresolved"]),
  level: z.enum(["ok", "watch", "review"]),
  attentionClass: z.enum(["none", "invariant-unresolved", "invariant-violation"]),
  reasonCode: z.enum([
    "forbidden-edge-absent",
    "forbidden-edge-observed",
    "required-edge-observed",
    "required-edge-absent",
    "graph-evidence-partial",
  ]),
  matchedEdge: architectureGraphEdgeSchema.optional(),
  canonicalRewriteAllowed: z.literal(false),
  fingerprint: z.string().regex(/^sha256:[0-9a-f]{64}$/),
}).strict().superRefine((value, ctx) => {
  const expectedLevel = value.status === "satisfied" ? "ok" : value.status === "unresolved" ? "watch" : "review";
  const expectedAttention = value.status === "satisfied" ? "none" : value.status === "unresolved" ? "invariant-unresolved" : "invariant-violation";
  if (value.level !== expectedLevel) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invariant level must be ${expectedLevel} for status ${value.status}.`, path: ["level"] });
  if (value.attentionClass !== expectedAttention) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invariant attentionClass must be ${expectedAttention} for status ${value.status}.`, path: ["attentionClass"] });
});

export type ArchitectureInvariantRule = z.infer<typeof architectureInvariantRuleSchema>;
export type ArchitectureInvariantManifest = z.infer<typeof architectureInvariantManifestSchema>;
export type ArchitectureInvariantGraphEvidence = z.infer<typeof architectureInvariantGraphEvidenceSchema>;
export type ArchitectureInvariantEvaluation = z.infer<typeof architectureInvariantEvaluationSchema>;
export type ArchitectureInvariantManifestLoadResult =
  | { found: false; path: string }
  | { found: true; manifest: ArchitectureInvariantManifest; path: string };

function edgeMatches(rule: ArchitectureInvariantRule, edge: ArchitectureGraphEdge): boolean {
  return rule.edgeKind === edge.kind && rule.sourceRef === edge.sourceRef && rule.targetRef === edge.targetRef;
}

function fingerprint(parts: readonly string[]): string {
  const body = parts.map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${createHash("sha256").update(body).digest("hex")}`;
}

export function validateArchitectureInvariantManifestAgainstImpactManifest(
  invariantInput: ArchitectureInvariantManifest,
  impactInput: ArchitectureImpactManifest,
): ArchitectureInvariantManifest {
  const invariants = architectureInvariantManifestSchema.parse(invariantInput);
  const impact = architectureImpactManifestSchema.parse(impactInput);
  const ids = new Set(impact.architectures.map((entry) => entry.architectureId));
  for (const invariant of invariants.invariants) {
    if (!ids.has(invariant.architectureId)) {
      throw new Error(`Architecture invariant references unknown architectureId: ${invariant.architectureId}`);
    }
  }
  return invariants;
}

export async function loadArchitectureInvariantManifest(
  projectRoot: string,
  impactManifest: ArchitectureImpactManifest,
  manifestPath?: string,
): Promise<ArchitectureInvariantManifestLoadResult> {
  const resolved = manifestPath
    ? (path.isAbsolute(manifestPath) ? manifestPath : path.resolve(projectRoot, manifestPath))
    : (await resolveMssrProjectFile(projectRoot, MSSR_PROJECT_CONTROL_FILES.architectureInvariantManifest)).absolutePath;
  try {
    const parsed = architectureInvariantManifestSchema.parse(JSON.parse(await fs.readFile(resolved, "utf8")));
    return { found: true, manifest: validateArchitectureInvariantManifestAgainstImpactManifest(parsed, impactManifest), path: resolved };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return { found: false, path: resolved };
    throw error;
  }
}

function finalizeEvaluation(rule: ArchitectureInvariantRule, input: Readonly<{
  status: ArchitectureInvariantEvaluation["status"];
  reasonCode: ArchitectureInvariantEvaluation["reasonCode"];
  matchedEdge?: ArchitectureGraphEdge;
  analyzerId: string;
  coverage: ArchitectureInvariantGraphEvidence["coverage"];
}>): ArchitectureInvariantEvaluation {
  const level = input.status === "satisfied" ? "ok" : input.status === "unresolved" ? "watch" : "review";
  const attentionClass = input.status === "satisfied" ? "none" : input.status === "unresolved" ? "invariant-unresolved" : "invariant-violation";
  const edge = input.matchedEdge;
  const digest = fingerprint([
    "architecture-invariant-evaluation-v1",
    rule.invariantId,
    rule.architectureId,
    rule.kind,
    rule.edgeKind,
    rule.sourceRef,
    rule.targetRef,
    input.analyzerId,
    input.coverage,
    input.status,
    input.reasonCode,
    edge ? `${edge.kind}|${edge.sourceRef}|${edge.targetRef}|${edge.sourceSymbol ?? ""}|${edge.targetSymbol ?? ""}` : "no-edge",
  ]);
  return architectureInvariantEvaluationSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_INVARIANT_SCHEMA_VERSION,
    invariantId: rule.invariantId,
    architectureId: rule.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    status: input.status,
    level,
    attentionClass,
    reasonCode: input.reasonCode,
    ...(edge ? { matchedEdge: edge } : {}),
    canonicalRewriteAllowed: false,
    fingerprint: digest,
  });
}

/** Evaluate only repository-declared invariants. Partial graph evidence never proves absence. */
export function evaluateArchitectureInvariants(
  impactInput: ArchitectureImpactManifest,
  invariantInput: ArchitectureInvariantManifest,
  evidenceInput: ArchitectureInvariantGraphEvidence,
): ArchitectureInvariantEvaluation[] {
  const impact = architectureImpactManifestSchema.parse(impactInput);
  const invariants = validateArchitectureInvariantManifestAgainstImpactManifest(invariantInput, impact);
  const evidence = architectureInvariantGraphEvidenceSchema.parse(evidenceInput);
  if (!impact.architectures.some((entry) => entry.architectureId === evidence.architectureId)) {
    throw new Error(`Unknown architectureId for invariant evidence: ${evidence.architectureId}`);
  }

  return invariants.invariants
    .filter((rule) => rule.architectureId === evidence.architectureId)
    .map((rule) => {
      const matchedEdge = evidence.edges.find((edge) => edgeMatches(rule, edge));
      if (rule.kind === "forbid-edge") {
        if (matchedEdge) return finalizeEvaluation(rule, { status: "violated", reasonCode: "forbidden-edge-observed", matchedEdge, analyzerId: evidence.analyzerId, coverage: evidence.coverage });
        if (evidence.coverage === "partial") return finalizeEvaluation(rule, { status: "unresolved", reasonCode: "graph-evidence-partial", analyzerId: evidence.analyzerId, coverage: evidence.coverage });
        return finalizeEvaluation(rule, { status: "satisfied", reasonCode: "forbidden-edge-absent", analyzerId: evidence.analyzerId, coverage: evidence.coverage });
      }
      if (matchedEdge) return finalizeEvaluation(rule, { status: "satisfied", reasonCode: "required-edge-observed", matchedEdge, analyzerId: evidence.analyzerId, coverage: evidence.coverage });
      if (evidence.coverage === "partial") return finalizeEvaluation(rule, { status: "unresolved", reasonCode: "graph-evidence-partial", analyzerId: evidence.analyzerId, coverage: evidence.coverage });
      return finalizeEvaluation(rule, { status: "violated", reasonCode: "required-edge-absent", analyzerId: evidence.analyzerId, coverage: evidence.coverage });
    })
    .sort((left, right) => left.invariantId.localeCompare(right.invariantId));
}
