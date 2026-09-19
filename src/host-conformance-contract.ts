import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { architectureImpactManifestSchema } from "./architecture-impact.js";
import { architectureStructureManifestSchema } from "./architecture-impact-structure.js";
import { architectureInvariantManifestSchema } from "./architecture-invariants.js";
import {
  evaluateArchitectureHostAdoption,
  planArchitectureHostAdoption,
} from "./architecture-host-adoption.js";
import { planMssrContextPersistenceReviews } from "./context-persistence-review.js";
import { getMssrR4GateACoverageInventory } from "./semantic-consistency-coverage.js";
import { evaluateMssrSemanticConsistency } from "./semantic-consistency.js";
import { retrieveMssrSemanticCandidates } from "./semantic-candidate-retrieval.js";
import { produceMssrSemanticContextMessages } from "./semantic-context-message-producers.js";
import { evaluateMssrSemanticShadowEvidence } from "./semantic-shadow-evidence.js";

export const MSSR_HOST_CONFORMANCE_TOOL_NAMES = [
  "mssr_architecture_impact_plan",
  "mssr_architecture_impact_evaluate",
  "mssr_context_proposal_review",
  "mssr_semantic_consistency_coverage",
  "mssr_semantic_consistency_evaluate",
  "mssr_semantic_candidate_retrieve",
  "mssr_semantic_context_messages",
  "mssr_semantic_shadow_evaluate",
] as const;

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/**
 * Registers one identical, I/O-free conformance boundary for native MCP,
 * Codex and OpenCode. Hosts still own observations, review and persistence.
 */
export function registerMssrHostConformanceTools(server: McpServer) {
  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[0], {
    description: "Resolve declared Architecture Impact work for exact touched refs. Advisory only; performs no filesystem observation or write.",
    inputSchema: {
      architectureManifest: z.unknown(),
      touchedRefs: z.array(z.string().min(1).max(4096)).min(1).max(256),
      structureManifest: z.unknown().optional(),
      invariantManifest: z.unknown().optional(),
    },
  }, async ({ architectureManifest, touchedRefs, structureManifest, invariantManifest }) => response({
    plans: planArchitectureHostAdoption(
      architectureImpactManifestSchema.parse(architectureManifest),
      touchedRefs,
      {
        ...(structureManifest === undefined ? {} : { structureManifest: architectureStructureManifestSchema.parse(structureManifest) }),
        ...(invariantManifest === undefined ? {} : { invariantManifest: architectureInvariantManifestSchema.parse(invariantManifest) }),
      },
    ),
    semanticOwner: "mssr",
    hostOwnsObservation: true,
    canonicalRewriteAllowed: false,
  }));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[1], {
    description: "Evaluate host-supplied Architecture Impact evidence through the portable MSSR coordinator. Never writes a reviewed-current receipt or canonical authority.",
    inputSchema: { evaluation: z.unknown() },
  }, async ({ evaluation }) => response(evaluateArchitectureHostAdoption(evaluation as Parameters<typeof evaluateArchitectureHostAdoption>[0])));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[2], {
    description: "Classify Context Plane persistence proposals into review-ready, refresh-required or blocked. Delivery never authorizes a write.",
    inputSchema: { messages: z.unknown() },
  }, async ({ messages }) => response({
    reviews: planMssrContextPersistenceReviews(messages),
    advisoryOnly: true,
    autoWriteAllowed: false,
  }));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[3], {
    description: "Return the read-only R4 semantic-consistency integration coverage inventory. This reports declared implementation/adoption status only; it does not prove semantic truth or authorize writes.",
    inputSchema: { capabilityIds: z.array(z.string().min(1).max(120)).max(32).optional() },
  }, async ({ capabilityIds }) => response(getMssrR4GateACoverageInventory(capabilityIds)));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[4], {
    description: "Evaluate explicit structured semantic claims and declared relations through portable deterministic MSSR semantics. No filesystem I/O or canonical rewrite.",
    inputSchema: { input: z.unknown() },
  }, async ({ input }) => response(evaluateMssrSemanticConsistency(input as Parameters<typeof evaluateMssrSemanticConsistency>[0])));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[5], {
    description: "Retrieve bounded semantic comparison candidates using declared relations, exact structure and candidate-only TF-IDF. Similarity never proves truth.",
    inputSchema: { input: z.unknown() },
  }, async ({ input }) => response(retrieveMssrSemanticCandidates(input as Parameters<typeof retrieveMssrSemanticCandidates>[0])));

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[6], {
    description: "Produce bounded semantic Context Messages from proven deterministic contradictions or explicit unresolved declared relations. Advisory only.",
    inputSchema: {
      input: z.unknown(),
      observedAt: z.string().datetime({ offset: true }),
    },
  }, async ({ input, observedAt }) => {
    const evaluation = evaluateMssrSemanticConsistency(input as Parameters<typeof evaluateMssrSemanticConsistency>[0]);
    return response({
      evaluation,
      messages: produceMssrSemanticContextMessages({ evaluation, observedAt }),
      advisoryOnly: true,
      autoWriteAllowed: false,
    });
  });

  server.registerTool(MSSR_HOST_CONFORMANCE_TOOL_NAMES[7], {
    description: "Classify host-supplied NLI/cross-encoder output as derived shadow-only evidence. It cannot influence routing, notices, truth, or canonical writes.",
    inputSchema: { observation: z.unknown() },
  }, async ({ observation }) => response(evaluateMssrSemanticShadowEvidence(observation)));
}
