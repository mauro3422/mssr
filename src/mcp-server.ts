import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { auditSkillRouting, planSkillRoute } from "./skill-routing.js";
import { CapabilityRegistry, FilesystemSkillProvider } from "./registry.js";

export const MSSR_TOOL_NAMES = [
  "mssr_registry_status",
  "mssr_capability_search",
  "mssr_capability_inspect",
  "mssr_route_plan",
  "mssr_route_audit",
] as const;

function response(value: unknown) { return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] }; }
function skills(registry: CapabilityRegistry) { return registry.getSnapshot().capabilities.flatMap((capability) => capability.kind === "skill" && capability.skill ? [capability.skill] : []); }

export function createMssrMcpServer(registry = new CapabilityRegistry([new FilesystemSkillProvider()])) {
  const server = new McpServer({ name: "mssr", version: "0.1.0" });
  server.registerTool(MSSR_TOOL_NAMES[0], {
    description: "Show provider health and the immutable MSSR capability snapshot; optionally refresh one or all providers first.",
    inputSchema: {
      refresh: z.boolean().optional(),
      providerIds: z.array(z.string()).optional(),
    },
  }, async ({ refresh, providerIds }) => response(refresh ? await registry.refresh(providerIds) : registry.getSnapshot()));
  server.registerTool(MSSR_TOOL_NAMES[1], { description: "Search discovered skills and tools. Results are advisory metadata, not live authorization.", inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() } }, async ({ query, limit }) => response({ query, matches: registry.search(query, limit) }));
  server.registerTool(MSSR_TOOL_NAMES[2], { description: "Inspect one discovered capability before calling its owning host.", inputSchema: { idOrName: z.string().min(1) } }, async ({ idOrName }) => response({ capability: registry.inspect(idOrName) ?? null }));
  server.registerTool(MSSR_TOOL_NAMES[3], { description: "Plan a phased skill route. This recommendation never grants or removes permissions and can be replanned.", inputSchema: { task: z.string().min(1), context: z.string().max(4000).optional(), intent: z.unknown().optional(), caller: z.enum(["codex-local", "chatgpt-web", "other"]).optional(), stage: z.enum(["start", "implement", "verify", "persist", "close", "resume"]).optional(), completedPhases: z.array(z.enum(["discovery", "safety", "implementation", "verification", "persistence", "maintenance"])).optional(), maxSkills: z.number().int().min(1).max(16).optional() } }, async (args) => response({ ...(await planSkillRoute({ ...args, skills: skills(registry) })), registry: registry.getSnapshot() }));
  server.registerTool(MSSR_TOOL_NAMES[4], {
    description: "Audit discovered skills against the tracked routing contract without changing permissions or configuration.",
    inputSchema: {},
  }, async () => response(await auditSkillRouting(skills(registry))));
  return { server, registry };
}

export async function startMssrStdioServer(): Promise<void> {
  const { server, registry } = createMssrMcpServer();
  await registry.refresh();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/mcp-server.js")) void startMssrStdioServer();
