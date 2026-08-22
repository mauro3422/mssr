import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { mssrHostRouteInputSchema } from "./host-adapter-contract.js";
import { CodexMssrAdapter } from "./codex-adapter.js";
import { createMssrRegistryFromEnvironment } from "./provider-config.js";
import { createMssrTelemetrySinkFromEnvironment, mssrHostCheckpointSchema } from "./telemetry.js";
import { mssrTraceWorkingMemorySchema } from "./trace-contract.js";
import { registerMssrProjectControlTools } from "./project-control-contract.js";
import { registerMssrConsistencyTools } from "./consistency-contract.js";
import { registerMssrOperationalNoticeTools } from "./operational-notice-contract.js";
import { registerMssrHostConformanceTools } from "./host-conformance-contract.js";

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

const routeInput = mssrHostRouteInputSchema;

const contextAckInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  messageIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/)).min(1).max(32),
  now: z.string().datetime({ offset: true }).optional(),
}).strict();

/** MCP entrypoint for the stateful Codex-local MSSR adapter. */
export function createCodexMssrMcpServer(adapter = new CodexMssrAdapter()) {
  const server = new McpServer({ name: "mssr-codex", version: "0.2.1" });
  registerMssrProjectControlTools(server, adapter);
  registerMssrConsistencyTools(server);
  registerMssrOperationalNoticeTools(server);
  registerMssrHostConformanceTools(server);

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

  server.registerTool("mssr_trace_working_update", {
    description: "Store bounded ephemeral working metadata for one open trace; it is purged on outcome and must not contain raw prompts, transcripts, secrets, or private chain-of-thought.",
    inputSchema: { traceId: z.string().min(6).max(128), workingMemory: mssrTraceWorkingMemorySchema },
  }, async ({ traceId, workingMemory }) => response(adapter.updateWorkingMemory(traceId, workingMemory)));

  server.registerTool("mssr_trace_status", {
    description: "Read one Codex-local MSSR trace lifecycle, closure gates, and any ephemeral working metadata.",
    inputSchema: { traceId: z.string().min(6).max(128) },
  }, async ({ traceId }) => response({ traceId, ...adapter.getTraceStatus(traceId) }));

  server.registerTool("mssr_context_ack", {
    description: "Acknowledge delivered MSSR context messages for one project's durable inbox. Only explicit delivery confirmation persists; selection alone never acknowledges.",
    inputSchema: contextAckInputSchema,
  }, async ({ projectRoot, messageIds, now }) => response(await adapter.acknowledgeContextMessages(projectRoot, messageIds, now)));

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
