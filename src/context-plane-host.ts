import { isDeepStrictEqual } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { loadProjectContextModuleManifest, loadProjectContextModules, type LoadProjectContextModulesResult } from "./project-context-loader.js";
import { collectRepositoryContextMessages, type MssrRepositoryProviderDiagnostic } from "./context-message-repository-provider.js";
import {
  mssrContextInboxConfigSchema,
  acknowledgeMssrContextMessages,
  createEmptyMssrContextInboxState,
  enqueueMssrContextMessages,
  loadMssrContextInboxStateFromFile,
  pruneMssrContextInbox,
  saveMssrContextInboxStateToFile,
  selectMssrContextInboxMessages,
  type MssrContextDeliveryReceipt,
  type MssrContextInboxConfig,
} from "./context-message-inbox.js";
import { mssrContextMessageBatchSchema, type MssrContextMessageSelection } from "./context-messages.js";
import { buildMssrKnowledgeRevisionSituation, evaluateMssrSituationModel, type MssrSituationModelResult } from "./situation-model.js";
import { buildMssrSituationContextFeedback, type MssrSituationContextFeedback } from "./situation-context-feedback.js";
import { SKILL_STAGES, structuredSkillIntentSchema } from "./skill-routing.js";
import { MSSR_PROJECT_CONTROL_FILES, mssrProjectRelativePath, resolveMssrProjectFile } from "./project-home.js";

export const MSSR_CONTEXT_INBOX_DEFAULT_RELATIVE_PATH = mssrProjectRelativePath(MSSR_PROJECT_CONTROL_FILES.contextInbox);
export const MAX_HOST_PROJECT_CONTEXT_CHARS = 20_000;
export const MAX_HOST_PROJECT_CONTEXT_MODULES = 32;
export const MAX_HOST_CONTEXT_MESSAGE_CHARS = 20_000;

/** Inbox overrides remain inside `.mssr/runtime/`; MSSR never reads `.bridge/`. */
export function resolveMssrContextInboxPath(projectRoot: string, inboxPath?: string): string {
  const relative = (inboxPath ?? MSSR_CONTEXT_INBOX_DEFAULT_RELATIVE_PATH).replace(/\\/g, "/");
  if (path.isAbsolute(relative)) throw new Error(`MSSR context inbox path must be relative, got absolute: ${relative}`);
  if (relative.split("/").includes("..")) throw new Error(`MSSR context inbox path must not traverse, got: ${relative}`);
  if (!relative.startsWith(".mssr/runtime/")) throw new Error(`MSSR context inbox must live under .mssr/runtime/: ${relative}`);
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(root, ...relative.split("/"));
  const rel = path.relative(root, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`MSSR context inbox path escapes project root: ${relative}`);
  return candidate;
}

export const projectContextHostInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  intent: structuredSkillIntentSchema,
  stage: z.enum(SKILL_STAGES),
  now: z.string().datetime({ offset: true }).optional(),
  maxProjectContextChars: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_CHARS).optional(),
  maxProjectContextModules: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_MODULES).optional(),
  includeCore: z.boolean().optional(),
  maxContextMessages: z.number().int().min(0).max(32).optional(),
  maxContextMessageChars: z.number().int().min(0).max(MAX_HOST_CONTEXT_MESSAGE_CHARS).optional(),
  inboxPath: z.string().min(1).max(240).optional(),
  inboxConfig: mssrContextInboxConfigSchema.optional(),
  contextMessages: mssrContextMessageBatchSchema.optional(),
}).strict();
export type ProjectContextHostInput = z.infer<typeof projectContextHostInputSchema>;

type InboxSource = "canonical" | "explicit" | "missing";

export type ProjectContextHostResult = {
  projectContext: LoadProjectContextModulesResult & { receipts: MssrContextDeliveryReceipt[] };
  contextMessages: MssrContextMessageSelection;
  inbox: {
    filePath: string;
    source: InboxSource;
    existing: boolean;
    loaded: boolean;
    prunedMessageIds: string[];
    prunedReceiptIds: string[];
    enqueued: string[];
    deduplicated: string[];
    overflow: string[];
    receiptOverflow: string[];
    saved: boolean;
    advisoryOnly: true;
  };
  repository: { observations: number; messages: number; diagnostics: MssrRepositoryProviderDiagnostic[]; overflow: string[] };
  situation: MssrSituationModelResult;
  contextFeedback: MssrSituationContextFeedback;
  advisoryOnly: true;
};

async function fileExists(filePath: string): Promise<boolean> {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function inboxLocation(parsed: ProjectContextHostInput, resolution: Awaited<ReturnType<typeof resolveMssrProjectFile>>) {
  if (parsed.inboxPath) return { filePath: resolveMssrContextInboxPath(parsed.projectRoot, parsed.inboxPath), source: "explicit" as const };
  return { filePath: resolution.absolutePath, source: resolution.source };
}

export async function loadProjectContextHost(input: ProjectContextHostInput, clock: () => Date = () => new Date()): Promise<ProjectContextHostResult> {
  const parsed = projectContextHostInputSchema.parse(input);
  const now = parsed.now ?? clock().toISOString();
  const inlineConfig: MssrContextInboxConfig | undefined = parsed.inboxConfig;
  const resolution = await resolveMssrProjectFile(parsed.projectRoot, MSSR_PROJECT_CONTROL_FILES.contextInbox);
  const { filePath, source } = inboxLocation(parsed, resolution);

  const projectContextBase = await loadProjectContextModules({
    projectRoot: parsed.projectRoot,
    intent: parsed.intent,
    stage: parsed.stage,
    ...(parsed.maxProjectContextChars !== undefined ? { maxChars: parsed.maxProjectContextChars } : {}),
    ...(parsed.maxProjectContextModules !== undefined ? { maxModules: parsed.maxProjectContextModules } : {}),
    ...(parsed.includeCore !== undefined ? { includeCore: parsed.includeCore } : {}),
  });
  const repository = await collectRepositoryContextMessages({ projectRoot: parsed.projectRoot, maxObservations: 32 });

  const existing = await fileExists(filePath);
  const loadedState = existing ? await loadMssrContextInboxStateFromFile(filePath) : createEmptyMssrContextInboxState();
  const pruned = pruneMssrContextInbox(loadedState, now, inlineConfig);
  let state = pruned.state;
  const enqueuedRepository = enqueueMssrContextMessages(state, repository.messages, now, inlineConfig);
  state = enqueuedRepository.state;
  const enqueuedCaller = parsed.contextMessages ? enqueueMssrContextMessages(state, parsed.contextMessages, now, inlineConfig) : null;
  if (enqueuedCaller) state = enqueuedCaller.state;
  const selected = selectMssrContextInboxMessages(state, {
    now,
    intent: parsed.intent,
    stage: parsed.stage,
    ...(parsed.maxContextMessages !== undefined ? { maxMessages: parsed.maxContextMessages } : {}),
    ...(parsed.maxContextMessageChars !== undefined ? { maxChars: parsed.maxContextMessageChars } : {}),
  }, inlineConfig);
  state = selected.state;

  const changed = !isDeepStrictEqual(state, loadedState);
  if (changed) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await saveMssrContextInboxStateToFile(filePath, state);
  }

  const situationObservations = buildMssrKnowledgeRevisionSituation({
    repositoryObservations: repository.observations,
    selectedMessages: selected.selection.selected,
    deliveryReceipts: state.deliveries,
  });
  const situation = evaluateMssrSituationModel({ boundary: "context-load", observations: situationObservations });
  const manifestResult = projectContextBase.manifestStatus === "loaded"
    ? await loadProjectContextModuleManifest(parsed.projectRoot)
    : null;
  const contextFeedback = buildMssrSituationContextFeedback({
    situation,
    manifest: manifestResult?.found ? manifestResult.manifest : null,
  });

  return {
    projectContext: { ...projectContextBase, receipts: state.deliveries },
    contextMessages: selected.selection,
    inbox: {
      filePath,
      source: parsed.inboxPath ? "explicit" : source,
      existing,
      loaded: existing,
      prunedMessageIds: pruned.prunedMessageIds,
      prunedReceiptIds: pruned.prunedReceiptIds,
      enqueued: [...enqueuedRepository.enqueued, ...(enqueuedCaller?.enqueued ?? [])],
      deduplicated: [...enqueuedRepository.deduplicated, ...(enqueuedCaller?.deduplicated ?? [])],
      overflow: [...enqueuedRepository.overflow, ...(enqueuedCaller?.overflow ?? [])],
      receiptOverflow: selected.receiptOverflow,
      saved: changed,
      advisoryOnly: true,
    },
    repository: { observations: repository.observations.length, messages: repository.messages.length, diagnostics: repository.diagnostics, overflow: repository.overflow },
    situation,
    contextFeedback,
    advisoryOnly: true,
  };
}

export const projectContextAcknowledgeInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  messageIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,119}$/)).min(1).max(32),
  now: z.string().datetime({ offset: true }).optional(),
  inboxPath: z.string().min(1).max(240).optional(),
  inboxConfig: mssrContextInboxConfigSchema.optional(),
}).strict();
export type ProjectContextAcknowledgeInput = z.infer<typeof projectContextAcknowledgeInputSchema>;

export type ProjectContextAcknowledgeResult = {
  acknowledged: string[];
  unknown: string[];
  filePath: string;
  source: InboxSource;
  existing: boolean;
  saved: boolean;
  advisoryOnly: true;
};

export async function acknowledgeProjectContextInbox(input: ProjectContextAcknowledgeInput, clock: () => Date = () => new Date()): Promise<ProjectContextAcknowledgeResult> {
  const parsed = projectContextAcknowledgeInputSchema.parse(input);
  const now = parsed.now ?? clock().toISOString();
  const resolution = await resolveMssrProjectFile(parsed.projectRoot, MSSR_PROJECT_CONTROL_FILES.contextInbox);
  const filePath = parsed.inboxPath ? resolveMssrContextInboxPath(parsed.projectRoot, parsed.inboxPath) : resolution.absolutePath;
  const source: InboxSource = parsed.inboxPath ? "explicit" : resolution.source;
  const existing = await fileExists(filePath);
  const loadedState = existing ? await loadMssrContextInboxStateFromFile(filePath) : createEmptyMssrContextInboxState();
  const acknowledged = acknowledgeMssrContextMessages(loadedState, parsed.messageIds, now, parsed.inboxConfig);
  const changed = acknowledged.acknowledged.length > 0 && !isDeepStrictEqual(acknowledged.state, loadedState);
  if (changed) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await saveMssrContextInboxStateToFile(filePath, acknowledged.state);
  }
  return { acknowledged: acknowledged.acknowledged, unknown: acknowledged.unknown, filePath, source, existing, saved: changed, advisoryOnly: true };
}
