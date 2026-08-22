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
  structuredSkillIntentSchema,
} from "./skill-routing.js";
import { normalizeMssrIntent } from "./intent-normalizer.js";
import { MSSR_PROJECT_CONTROL_TOOL_NAMES, registerMssrProjectControlTools } from "./project-control-contract.js";
import { MSSR_CONSISTENCY_TOOL_NAMES, registerMssrConsistencyTools } from "./consistency-contract.js";
import { MSSR_OPERATIONAL_NOTICE_TOOL_NAMES, registerMssrOperationalNoticeTools } from "./operational-notice-contract.js";
import { MSSR_HOST_CONFORMANCE_TOOL_NAMES, registerMssrHostConformanceTools } from "./host-conformance-contract.js";
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
import { mssrContextMessageBatchSchema, selectMssrContextMessages } from "./context-messages.js";
import {
  MAX_HOST_CONTEXT_MESSAGE_CHARS,
  MAX_HOST_PROJECT_CONTEXT_CHARS,
  MAX_HOST_PROJECT_CONTEXT_MODULES,
  acknowledgeProjectContextInbox,
  loadProjectContextHost,
} from "./context-plane-host.js";

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
  "mssr_context_ack",
  ...MSSR_CONSISTENCY_TOOL_NAMES,
  ...MSSR_OPERATIONAL_NOTICE_TOOL_NAMES,
  ...MSSR_PROJECT_CONTROL_TOOL_NAMES,
  ...MSSR_HOST_CONFORMANCE_TOOL_NAMES,
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

const nativeRouteInputSchema = z.object({
  task: z.string().min(1),
  context: z.string().max(4000).optional(),
  intent: z.unknown().optional(),
  caller: z.enum(SKILL_CALLERS).optional(),
  stage: z.enum(SKILL_STAGES).optional(),
  completedPhases: z.array(z.enum(SKILL_PHASES)).optional(),
  maxSkills: z.number().int().min(1).max(16).optional(),
  contextMessages: mssrContextMessageBatchSchema.optional(),
  maxContextMessages: z.number().int().min(0).max(32).optional(),
  maxContextMessageChars: z.number().int().min(0).max(20_000).optional(),
  projectRoot: z.string().min(1).max(4096).optional(),
  contextNow: z.string().datetime({ offset: true }).optional(),
  contextMaxChars: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_CHARS).optional(),
  contextMaxModules: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_MODULES).optional(),
  contextIncludeCore: z.boolean().optional(),
  contextMessageMaxChars: z.number().int().min(0).max(MAX_HOST_CONTEXT_MESSAGE_CHARS).optional(),
  contextMessageMaxMessages: z.number().int().min(0).max(32).optional(),
}).strict();

const nativeContextAckInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  messageIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/)).min(1).max(32),
  now: z.string().datetime({ offset: true }).optional(),
}).strict();

export function createMssrMcpServer(registry = new CapabilityRegistry([new MssrFirstPartySkillProvider(), new FilesystemSkillProvider()])) {
  const server = new McpServer({ name: "mssr", version: "0.2.1" });
  registerMssrProjectControlTools(server);
  registerMssrConsistencyTools(server);
  registerMssrOperationalNoticeTools(server);
  registerMssrHostConformanceTools(server);

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
    description: "Plan a phase-scoped MSSR skill route. Advisory only. When projectRoot is provided, the route resolves the project context plane through the same host helper as the Codex/OpenCode adapters.",
    inputSchema: nativeRouteInputSchema,
  }, async ({ intent, contextMessages, maxContextMessages, maxContextMessageChars, projectRoot, contextNow, contextMaxChars, contextMaxModules, contextIncludeCore, contextMessageMaxChars, contextMessageMaxMessages, ...args }) => {
    const plan = await planSkillRoute({ ...args, intent, skills: skills(registry) });
    if (projectRoot) {
      const host = await loadProjectContextHost({
        projectRoot,
        intent: intent === undefined ? plan.intent : structuredSkillIntentSchema.parse(intent),
        stage: plan.stage,
        ...(contextNow ? { now: contextNow } : {}),
        ...(contextMaxChars !== undefined ? { maxProjectContextChars: contextMaxChars } : {}),
        ...(contextMaxModules !== undefined ? { maxProjectContextModules: contextMaxModules } : {}),
        ...(contextIncludeCore !== undefined ? { includeCore: contextIncludeCore } : {}),
        ...(contextMessageMaxChars !== undefined || maxContextMessageChars !== undefined ? { maxContextMessageChars: contextMessageMaxChars ?? maxContextMessageChars } : {}),
        ...(contextMessageMaxMessages !== undefined || maxContextMessages !== undefined ? { maxContextMessages: contextMessageMaxMessages ?? maxContextMessages } : {}),
        ...(contextMessages ? { contextMessages } : {}),
      });
      return response({
        ...plan,
        projectContext: host.projectContext,
        contextMessages: host.contextMessages,
        inbox: host.inbox,
        repository: host.repository,
        registry: registry.getSnapshot(),
      });
    }
    return response({
      ...plan,
      ...(contextMessages ? {
        contextMessages: selectMssrContextMessages({
          messages: contextMessages,
          intent: plan.intent,
          stage: plan.stage,
          maxMessages: maxContextMessages,
          maxChars: maxContextMessageChars,
        }),
      } : {}),
      registry: registry.getSnapshot(),
    });
  });

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

  server.registerTool(MSSR_TOOL_NAMES[9], {
    description: "Acknowledge delivered MSSR context messages for one project's durable inbox. Only explicit delivery confirmation persists; selection alone never acknowledges.",
    inputSchema: nativeContextAckInputSchema,
  }, async ({ projectRoot, messageIds, now }) => response(await acknowledgeProjectContextInbox({
    projectRoot,
    messageIds,
    ...(now ? { now } : {}),
  })));

  return { server, registry };
}

export async function startMssrStdioServer(): Promise<void> {
  const registry = await createMssrRegistryFromEnvironment();
  const { server } = createMssrMcpServer(registry);
  await registry.refresh();
  await server.connect(new StdioServerTransport());
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("/mcp-server.js")) void startMssrStdioServer();
