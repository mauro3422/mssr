import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OpenCodeMssrAdapter } from "./opencode-adapter.js";
import { createMssrRegistryFromEnvironment } from "./provider-config.js";
import { mssrHostRouteInputSchema } from "./host-adapter-contract.js";
import { createMssrTelemetrySinkFromEnvironment, mssrHostCheckpointSchema } from "./telemetry.js";
import { registerMssrProjectControlTools } from "./project-control-contract.js";
import { registerMssrConsistencyTools } from "./consistency-contract.js";
import { registerMssrOperationalNoticeTools } from "./operational-notice-contract.js";

function response(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

const routeInput = mssrHostRouteInputSchema;

const contextAckInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  messageIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/)).min(1).max(32),
  now: z.string().datetime({ offset: true }).optional(),
}).strict();

/** Stateful OpenCode-local adapter. Execution remains owned by OpenCode and its configured providers. */
export function createOpenCodeMssrMcpServer(adapter: OpenCodeMssrAdapter) {
  const server = new McpServer({ name: "mssr-opencode", version: "0.2.1" });
  registerMssrProjectControlTools(server, adapter);
  registerMssrConsistencyTools(server);
  registerMssrOperationalNoticeTools(server);

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

  server.registerTool("mssr_context_ack", {
    description: "Acknowledge delivered MSSR context messages for one project's durable inbox. Only explicit delivery confirmation persists; selection alone never acknowledges.",
    inputSchema: contextAckInputSchema,
  }, async ({ projectRoot, messageIds, now }) => response(await adapter.acknowledgeContextMessages(projectRoot, messageIds, now)));

  return { server, adapter };
}

export async function startOpenCodeMssrServer(): Promise<void> {
  const registry = await createMssrRegistryFromEnvironment();
  const adapter = new OpenCodeMssrAdapter(registry, {
    telemetrySink: createMssrTelemetrySinkFromEnvironment(),
    model: process.env.MSSR_HOST_MODEL || "unknown",
    reasoningEffort: (process.env.MSSR_HOST_REASONING_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | "ultra" | "unknown" | undefined) ?? "unknown",
  });
  const { server } = createOpenCodeMssrMcpServer(adapter);
  await adapter.initialize();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/opencode-mcp-server.js")) void startOpenCodeMssrServer();
