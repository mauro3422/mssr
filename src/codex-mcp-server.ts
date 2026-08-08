import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SKILL_PHASES, SKILL_STAGES, structuredSkillIntentSchema } from "./skill-routing.js";
import { CodexMssrAdapter } from "./codex-adapter.js";
import { createMssrRegistryFromEnvironment } from "./provider-config.js";
import { createMssrTelemetrySinkFromEnvironment, mssrHostCheckpointSchema } from "./telemetry.js";

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const routeInput = {
  task: z.string().min(1),
  context: z.string().max(4000).optional(),
  intent: structuredSkillIntentSchema,
  stage: z.enum(SKILL_STAGES).optional(),
  completedPhases: z.array(z.enum(SKILL_PHASES)).optional(),
  maxSkills: z.number().int().min(1).max(16).optional(),
  traceId: z.string().min(6).max(128).optional(),
  workflowKey: z.string().min(1).max(160).optional(),
  model: z.string().min(1).max(80).optional(),
  reasoningEffort: z.enum(["low", "medium", "high", "xhigh", "max", "ultra", "unknown"]).optional(),
};

/** MCP entrypoint for the stateful Codex-local MSSR adapter. */
export function createCodexMssrMcpServer(adapter = new CodexMssrAdapter()) {
  const server = new McpServer({ name: "mssr-codex", version: "0.2.1" });

  server.registerTool("skill_route_plan", {
    description: "Plan an MSSR route for Codex-local without MauroPrime Bridge.",
    inputSchema: routeInput,
  }, async (args) => response(await adapter.route(args)));

  server.registerTool("skill_bootstrap", {
    description: "Plan an MSSR route and load active local Codex skills without MauroPrime Bridge.",
    inputSchema: routeInput,
  }, async (args) => response(await adapter.bootstrap(args)));

  server.registerTool("mssr_trace_record", {
    description: "Record one Codex-local MSSR lifecycle checkpoint in adapter-local trace state.",
    inputSchema: { traceId: z.string().min(6).max(128), ...mssrHostCheckpointSchema.shape },
  }, async ({ traceId, ...checkpoint }) => response(await adapter.checkpoint(traceId, checkpoint)));

  server.registerTool("mssr_trace_status", {
    description: "Read one Codex-local MSSR trace state.",
    inputSchema: { traceId: z.string().min(6).max(128) },
  }, async ({ traceId }) => response({ traceId, state: adapter.getTrace(traceId) }));

  return { server, adapter };
}

export async function startCodexMssrServer(): Promise<void> {
  const registry = await createMssrRegistryFromEnvironment();
  const adapter = new CodexMssrAdapter(registry, {
    telemetrySink: createMssrTelemetrySinkFromEnvironment(),
    model: process.env.MSSR_HOST_MODEL || "unknown",
    reasoningEffort: (process.env.MSSR_HOST_REASONING_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown" | undefined) ?? "unknown",
  });
  const { server } = createCodexMssrMcpServer(adapter);
  await adapter.initialize();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/codex-mcp-server.js")) void startCodexMssrServer();
