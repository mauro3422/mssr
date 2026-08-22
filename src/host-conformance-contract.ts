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

export const MSSR_HOST_CONFORMANCE_TOOL_NAMES = [
  "mssr_architecture_impact_plan",
  "mssr_architecture_impact_evaluate",
  "mssr_context_proposal_review",
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
}
