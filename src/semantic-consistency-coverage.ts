import { z } from "zod";

export const MSSR_SEMANTIC_COVERAGE_STATUSES = [
  "implemented",
  "host-supplied",
  "reserved",
  "pending-adoption",
  "unresolved",
] as const;

export const MSSR_SEMANTIC_COVERAGE_EDGE_KINDS = [
  "contract",
  "producer",
  "evaluator",
  "consumer",
  "test",
  "export",
  "host-adoption",
] as const;

export const MSSR_SEMANTIC_COVERAGE_CLASSES = [
  "source-complete",
  "pending-host-adoption",
  "reserved-contract",
  "test-only",
  "export-only",
  "partial",
  "unresolved",
] as const;

export const mssrSemanticCoverageEdgeSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/),
  kind: z.enum(MSSR_SEMANTIC_COVERAGE_EDGE_KINDS),
  status: z.enum(MSSR_SEMANTIC_COVERAGE_STATUSES),
  owner: z.string().min(1).max(120),
  ref: z.string().min(1).max(240).optional(),
  note: z.string().min(1).max(300).optional(),
}).strict();

export const mssrSemanticCoverageCapabilitySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/),
  category: z.enum(["capability", "context-message"]),
  description: z.string().min(1).max(300),
  requiredSourceEdges: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/)).max(16).default([]),
  edges: z.array(mssrSemanticCoverageEdgeSchema).min(1).max(32),
}).strict().superRefine((value, ctx) => {
  const edgeIds = new Set(value.edges.map((edge) => edge.id));
  for (const required of value.requiredSourceEdges) {
    if (!edgeIds.has(required)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `requiredSourceEdges references unknown edge '${required}'.`,
        path: ["requiredSourceEdges"],
      });
    }
  }
  if (edgeIds.size !== value.edges.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Coverage edge ids must be unique.", path: ["edges"] });
  }
});

export const mssrSemanticCoverageCapabilityBatchSchema = z.array(mssrSemanticCoverageCapabilitySchema).max(64);

export type MssrSemanticCoverageEdge = z.infer<typeof mssrSemanticCoverageEdgeSchema>;
export type MssrSemanticCoverageCapability = z.infer<typeof mssrSemanticCoverageCapabilitySchema>;
export type MssrSemanticCoverageClass = typeof MSSR_SEMANTIC_COVERAGE_CLASSES[number];

const SATISFIED_SOURCE_STATUSES = new Set<MssrSemanticCoverageEdge["status"]>(["implemented", "host-supplied"]);

function classifyCapability(capability: MssrSemanticCoverageCapability): MssrSemanticCoverageClass {
  const byId = new Map(capability.edges.map((edge) => [edge.id, edge] as const));
  const required = capability.requiredSourceEdges.map((id) => byId.get(id)).filter(Boolean) as MssrSemanticCoverageEdge[];
  const sourceComplete = required.length > 0 && required.every((edge) => SATISFIED_SOURCE_STATUSES.has(edge.status));
  const hostEdges = capability.edges.filter((edge) => edge.kind === "host-adoption");
  const pendingHost = hostEdges.some((edge) => edge.status === "pending-adoption");
  const unresolved = capability.edges.some((edge) => edge.status === "unresolved");
  const reservedRequired = required.some((edge) => edge.status === "reserved");
  const implementedSource = capability.edges.some((edge) => ["contract", "producer", "evaluator", "consumer"].includes(edge.kind) && edge.status === "implemented");
  const implementedTest = capability.edges.some((edge) => edge.kind === "test" && edge.status === "implemented");
  const implementedExport = capability.edges.some((edge) => edge.kind === "export" && edge.status === "implemented");

  if (unresolved) return "unresolved";
  if (sourceComplete && pendingHost) return "pending-host-adoption";
  if (sourceComplete) return "source-complete";
  if (reservedRequired) return "reserved-contract";
  if (!implementedSource && implementedTest) return "test-only";
  if (!implementedSource && implementedExport) return "export-only";
  return "partial";
}

export function buildMssrSemanticConsistencyCoverageInventory(
  capabilities: readonly MssrSemanticCoverageCapability[],
) {
  const parsed = mssrSemanticCoverageCapabilityBatchSchema.parse(capabilities);
  const entries = parsed.map((capability) => ({
    ...capability,
    coverageClass: classifyCapability(capability),
  }));

  const edgeCounts = Object.fromEntries(MSSR_SEMANTIC_COVERAGE_STATUSES.map((status) => [status, 0])) as Record<
    typeof MSSR_SEMANTIC_COVERAGE_STATUSES[number], number
  >;
  const classCounts = Object.fromEntries(MSSR_SEMANTIC_COVERAGE_CLASSES.map((status) => [status, 0])) as Record<
    MssrSemanticCoverageClass, number
  >;

  for (const entry of entries) {
    classCounts[entry.coverageClass] += 1;
    for (const edge of entry.edges) edgeCounts[edge.status] += 1;
  }

  return {
    schemaVersion: 1 as const,
    advisoryOnly: true as const,
    canonicalRewriteAllowed: false as const,
    entries,
    summary: {
      capabilities: entries.length,
      edges: entries.reduce((sum, entry) => sum + entry.edges.length, 0),
      edgeCounts,
      classCounts,
    },
  };
}

export const MSSR_R4_GATE_A_COVERAGE = mssrSemanticCoverageCapabilityBatchSchema.parse([
  {
    id: "semantic-claims-c2e-d",
    category: "capability",
    description: "Typed release/state/ownership/decision claims projected through the existing Situation Model consistency owner.",
    requiredSourceEdges: ["claim-contract", "claim-producer", "claim-evaluator"],
    edges: [
      { id: "claim-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/situation-claims.ts" },
      { id: "claim-producer", kind: "producer", status: "implemented", owner: "mssr", ref: "src/situation-claims.ts" },
      { id: "claim-evaluator", kind: "evaluator", status: "implemented", owner: "mssr", ref: "src/consistency-projection.ts" },
      { id: "claim-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-situation-claims.mjs" },
      { id: "claim-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "claim-bridge-adoption", kind: "host-adoption", status: "host-supplied", owner: "bridge", ref: "docs/skill-routing/INCIDENTS.md#MSSR-047", note: "Bridge adoption is external evidence, not portable MSSR authority." },
    ],
  },
  {
    id: "document-freshness",
    category: "capability",
    description: "Portable document freshness contract and deterministic stale/current evaluation with host-owned observation.",
    requiredSourceEdges: ["freshness-contract", "freshness-evaluator"],
    edges: [
      { id: "freshness-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/document-freshness.ts" },
      { id: "freshness-evaluator", kind: "evaluator", status: "implemented", owner: "mssr", ref: "src/document-freshness.ts" },
      { id: "freshness-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-document-freshness.mjs" },
      { id: "freshness-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "freshness-bridge-adoption", kind: "host-adoption", status: "host-supplied", owner: "bridge", ref: "docs/skill-routing/INCIDENTS.md#MSSR-048", note: "Bridge owns filesystem/runtime observation and notice delivery." },
    ],
  },
  {
    id: "context-message:roadmap-contradiction",
    category: "context-message",
    description: "Reserved Context Message projection for a contradiction proven by deterministic semantic evidence.",
    requiredSourceEdges: ["roadmap-kind-contract", "roadmap-producer"],
    edges: [
      { id: "roadmap-kind-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/context-messages.ts" },
      { id: "roadmap-producer", kind: "producer", status: "implemented", owner: "mssr", ref: "src/semantic-context-message-producers.ts", note: "Emits only from PROVEN deterministic roadmap findings; similarity/model evidence remains silent." },
      { id: "roadmap-consumer", kind: "consumer", status: "implemented", owner: "mssr", ref: "src/context-messages.ts" },
      { id: "roadmap-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-semantic-consistency-r4.mjs" },
      { id: "roadmap-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "roadmap-portable-hosts", kind: "host-adoption", status: "implemented", owner: "mssr", ref: "src/host-conformance-contract.ts", note: "Native/Codex/OpenCode expose the same portable I/O-free producer boundary." },
      { id: "roadmap-bridge-adoption", kind: "host-adoption", status: "pending-adoption", owner: "bridge", note: "Bridge must adopt the package release separately; source parity is not runtime adoption." },
    ],
  },
  {
    id: "context-message:unresolved-reference",
    category: "context-message",
    description: "Reserved Context Message projection for an unresolved typed subject, owner, or canonical reference.",
    requiredSourceEdges: ["unresolved-kind-contract", "unresolved-producer"],
    edges: [
      { id: "unresolved-kind-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/context-messages.ts" },
      { id: "unresolved-producer", kind: "producer", status: "implemented", owner: "mssr", ref: "src/semantic-context-message-producers.ts", note: "Emits from explicit current declared relations whose target subject/ref cannot be resolved." },
      { id: "unresolved-consumer", kind: "consumer", status: "implemented", owner: "mssr", ref: "src/context-messages.ts" },
      { id: "unresolved-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-semantic-consistency-r4.mjs" },
      { id: "unresolved-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "unresolved-portable-hosts", kind: "host-adoption", status: "implemented", owner: "mssr", ref: "src/host-conformance-contract.ts" },
      { id: "unresolved-bridge-adoption", kind: "host-adoption", status: "pending-adoption", owner: "bridge" },
    ],
  },
  {
    id: "semantic-relations-r4",
    category: "capability",
    description: "Typed declared/derived semantic relations with temporal validity, scope, owner provenance, exact relation comparison, and unresolved-target evidence.",
    requiredSourceEdges: ["relation-contract", "relation-evaluator"],
    edges: [
      { id: "relation-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/semantic-relations.ts" },
      { id: "relation-evaluator", kind: "evaluator", status: "implemented", owner: "mssr", ref: "src/semantic-relations.ts" },
      { id: "relation-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-semantic-consistency-r4.mjs" },
      { id: "relation-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "relation-portable-hosts", kind: "host-adoption", status: "implemented", owner: "mssr", ref: "src/host-conformance-contract.ts" },
      { id: "relation-bridge-adoption", kind: "host-adoption", status: "pending-adoption", owner: "bridge" },
    ],
  },
  {
    id: "semantic-candidate-retrieval-r4",
    category: "capability",
    description: "Bounded declared/exact/TF-IDF candidate retrieval that never becomes semantic truth or canonical authority.",
    requiredSourceEdges: ["candidate-evaluator"],
    edges: [
      { id: "candidate-evaluator", kind: "evaluator", status: "implemented", owner: "mssr", ref: "src/semantic-candidate-retrieval.ts" },
      { id: "candidate-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-semantic-consistency-r4.mjs" },
      { id: "candidate-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "candidate-portable-hosts", kind: "host-adoption", status: "implemented", owner: "mssr", ref: "src/host-conformance-contract.ts" },
      { id: "candidate-bridge-adoption", kind: "host-adoption", status: "pending-adoption", owner: "bridge" },
    ],
  },
  {
    id: "semantic-shadow-r4",
    category: "capability",
    description: "Optional model/cross-encoder shadow evidence contract pinned to derived candidate authority with no routing, notice, truth, or rewrite power.",
    requiredSourceEdges: ["shadow-contract", "shadow-evaluator"],
    edges: [
      { id: "shadow-contract", kind: "contract", status: "implemented", owner: "mssr", ref: "src/semantic-shadow-evidence.ts" },
      { id: "shadow-evaluator", kind: "evaluator", status: "implemented", owner: "mssr", ref: "src/semantic-shadow-evidence.ts" },
      { id: "shadow-test", kind: "test", status: "implemented", owner: "mssr", ref: "scripts/test-semantic-consistency-r4.mjs" },
      { id: "shadow-export", kind: "export", status: "implemented", owner: "mssr", ref: "src/index.ts" },
      { id: "shadow-portable-hosts", kind: "host-adoption", status: "implemented", owner: "mssr", ref: "src/host-conformance-contract.ts" },
      { id: "shadow-bridge-adoption", kind: "host-adoption", status: "pending-adoption", owner: "bridge", note: "Contract adoption is separate from running or validating any model experiment." },
    ],
  },
]);

export function getMssrR4GateACoverageInventory(ids?: readonly string[]) {
  if (!ids || ids.length === 0) return buildMssrSemanticConsistencyCoverageInventory(MSSR_R4_GATE_A_COVERAGE);
  const requested = new Set(ids);
  return buildMssrSemanticConsistencyCoverageInventory(MSSR_R4_GATE_A_COVERAGE.filter((entry) => requested.has(entry.id)));
}
