import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  initializeMssrProject,
  initializeMssrWorkspace,
  type InitializeMssrProjectOptions,
} from "./project-initialization.js";
import { auditMssrProjectContextHealth } from "./project-context-health.js";
import {
  mssrProjectKnowledgeCaptureInputSchema,
  planMssrProjectKnowledgeCapture,
  type MssrProjectKnowledgeCaptureInput,
} from "./project-context-capture.js";
import { planMssrProjectContextModularization } from "./project-context-modularization.js";

export const MSSR_PROJECT_CONTROL_TOOL_NAMES = [
  "mssr_project_health",
  "mssr_project_initialize",
  "mssr_workspace_initialize",
  "mssr_project_capture_plan",
  "mssr_project_modularization_plan",
] as const;

export const mssrProjectHealthInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
}).strict();

export const mssrProjectInitializeInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  initializeMissing: z.boolean().default(true),
  cleanupLegacyArtifacts: z.boolean().default(true),
}).strict();

export const mssrWorkspaceInitializeInputSchema = z.object({
  workspaceRoot: z.string().min(1).max(4096),
  initializeMissing: z.boolean().default(true),
  cleanupLegacyArtifacts: z.boolean().default(true),
  maxDepth: z.number().int().min(0).max(8).default(2),
}).strict();

export const mssrProjectCapturePlanInputSchema = mssrProjectKnowledgeCaptureInputSchema;
export const mssrProjectModularizationPlanInputSchema = mssrProjectHealthInputSchema;

export interface MssrProjectControlAdapter {
  projectHealth(projectRoot: string): Promise<unknown> | unknown;
  initializeProject(projectRoot: string, options?: InitializeMssrProjectOptions): Promise<unknown> | unknown;
  initializeWorkspace(workspaceRoot: string, options?: InitializeMssrProjectOptions & { maxDepth?: number }): Promise<unknown> | unknown;
  planProjectKnowledgeCapture(input: MssrProjectKnowledgeCaptureInput): Promise<unknown> | unknown;
  planProjectContextModularization(projectRoot: string): Promise<unknown> | unknown;
}

export function createPortableMssrProjectControlAdapter(): MssrProjectControlAdapter {
  return {
    projectHealth: (projectRoot) => auditMssrProjectContextHealth(projectRoot),
    initializeProject: (projectRoot, options) => initializeMssrProject(projectRoot, options),
    initializeWorkspace: (workspaceRoot, options) => initializeMssrWorkspace(workspaceRoot, options),
    planProjectKnowledgeCapture: (input) => planMssrProjectKnowledgeCapture(input),
    planProjectContextModularization: (projectRoot) => planMssrProjectContextModularization(projectRoot),
  };
}

function response(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Register the portable MSSR project-control surface on any MCP host.
 *
 * The schemas and semantics live here so native, Codex, OpenCode and Bridge-like
 * adapters cannot drift independently. Initialization is explicit and idempotent;
 * health/capture planning are advisory. Durable knowledge still requires a reviewed
 * host write rather than an automatic mutation from telemetry.
 */
export function registerMssrProjectControlTools(
  server: McpServer,
  adapter: MssrProjectControlAdapter = createPortableMssrProjectControlAdapter(),
): void {
  server.registerTool(MSSR_PROJECT_CONTROL_TOOL_NAMES[0], {
    description: "Audit one repository's canonical .mssr project-control health. Reports initialization, module growth, missing sources, unindexed knowledge and historical .bridge MSSR artifacts as advisory evidence; never writes.",
    inputSchema: mssrProjectHealthInputSchema,
  }, async ({ projectRoot }) => response(await adapter.projectHealth(projectRoot)));

  server.registerTool(MSSR_PROJECT_CONTROL_TOOL_NAMES[1], {
    description: "Explicitly initialize or normalize one repository under the canonical .mssr contract. Idempotent; creates only bounded skeleton/control structure, never invents project facts, and refuses to erase a durable historical MSSR authority that lacks a canonical counterpart.",
    inputSchema: mssrProjectInitializeInputSchema,
  }, async ({ projectRoot, initializeMissing, cleanupLegacyArtifacts }) => response(await adapter.initializeProject(projectRoot, {
    initializeMissing,
    cleanupLegacyArtifacts,
  })));

  server.registerTool(MSSR_PROJECT_CONTROL_TOOL_NAMES[2], {
    description: "Discover Git repositories recursively under a workspace and apply the same explicit idempotent MSSR initialization contract to each. Skips generated/snapshot directories and reports blocked repositories instead of fabricating or erasing durable knowledge.",
    inputSchema: mssrWorkspaceInitializeInputSchema,
  }, async ({ workspaceRoot, initializeMissing, cleanupLegacyArtifacts, maxDepth }) => response(await adapter.initializeWorkspace(workspaceRoot, {
    initializeMissing,
    cleanupLegacyArtifacts,
    maxDepth,
  })));

  server.registerTool(MSSR_PROJECT_CONTROL_TOOL_NAMES[3], {
    description: "Plan one reviewed durable project-knowledge capture into .mssr/knowledge/<topic>/ plus its validated project-context module. Planning only: no file is written and raw conversations, secrets, transient tool output, or private reasoning must not be persisted.",
    inputSchema: mssrProjectCapturePlanInputSchema,
  }, async (input) => response(await adapter.planProjectKnowledgeCapture(input)));

  server.registerTool(MSSR_PROJECT_CONTROL_TOOL_NAMES[4], {
    description: "Plan how to reduce Project Context Health pressure by moving exact already-indexed Markdown sections from growing PROJECT_* authorities into .mssr/knowledge/<topic>/. Read-only: reports section hashes, sizes, suggested paths/module ids, selector preservation and core decisions; never mutates or semantically rewrites knowledge.",
    inputSchema: mssrProjectModularizationPlanInputSchema,
  }, async ({ projectRoot }) => response(await adapter.planProjectContextModularization(projectRoot)));
}
