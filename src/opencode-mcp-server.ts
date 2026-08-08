import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CodexMssrAdapter } from "./codex-adapter.js";
import { createMssrRegistryFromEnvironment } from "./provider-config.js";
import { SKILL_PHASES, SKILL_STAGES, structuredSkillIntentSchema } from "./skill-routing.js";
import { createMssrTelemetrySinkFromEnvironment, mssrHostCheckpointSchema } from "./telemetry.js";

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
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

/** Stateful OpenCode-local adapter. Execution remains owned by OpenCode and its configured providers. */
export function createOpenCodeMssrMcpServer(adapter: CodexMssrAdapter) {
  const server = new McpServer({ name: "mssr-opencode", version: "0.2.1" });

  server.registerTool("mssr_route_plan", {
    description: "Plan an advisory MSSR route for OpenCode-local and return a persistent traceId.",
    inputSchema: routeInput,
  }, async (args) => response(await adapter.route(args)));

  server.registerTool("mssr_skill_bootstrap", {
    description: "Plan an OpenCode-local route and load its active local skills on the same observable trace.",
    inputSchema: routeInput,
  }, async (args) => response(await adapter.bootstrap(args)));

  server.registerTool("mssr_trace_record", {
    description: "Record one explicit OpenCode-local lifecycle checkpoint. Never records success automatically.",
    inputSchema: { traceId: z.string().min(6).max(128), ...mssrHostCheckpointSchema.shape },
  }, async ({ traceId, ...checkpoint }) => response(await adapter.checkpoint(traceId, checkpoint)));

  server.registerTool("mssr_trace_status", {
    description: "Read adapter-local lifecycle state for one OpenCode MSSR trace.",
    inputSchema: { traceId: z.string().min(6).max(128) },
  }, async ({ traceId }) => response({ traceId, state: adapter.getTrace(traceId) }));

  server.registerTool("mssr_registry_status", {
    description: "Show the current advisory capability snapshot and provider health.",
    inputSchema: { refresh: z.boolean().optional(), providerIds: z.array(z.string()).optional() },
  }, async ({ refresh, providerIds }) => response(refresh ? await adapter.registry.refresh(providerIds) : adapter.registry.getSnapshot()));

  server.registerTool("mssr_capability_search", {
    description: "Search discovered capability metadata without executing tools.",
    inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() },
  }, async ({ query, limit }) => response({ query, matches: adapter.registry.search(query, limit) }));

  server.registerTool("mssr_capability_inspect", {
    description: "Inspect one capability metadata record without executing it.",
    inputSchema: { idOrName: z.string().min(1) },
  }, async ({ idOrName }) => response({ capability: adapter.registry.inspect(idOrName) ?? null }));

  return { server, adapter };
}

export async function startOpenCodeMssrServer(): Promise<void> {
  const registry = await createMssrRegistryFromEnvironment();
  const adapter = new CodexMssrAdapter(registry, {
    caller: "opencode-local",
    source: "opencode-cli",
    tracePrefix: "mssr-opencode",
    telemetrySink: createMssrTelemetrySinkFromEnvironment(),
    model: process.env.MSSR_HOST_MODEL || "unknown",
    reasoningEffort: (process.env.MSSR_HOST_REASONING_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown" | undefined) ?? "unknown",
  });
  const { server } = createOpenCodeMssrMcpServer(adapter);
  await adapter.initialize();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/opencode-mcp-server.js")) void startOpenCodeMssrServer();
