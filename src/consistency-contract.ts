import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MSSR_CONSISTENCY_AUTHORITIES,
  MSSR_CONSISTENCY_BOUNDARIES,
  MSSR_CONSISTENCY_OBSERVATION_STATES,
  MSSR_CONSISTENCY_ROLES,
} from "./consistency-projection.js";
import { evaluateMssrConsistencyDecisionSupport } from "./consistency-recommendation.js";

export const MSSR_CONSISTENCY_TOOL_NAMES = ["mssr_consistency_evaluate"] as const;

export const mssrConsistencyObservationSchema = z.object({
  key: z.string().min(1).max(120),
  observer: z.string().min(1).max(160),
  role: z.enum(MSSR_CONSISTENCY_ROLES),
  authority: z.enum(MSSR_CONSISTENCY_AUTHORITIES),
  state: z.enum(MSSR_CONSISTENCY_OBSERVATION_STATES),
  value: z.string().max(160).optional(),
  revision: z.string().max(160).optional(),
  required: z.boolean().optional(),
}).strict();

export const mssrConsistencyEvaluateInputSchema = z.object({
  boundary: z.enum(MSSR_CONSISTENCY_BOUNDARIES).default("ordinary"),
  observations: z.array(mssrConsistencyObservationSchema).max(64),
}).strict();

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Register the portable C2c evaluator on any MSSR MCP host. */
export function registerMssrConsistencyTools(server: McpServer): void {
  server.registerTool(MSSR_CONSISTENCY_TOOL_NAMES[0], {
    description: "Evaluate bounded structured claims with MSSR C2c and attach the C2d evidence-first recommendation plan. Freshness and current consistency remain separate. Advisory only: ranks inspect/verify/repair/replan candidates by evidence readiness, information gain, dependencies and risk; never reads, writes, rebuilds, installs, restarts or authorizes anything.",
    inputSchema: mssrConsistencyEvaluateInputSchema,
  }, async (input) => response(evaluateMssrConsistencyDecisionSupport(input)));
}
