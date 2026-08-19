import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  architectureImpactManifestSchema,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";

export const MSSR_ARCHITECTURE_DERIVED_GRAPH_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_DERIVED_GRAPH_CANDIDATES = 256;
export const MSSR_ARCHITECTURE_GRAPH_EDGE_KINDS = ["import", "call", "dependency"] as const;

const boundedSingleLineSchema = z.string().min(1).max(160).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Value must be a bounded single-line string without surrounding whitespace.",
);

export const architectureGraphEdgeKindSchema = z.enum(MSSR_ARCHITECTURE_GRAPH_EDGE_KINDS);
export const architectureGraphEdgeSchema = z.object({
  kind: architectureGraphEdgeKindSchema,
  sourceRef: architectureImpactExactRefSchema,
  targetRef: architectureImpactExactRefSchema,
  sourceSymbol: boundedSingleLineSchema.optional(),
  targetSymbol: boundedSingleLineSchema.optional(),
}).strict();

export const architectureGraphHostEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_DERIVED_GRAPH_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("derived"),
  evidenceClass: z.literal("observed"),
  analyzerId: boundedSingleLineSchema,
  edges: z.array(architectureGraphEdgeSchema).max(MAX_ARCHITECTURE_DERIVED_GRAPH_CANDIDATES),
}).strict();

export const architectureDerivedGraphCandidateSchema = architectureGraphEdgeSchema.extend({
  promotionState: z.literal("candidate"),
}).strict();

export const architectureDerivedGraphCandidatesSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_DERIVED_GRAPH_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("derived"),
  evidenceClass: z.literal("observed"),
  analyzerId: boundedSingleLineSchema,
  canonicalReviewEligible: z.literal(false),
  candidates: z.array(architectureDerivedGraphCandidateSchema).max(MAX_ARCHITECTURE_DERIVED_GRAPH_CANDIDATES),
}).strict();

export type ArchitectureGraphEdge = z.infer<typeof architectureGraphEdgeSchema>;
export type ArchitectureGraphHostEvidence = z.infer<typeof architectureGraphHostEvidenceSchema>;
export type ArchitectureDerivedGraphCandidate = z.infer<typeof architectureDerivedGraphCandidateSchema>;
export type ArchitectureDerivedGraphCandidates = z.infer<typeof architectureDerivedGraphCandidatesSchema>;

function edgeKey(edge: ArchitectureGraphEdge): string {
  return [edge.kind, edge.sourceRef, edge.targetRef, edge.sourceSymbol ?? "", edge.targetSymbol ?? ""]
    .map((part) => `${part.length}:${part}`)
    .join("|");
}

/**
 * C2f-C.5-D normalizes host graph evidence into navigation/review candidates only.
 * The source side must already belong to the declared architecture. The target may
 * be nearby undeclared code, but it never becomes canonical architecture scope
 * merely because a graph analyzer observed an edge.
 */
export function deriveArchitectureGraphCandidates(
  manifestInput: ArchitectureImpactManifest,
  evidenceInput: ArchitectureGraphHostEvidence,
): ArchitectureDerivedGraphCandidates {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  const evidence = architectureGraphHostEvidenceSchema.parse(evidenceInput);
  const architecture = manifest.architectures.find((entry) => entry.architectureId === evidence.architectureId);
  if (!architecture) {
    throw new Error(`Unknown architectureId for derived graph evidence: ${evidence.architectureId}`);
  }

  const declaredRefs = new Set([architecture.authorityRef, ...architecture.impactRefs]);
  const unique = new Map<string, ArchitectureDerivedGraphCandidate>();
  for (const edge of evidence.edges) {
    if (!declaredRefs.has(edge.sourceRef)) {
      throw new Error(`Derived graph edge source is outside declared architecture ${evidence.architectureId}: ${edge.sourceRef}`);
    }
    unique.set(edgeKey(edge), { ...edge, promotionState: "candidate" });
  }

  const candidates = [...unique.values()].sort((left, right) => edgeKey(left).localeCompare(edgeKey(right)));
  return architectureDerivedGraphCandidatesSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_DERIVED_GRAPH_SCHEMA_VERSION,
    architectureId: evidence.architectureId,
    relationshipClass: "derived",
    evidenceClass: "observed",
    analyzerId: evidence.analyzerId,
    canonicalReviewEligible: false,
    candidates,
  });
}
