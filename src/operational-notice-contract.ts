import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  MSSR_OPERATIONAL_NOTICE_LEVELS,
  evaluateMssrOperationalNoticeTransition,
} from "./operational-notices.js";

/**
 * Gate D exposes one portable evaluator contract; Gate E1 promotes each emitted
 * candidate into a strict `MssrNotice v1` semantic payload.
 *
 * This tool evaluates bounded transition evidence only. It does not enqueue,
 * persist, push, display, or execute a notice. Every host remains responsible
 * for delivering the returned advisory payload without changing its meaning.
 */
export const MSSR_OPERATIONAL_NOTICE_TOOL_NAMES = ["mssr_operational_notice_evaluate"] as const;

const boundedSingleLine = (max: number) => z.string().min(1).max(max).refine(
  (value) => !/[\r\n]/.test(value),
  "Operational notice identifiers and fingerprints must be bounded single-line values.",
);

export const mssrOperationalNoticeEvaluateInputSchema = z.object({
  subject: boundedSingleLine(160),
  source: boundedSingleLine(120),
  code: boundedSingleLine(120),
  resolutionCode: boundedSingleLine(120).optional(),
  currentLevel: z.enum(MSSR_OPERATIONAL_NOTICE_LEVELS),
  previousLevel: z.enum(MSSR_OPERATIONAL_NOTICE_LEVELS).nullable().optional(),
  currentFingerprint: boundedSingleLine(240).nullable().optional(),
  previousFingerprint: boundedSingleLine(240).nullable().optional(),
  message: z.string().min(1).max(600),
  resolutionMessage: z.string().min(1).max(600).optional(),
  recommendation: z.string().min(1).max(600).optional(),
  notifyOnWatch: z.boolean().optional(),
}).strict();

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

/** Register the same host-neutral transition evaluator on every MSSR MCP host. */
export function registerMssrOperationalNoticeTools(server: McpServer): void {
  server.registerTool(MSSR_OPERATIONAL_NOTICE_TOOL_NAMES[0], {
    description: "Evaluate one bounded Operational Notice transition with portable MSSR semantics. Emits a strict advisory MssrNotice v1 or a quiet decision; never queues, pushes, persists, displays, executes, or authorizes the recommendation. The consuming host owns delivery transport and timing.",
    inputSchema: mssrOperationalNoticeEvaluateInputSchema,
  }, async (input) => response(evaluateMssrOperationalNoticeTransition(input)));
}
