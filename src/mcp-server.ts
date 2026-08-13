import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_CALLERS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_PHASES,
  SKILL_RISKS,
  SKILL_SIGNALS,
  SKILL_SOURCES,
  SKILL_STAGES,
  auditSkillRouting,
  planSkillRoute,
} from "./skill-routing.js";
import { normalizeMssrIntent } from "./intent-normalizer.js";
import { CapabilityRegistry, FilesystemSkillProvider, MssrFirstPartySkillProvider } from "./registry.js";
import { createMssrRegistryFromEnvironment } from "./provider-config.js";
import {
  MSSR_CHECKPOINT_TYPES,
  MSSR_OUTCOME_DIMENSION_STATUSES,
  MSSR_OUTCOME_EVIDENCE_KINDS,
  MSSR_SKILL_DECISIONS,
  MSSR_SKILL_DECISION_REASONS,
  MSSR_TRACE_CONTRACT_VERSION,
  getMssrTraceClosureState,
  mssrTraceLifecycleStateSchema,
  reduceMssrCheckpointLifecycle,
  reduceMssrRouteLifecycle,
  reduceMssrSkillLoadLifecycle,
  validateMssrCheckpointLifecycle,
} from "./trace-contract.js";

/** The portable, stateless MSSR MCP facade. */
export const MSSR_TOOL_NAMES = [
  "mssr_registry_status",
  "mssr_capability_search",
  "mssr_capability_inspect",
  "mssr_route_plan",
  "mssr_route_audit",
  "mssr_intent_normalize",
  "mssr_vocabulary",
  "mssr_trace_validate",
  "mssr_trace_reduce",
] as const;

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

function skills(registry: CapabilityRegistry) {
  return registry.getSnapshot().capabilities.flatMap((capability) =>
    capability.kind === "skill" && capability.skill ? [capability.skill] : [],
  );
}

const traceEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("route"), route: z.unknown() }),
  z.object({ type: z.literal("skill_load"), name: z.string().min(1) }),
  z.object({ type: z.literal("checkpoint"), checkpoint: z.unknown() }),
]);

export function createMssrMcpServer(registry = new CapabilityRegistry([new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()])) {
  const server = new McpServer({ name: "mssr", version: "0.2.1" });

  server.registerTool(MSSR_TOOL_NAMES[0], {
    description: "Show the immutable MSSR capability snapshot and provider health. Optionally refresh providers first.",
    inputSchema: { refresh: z.boolean().optional(), providerIds: z.array(z.string()).optional() },
  }, async ({ refresh, providerIds }) => response(refresh ? await registry.refresh(providerIds) : registry.getSnapshot()));

  server.registerTool(MSSR_TOOL_NAMES[1], {
    description: "Search discovered MSSR capabilities. Results are metadata and never authorization.",
    inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() },
  }, async ({ query, limit }) => response({ query, matches: registry.search(query, limit) }));

  server.registerTool(MSSR_TOOL_NAMES[2], {
    description: "Inspect one discovered capability without executing it.",
    inputSchema: { idOrName: z.string().min(1) },
  }, async ({ idOrName }) => response({ capability: registry.inspect(idOrName) ?? null }));

  server.registerTool(MSSR_TOOL_NAMES[3], {
    description: "Plan a phase-scoped MSSR skill route. Advisory only.",
    inputSchema: {
      task: z.string().min(1),
      context: z.string().max(4000).optional(),
      intent: z.unknown().optional(),
      caller: z.enum(SKILL_CALLERS).optional(),
      stage: z.enum(SKILL_STAGES).optional(),
      completedPhases: z.array(z.enum(SKILL_PHASES)).optional(),
      maxSkills: z.number().int().min(1).max(16).optional(),
    },
  }, async (args) => response({ ...(await planSkillRoute({ ...args, skills: skills(registry) })), registry: registry.getSnapshot() }));

  server.registerTool(MSSR_TOOL_NAMES[4], {
    description: "Audit discovered skills against the MSSR routing contract.",
    inputSchema: {},
  }, async () => response(await auditSkillRouting(skills(registry))));

  server.registerTool(MSSR_TOOL_NAMES[5], {
    description: "Normalize an MSSR structured intent using the portable canonical vocabulary.",
    inputSchema: { intent: z.unknown() },
  }, async ({ intent }) => response(normalizeMssrIntent(intent)));

  server.registerTool(MSSR_TOOL_NAMES[6], {
    description: "Return the canonical portable MSSR routing and trace vocabulary.",
    inputSchema: {},
  }, async () => response({
    traceContract: MSSR_TRACE_CONTRACT_VERSION,
    routing: {
      domains: SKILL_DOMAINS,
      actions: SKILL_ACTIONS,
      artifacts: SKILL_ARTIFACTS,
      needs: SKILL_NEEDS,
      signals: SKILL_SIGNALS,
      risks: SKILL_RISKS,
      skillSources: SKILL_SOURCES,
      stages: SKILL_STAGES,
      phases: SKILL_PHASES,
      callers: SKILL_CALLERS,
    },
    trace: {
      checkpointTypes: MSSR_CHECKPOINT_TYPES,
      evidenceKinds: MSSR_OUTCOME_EVIDENCE_KINDS,
      dimensionStatuses: MSSR_OUTCOME_DIMENSION_STATUSES,
      skillDecisions: MSSR_SKILL_DECISIONS,
      skillDecisionReasons: MSSR_SKILL_DECISION_REASONS,
    },
  }));

  server.registerTool(MSSR_TOOL_NAMES[7], {
    description: "Validate one MSSR trace checkpoint against a portable lifecycle state without storing anything.",
    inputSchema: { state: z.unknown().optional(), checkpoint: z.unknown() },
  }, async ({ state, checkpoint }) => {
    const parsedState = state === undefined ? null : mssrTraceLifecycleStateSchema.parse(state);
    return response({
      violations: validateMssrCheckpointLifecycle(parsedState, checkpoint),
      closure: parsedState ? getMssrTraceClosureState(parsedState) : null,
    });
  });

  server.registerTool(MSSR_TOOL_NAMES[8], {
    description: "Apply one portable MSSR lifecycle event. The caller owns persistence and execution.",
    inputSchema: { state: z.unknown().optional(), event: traceEventSchema },
  }, async ({ state, event }) => {
    const previous = state === undefined ? null : mssrTraceLifecycleStateSchema.parse(state);
    if (event.type === "route") return response({ state: reduceMssrRouteLifecycle(previous, event.route) });
    if (!previous) throw new Error("A lifecycle state is required before skill_load or checkpoint events.");
    if (event.type === "skill_load") return response({ state: reduceMssrSkillLoadLifecycle(previous, event.name) });
    return response({ state: reduceMssrCheckpointLifecycle(previous, event.checkpoint) });
  });

  return { server, registry };
}

export async function startMssrStdioServer(): Promise<void> {
  const registry = await createMssrRegistryFromEnvironment();
  const { server } = createMssrMcpServer(registry);
  await registry.refresh();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/mcp-server.js")) void startMssrStdioServer();
