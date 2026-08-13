import { isDeepStrictEqual } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  loadProjectContextModules,
  type LoadProjectContextModulesResult,
} from "./project-context-loader.js";
import {
  collectRepositoryContextMessages,
  type MssrRepositoryProviderDiagnostic,
} from "./context-message-repository-provider.js";
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
import {
  mssrContextMessageBatchSchema,
  type MssrContextMessageSelection,
} from "./context-messages.js";
import {
  SKILL_STAGES,
  structuredSkillIntentSchema,
} from "./skill-routing.js";

export const MSSR_CONTEXT_INBOX_DEFAULT_RELATIVE_PATH = path.join(".bridge", "mssr-context-inbox.json");

export const MAX_HOST_PROJECT_CONTEXT_CHARS = 20_000;
export const MAX_HOST_PROJECT_CONTEXT_MODULES = 32;
export const MAX_HOST_CONTEXT_MESSAGE_CHARS = 20_000;

/**
 * Resolves the deterministic, safe inbox file path under the project root.
 * Absolute paths and `..` traversal are rejected fail-closed so a caller can
 * never redirect the durable inbox outside the project it nominates.
 */
export function resolveMssrContextInboxPath(projectRoot: string, inboxPath?: string): string {
  const relative = inboxPath ?? MSSR_CONTEXT_INBOX_DEFAULT_RELATIVE_PATH;
  if (path.isAbsolute(relative)) {
    throw new Error(`MSSR context inbox path must be relative, got absolute: ${relative}`);
  }
  if (relative.split(/[\\/]+/).includes("..")) {
    throw new Error(`MSSR context inbox path must not traverse, got: ${relative}`);
  }
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(root, relative);
  const rootLower = root.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  if (candidateLower !== rootLower && !candidateLower.startsWith(`${rootLower}${path.sep}`)) {
    throw new Error(`MSSR context inbox path escapes project root: ${relative}`);
  }
  return candidate;
}

export const projectContextHostInputSchema = z.object({
  projectRoot: z.string().min(1).max(4096),
  intent: structuredSkillIntentSchema,
  stage: z.enum(SKILL_STAGES),
  now: z.string().datetime({ offset: true }).optional(),
  maxProjectContextChars: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_CHARS).optional(),
  maxProjectContextModules: z.number().int().min(0).max(MAX_HOST_PROJECT_CONTEXT_MODULES).optional(),
  maxContextMessages: z.number().int().min(0).max(32).optional(),
  maxContextMessageChars: z.number().int().min(0).max(MAX_HOST_CONTEXT_MESSAGE_CHARS).optional(),
  inboxPath: z.string().min(1).max(240).optional(),
  inboxConfig: mssrContextInboxConfigSchema.optional(),
  allowFullDocumentFallback: z.boolean().optional(),
  contextMessages: mssrContextMessageBatchSchema.optional(),
}).strict();
export type ProjectContextHostInput = z.infer<typeof projectContextHostInputSchema>;

export type ProjectContextHostResult = {
  projectContext: LoadProjectContextModulesResult & { receipts: MssrContextDeliveryReceipt[] };
  contextMessages: MssrContextMessageSelection;
  inbox: {
    filePath: string;
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
  repository: {
    observations: number;
    messages: number;
    diagnostics: MssrRepositoryProviderDiagnostic[];
    overflow: string[];
  };
  advisoryOnly: true;
};

async function inboxFileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the keyed project-context modules, collects repository context
 * messages into the durable inbox, and returns one advisory snapshot.  When
 * the delivered state changed (prune, enqueue, or select updated receipts) it
 * is atomically saved back to the deterministic inbox file.  Selection never
 * acknowledges anything and no advisory action or persistence proposal is
 * ever executed by this helper.
 */
export async function loadProjectContextHost(
  input: ProjectContextHostInput,
  clock: () => Date = () => new Date(),
): Promise<ProjectContextHostResult> {
  const parsed = projectContextHostInputSchema.parse(input);
  const now = parsed.now ?? clock().toISOString();
  const inlineConfig: MssrContextInboxConfig | undefined = parsed.inboxConfig;
  const filePath = resolveMssrContextInboxPath(parsed.projectRoot, parsed.inboxPath);

  const projectContextBase = await loadProjectContextModules({
    projectRoot: parsed.projectRoot,
    intent: parsed.intent,
    stage: parsed.stage,
    ...(parsed.maxProjectContextChars !== undefined ? { maxChars: parsed.maxProjectContextChars } : {}),
    ...(parsed.maxProjectContextModules !== undefined ? { maxModules: parsed.maxProjectContextModules } : {}),
    ...(parsed.allowFullDocumentFallback !== undefined ? { allowFullDocumentFallback: parsed.allowFullDocumentFallback } : {}),
  });

  const repository = await collectRepositoryContextMessages({ projectRoot: parsed.projectRoot, maxObservations: 32 });

  const existing = await inboxFileExists(filePath);
  const loadedState = await loadMssrContextInboxStateFromFile(filePath);
  const loaded = existing;

  const pruned = pruneMssrContextInbox(loadedState, now, inlineConfig);
  let state = pruned.state;

  const enqueuedRepository = enqueueMssrContextMessages(state, repository.messages, now, inlineConfig);
  state = enqueuedRepository.state;
  const enqueuedCaller = parsed.contextMessages
    ? enqueueMssrContextMessages(state, parsed.contextMessages, now, inlineConfig)
    : null;
  if (enqueuedCaller) state = enqueuedCaller.state;

  const selected = selectMssrContextInboxMessages(
    state,
    {
      now,
      intent: parsed.intent,
      stage: parsed.stage,
      ...(parsed.maxContextMessages !== undefined ? { maxMessages: parsed.maxContextMessages } : {}),
      ...(parsed.maxContextMessageChars !== undefined ? { maxChars: parsed.maxContextMessageChars } : {}),
    },
    inlineConfig,
  );
  state = selected.state;

  const changed = !isDeepStrictEqual(state, loadedState);
  if (changed) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await saveMssrContextInboxStateToFile(filePath, state);
  }

  return {
    projectContext: {
      ...projectContextBase,
      receipts: state.deliveries,
    },
    contextMessages: selected.selection,
    inbox: {
      filePath,
      existing,
      loaded,
      prunedMessageIds: pruned.prunedMessageIds,
      prunedReceiptIds: pruned.prunedReceiptIds,
      enqueued: [...enqueuedRepository.enqueued, ...(enqueuedCaller?.enqueued ?? [])],
      deduplicated: [...enqueuedRepository.deduplicated, ...(enqueuedCaller?.deduplicated ?? [])],
      overflow: [...enqueuedRepository.overflow, ...(enqueuedCaller?.overflow ?? [])],
      receiptOverflow: selected.receiptOverflow,
      saved: changed,
      advisoryOnly: true,
    },
    repository: {
      observations: repository.observations.length,
      messages: repository.messages.length,
      diagnostics: repository.diagnostics,
      overflow: repository.overflow,
    },
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
  existing: boolean;
  saved: boolean;
  advisoryOnly: true;
};

/**
 * Acknowledges delivered inbox messages for their ids and atomically persists
 * the updated state.  Delivered messages that were never selected (or already
 * acknowledged) are reported as `unknown` and left untouched.  This is the
 * only host surface that confirms delivery; selection alone never does.
 */
export async function acknowledgeProjectContextInbox(
  input: ProjectContextAcknowledgeInput,
  clock: () => Date = () => new Date(),
): Promise<ProjectContextAcknowledgeResult> {
  const parsed = projectContextAcknowledgeInputSchema.parse(input);
  const now = parsed.now ?? clock().toISOString();
  const inlineConfig: MssrContextInboxConfig | undefined = parsed.inboxConfig;
  const filePath = resolveMssrContextInboxPath(parsed.projectRoot, parsed.inboxPath);

  const existing = await inboxFileExists(filePath);
  const loadedState = await loadMssrContextInboxStateFromFile(filePath);
  const acknowledged = acknowledgeMssrContextMessages(loadedState, parsed.messageIds, now, inlineConfig);

  const changed = acknowledged.acknowledged.length > 0 && !isDeepStrictEqual(acknowledged.state, loadedState);
  if (changed) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await saveMssrContextInboxStateToFile(filePath, acknowledged.state);
  }

  return {
    acknowledged: acknowledged.acknowledged,
    unknown: acknowledged.unknown,
    filePath,
    existing,
    saved: changed,
    advisoryOnly: true,
  };
}