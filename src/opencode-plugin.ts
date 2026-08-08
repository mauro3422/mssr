import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  HttpMssrTelemetrySink,
  MSSR_HOST_CALL_PROTOCOL_VERSION,
  mssrHostCallEnvelopeSchema,
  type MssrExternalTelemetrySink,
  type MssrHostCallEnvelope,
} from "./telemetry.js";

type JsonRecord = Record<string, unknown>;
type HostProfile = {
  agent: string;
  model: string;
  reasoningEffort: MssrHostCallEnvelope["host"]["reasoningEffort"];
  variant?: string;
  messageKey?: string;
};
type QueueEntry = {
  envelope: MssrHostCallEnvelope;
  attempts: number;
  queuedAt: string;
  nextAttemptAt: string;
};
type QueueState = { version: 1; entries: QueueEntry[] };

export type OpenCodePluginInput = {
  project?: { id?: string; worktree?: string };
  directory?: string;
  worktree?: string;
  client?: { app?: { log?: (input: unknown) => Promise<unknown> } };
};

export type OpenCodePluginOptions = {
  sink?: MssrExternalTelemetrySink | null;
  salt?: string;
  now?: () => Date;
  /** Test/operational override; stored records are already schema-validated and privacy-safe. */
  queuePath?: string;
  queueMaxEntries?: number;
  queueMaxAttempts?: number;
  retryBaseMs?: number;
};

const efforts = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const queueVersion = 1 as const;
const maxQueueAgeMs = 24 * 60 * 60_000;
const queueLockTimeoutMs = 2_000;
const queueLockStaleMs = 15_000;
const asRecord = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const bounded = (value: unknown, fallback: string, max: number) => typeof value === "string" && value.trim()
  ? value.trim().slice(0, max)
  : fallback;
const hash = (salt: string, kind: string, value: string) => createHash("sha256").update(`${salt}\0${kind}\0${value}`).digest("hex");
const positiveInteger = (value: number | undefined, fallback: number, maximum: number) => typeof value === "number" && Number.isInteger(value) && value > 0
  ? Math.min(value, maximum)
  : fallback;

function defaultQueuePath(): string {
  const configured = process.env.MSSR_OPENCODE_TELEMETRY_QUEUE_PATH?.trim();
  if (configured) return configured;
  const stateRoot = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "MauroPrime", "MSSR")
    : path.join(os.homedir(), ".local", "state", "mssr");
  return path.join(stateRoot, "opencode-host-call-queue.json");
}

/**
 * Persists only validated host-call envelopes. This is intentionally a tiny,
 * bounded retry spool: it is neither a durable event log nor a prompt cache.
 */
export class MssrHostCallRetryQueue {
  private loaded = false;
  private entries: QueueEntry[] = [];
  private serial = Promise.resolve();

  constructor(
    readonly filePath: string,
    private readonly now: () => Date,
    private readonly maxEntries = 128,
    private readonly maxAttempts = 5,
    private readonly retryBaseMs = 1_000,
  ) {}

  private async acquireProcessLock(): Promise<() => Promise<void>> {
    const lockPath = `${this.filePath}.lock`;
    const deadline = Date.now() + queueLockTimeoutMs;
    await fs.mkdir(path.dirname(lockPath), { recursive: true });
    while (Date.now() < deadline) {
      try {
        const handle = await fs.open(lockPath, "wx", 0o600);
        return async () => {
          await handle.close().catch(() => undefined);
          await fs.unlink(lockPath).catch(() => undefined);
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const stat = await fs.stat(lockPath);
          if (Date.now() - stat.mtimeMs > queueLockStaleMs) {
            // Rename is atomic: a live contender can create the next lock only
            // after this stale sentinel has moved out of the canonical path.
            const stalePath = `${lockPath}.${process.pid}.${Date.now()}.stale`;
            await fs.rename(lockPath, stalePath).catch(() => undefined);
            await fs.unlink(stalePath).catch(() => undefined);
          }
        } catch {
          // Another process released/recovered the lock; try again shortly.
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 15));
      }
    }
    throw new Error("MSSR host telemetry queue lock timed out.");
  }

  private async exclusive<T>(action: () => Promise<T>): Promise<T> {
    const prior = this.serial;
    let release: (() => void) | undefined;
    this.serial = new Promise<void>((resolve) => { release = resolve; });
    await prior;
    let unlock: (() => Promise<void>) | undefined;
    try {
      unlock = await this.acquireProcessLock();
      // Another OpenCode process can have persisted an event since this process
      // last touched the queue, so every cross-process operation reloads it.
      this.loaded = false;
      return await action();
    } finally {
      await unlock?.();
      release?.();
    }
  }

  private validEntry(value: unknown): QueueEntry | null {
    const entry = asRecord(value);
    const parsed = mssrHostCallEnvelopeSchema.safeParse(entry.envelope);
    if (!parsed.success || typeof entry.attempts !== "number" || !Number.isInteger(entry.attempts) || entry.attempts < 1 || entry.attempts > this.maxAttempts
      || typeof entry.queuedAt !== "string" || typeof entry.nextAttemptAt !== "string") return null;
    const queuedAt = Date.parse(entry.queuedAt);
    if (!Number.isFinite(queuedAt) || this.now().getTime() - queuedAt > maxQueueAgeMs) return null;
    return {
      envelope: parsed.data,
      attempts: entry.attempts,
      queuedAt: entry.queuedAt,
      nextAttemptAt: entry.nextAttemptAt,
    };
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const value = JSON.parse(await fs.readFile(this.filePath, "utf8")) as JsonRecord;
      const records = Array.isArray(value.entries) ? value.entries : [];
      this.entries = records.flatMap((entry) => {
        const valid = this.validEntry(entry);
        return valid ? [valid] : [];
      }).slice(-this.maxEntries);
      if (records.length !== this.entries.length) await this.persist();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        // Preserve an unreadable file for operator inspection rather than replacing it.
        this.entries = [];
      }
    }
  }

  private async persist(): Promise<void> {
    const state: QueueState = { version: queueVersion, entries: this.entries };
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state), { encoding: "utf8", mode: 0o600 });
    await fs.rename(temporary, this.filePath);
  }

  async enqueue(envelope: MssrHostCallEnvelope): Promise<"queued" | "duplicate" | "dropped"> {
    return this.exclusive(async () => {
      await this.load();
      if (this.entries.some((entry) => entry.envelope.eventId === envelope.eventId)) return "duplicate";
      const timestamp = this.now();
      const nextAttemptAt = new Date(timestamp.getTime() + this.retryBaseMs).toISOString();
      this.entries.push({ envelope: mssrHostCallEnvelopeSchema.parse(envelope), attempts: 1, queuedAt: timestamp.toISOString(), nextAttemptAt });
      const dropped = this.entries.length > this.maxEntries;
      if (dropped) this.entries.splice(0, this.entries.length - this.maxEntries);
      await this.persist();
      return dropped ? "dropped" : "queued";
    });
  }

  async due(): Promise<QueueEntry[]> {
    return this.exclusive(async () => {
      await this.load();
      const current = this.now().getTime();
      return this.entries.filter((entry) => Date.parse(entry.nextAttemptAt) <= current);
    });
  }

  async delivered(eventId: string): Promise<void> {
    await this.exclusive(async () => {
      await this.load();
      const before = this.entries.length;
      this.entries = this.entries.filter((entry) => entry.envelope.eventId !== eventId);
      if (this.entries.length !== before) await this.persist();
    });
  }

  async defer(eventId: string): Promise<"retry" | "expired" | "missing"> {
    return this.exclusive(async () => {
      await this.load();
      const entry = this.entries.find((candidate) => candidate.envelope.eventId === eventId);
      if (!entry) return "missing";
      if (entry.attempts >= this.maxAttempts) {
        this.entries = this.entries.filter((candidate) => candidate.envelope.eventId !== eventId);
        await this.persist();
        return "expired";
      }
      entry.attempts += 1;
      const backoff = Math.min(60_000, this.retryBaseMs * (2 ** (entry.attempts - 1)));
      entry.nextAttemptAt = new Date(this.now().getTime() + backoff).toISOString();
      await this.persist();
      return "retry";
    });
  }

  async nextDelayMs(): Promise<number | null> {
    return this.exclusive(async () => {
      await this.load();
      if (!this.entries.length) return null;
      const earliest = Math.min(...this.entries.map((entry) => Date.parse(entry.nextAttemptAt)));
      return Math.max(0, earliest - this.now().getTime());
    });
  }
}

async function readOpenCodeTelemetryConfig(): Promise<{ endpoint: string; tokenFile: string } | null> {
  const directEndpoint = process.env.MSSR_TELEMETRY_ENDPOINT?.trim();
  const directToken = process.env.MSSR_TELEMETRY_TOKEN_FILE?.trim();
  if (directEndpoint && directToken) return { endpoint: directEndpoint, tokenFile: directToken };
  const configured = process.env.OPENCODE_CONFIG?.trim();
  const candidates = [
    configured,
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    process.env.APPDATA ? path.join(process.env.APPDATA, "opencode", "opencode.json") : undefined,
  ].filter((item): item is string => Boolean(item));
  for (const candidate of candidates) {
    try {
      const config = JSON.parse(await fs.readFile(candidate, "utf8")) as JsonRecord;
      const mcp = asRecord(asRecord(config.mcp).mssr);
      const env = asRecord(mcp.environment);
      const endpoint = bounded(env.MSSR_TELEMETRY_ENDPOINT, "", 500);
      const tokenFile = bounded(env.MSSR_TELEMETRY_TOKEN_FILE, "", 500);
      if (endpoint && tokenFile) return { endpoint, tokenFile };
    } catch {
      // A missing or malformed optional config must never break OpenCode.
    }
  }
  return null;
}

async function defaultSink(): Promise<MssrExternalTelemetrySink | null> {
  const config = await readOpenCodeTelemetryConfig();
  return config ? new HttpMssrTelemetrySink(config.endpoint, config.tokenFile) : null;
}

export async function createMssrOpenCodePlugin(input: OpenCodePluginInput, options: OpenCodePluginOptions = {}) {
  const sink = options.sink === undefined ? await defaultSink() : options.sink;
  const now = options.now ?? (() => new Date());
  const salt = options.salt ?? process.env.MSSR_OPENCODE_HASH_SALT ?? "mssr-opencode-host-metadata-v1";
  const sessionProfiles = new Map<string, HostProfile>();
  const sessionParents = new Map<string, string>();
  const sessionTraces = new Map<string, string>();
  const emittedCalls = new Set<string>();
  const queue = sink ? new MssrHostCallRetryQueue(
    options.queuePath ?? defaultQueuePath(),
    now,
    positiveInteger(options.queueMaxEntries, 128, 1_024),
    positiveInteger(options.queueMaxAttempts, 5, 12),
    positiveInteger(options.retryBaseMs, 1_000, 60_000),
  ) : null;
  let draining = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  const projectPath = input.worktree || input.directory || input.project?.worktree || "unknown";
  const project = projectPath === "unknown" ? "unknown" : path.basename(path.resolve(projectPath)).slice(0, 120);
  const projectKey = hash(salt, "project", projectPath);

  const warn = async (message: string) => {
    try {
      await input.client?.app?.log?.({ service: "mssr-opencode-plugin", level: "warn", message });
    } catch {
      // Telemetry is best-effort and must not affect the intercepted operation.
    }
  };

  const updateProfile = (sessionID: string, values: Partial<HostProfile>) => {
    const previous = sessionProfiles.get(sessionID) ?? { agent: "unknown", model: "unknown", reasoningEffort: "unknown" as const };
    sessionProfiles.set(sessionID, { ...previous, ...values });
  };

  const rememberTrace = (sessionID: string, toolName: string, rawOutput: unknown) => {
    if (!/(^|_)mssr_(route_plan|skill_bootstrap)$/.test(toolName)) return;
    const text = typeof rawOutput === "string" ? rawOutput.slice(0, 200_000) : "";
    const match = text.match(/"traceId"\s*:\s*"([A-Za-z0-9._:-]{6,128})"/);
    if (match?.[1]) sessionTraces.set(sessionID, match[1]);
  };

  const scheduleDrain = async () => {
    if (!queue || !sink || draining) return;
    const delay = await queue.nextDelayMs();
    if (delay === null || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void drainQueue();
    }, Math.min(delay, 60_000));
    retryTimer.unref?.();
  };

  const drainQueue = async () => {
    if (!queue || !sink || draining) return;
    draining = true;
    try {
      for (const entry of await queue.due()) {
        try {
          await sink.emit(entry.envelope);
          await queue.delivered(entry.envelope.eventId);
        } catch {
          const result = await queue.defer(entry.envelope.eventId);
          if (result === "expired") await warn("Host metadata retry discarded after its bounded attempt limit.");
        }
      }
    } catch {
      await warn("Host metadata retry queue is temporarily unavailable.");
    } finally {
      draining = false;
      void scheduleDrain();
    }
  };

  const deliverOrQueue = async (envelope: MssrHostCallEnvelope) => {
    if (!sink || !queue) return;
    try {
      await sink.emit(envelope);
    } catch {
      try {
        const result = await queue.enqueue(envelope);
        if (result === "dropped") await warn("Host metadata queue reached its bounded capacity; oldest deferred event was discarded.");
        void scheduleDrain();
      } catch {
        await warn("Host metadata could not be delivered or deferred locally.");
      }
    }
  };

  const captureSessionParent = (record: JsonRecord) => {
    const properties = asRecord(record.properties);
    const info = asRecord(properties.info);
    const sessionID = bounded(info.id, "", 300);
    if (!sessionID) return;
    const parentID = bounded(info.parentID, "", 300);
    if (parentID) sessionParents.set(sessionID, hash(salt, "session", parentID));
    else sessionParents.delete(sessionID);
  };

  const emitTerminalCall = async (part: JsonRecord) => {
    const sessionID = bounded(part.sessionID, "", 300);
    const callID = bounded(part.callID, "", 300);
    const toolName = bounded(part.tool, "unknown", 160);
    if (!sessionID || !callID) return;
    const callKey = hash(salt, "call", callID);
    if (emittedCalls.has(callKey)) return;
    const state = asRecord(part.state);
    const status = state.status;
    if (status !== "completed" && status !== "error") return;
    rememberTrace(sessionID, toolName, state.output);
    const timing = asRecord(state.time);
    const endedMs = typeof timing.end === "number" ? timing.end : now().getTime();
    const startedMs = typeof timing.start === "number" ? timing.start : endedMs;
    const profile = sessionProfiles.get(sessionID) ?? { agent: "unknown", model: "unknown", reasoningEffort: "unknown" as const };
    const envelope = mssrHostCallEnvelopeSchema.parse({
      protocolVersion: MSSR_HOST_CALL_PROTOCOL_VERSION,
      eventId: `mssr-host-${callKey}`,
      emittedAt: now().toISOString(),
      source: "opencode-plugin",
      caller: "opencode-local",
      traceId: sessionTraces.get(sessionID),
      host: {
        sessionKey: hash(salt, "session", sessionID),
        parentSessionKey: sessionParents.get(sessionID),
        messageKey: typeof part.messageID === "string" ? hash(salt, "message", part.messageID) : profile.messageKey,
        callKey,
        agent: profile.agent,
        model: profile.model,
        reasoningEffort: profile.reasoningEffort,
        variant: profile.variant,
        project,
        projectKey,
      },
      tool: {
        name: toolName,
        startedAt: new Date(startedMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        durationMs: Math.max(0, Math.min(24 * 60 * 60_000, Math.round(endedMs - startedMs))),
        status: status === "completed" ? "success" : "error",
      },
    });
    emittedCalls.add(callKey);
    // Do not await transport or local I/O from a host hook. OpenCode execution
    // remains authoritative even if Bridge and the local queue are unavailable.
    void deliverOrQueue(envelope);
  };

  // A queue from a previous OpenCode process should recover opportunistically,
  // without making plugin initialization or the first chat hook wait for Bridge.
  void scheduleDrain();

  return {
    "chat.message": async (hookInput: JsonRecord) => {
      const sessionID = bounded(hookInput.sessionID, "", 300);
      if (!sessionID) return;
      const model = asRecord(hookInput.model);
      updateProfile(sessionID, {
        agent: bounded(hookInput.agent, "unknown", 160),
        model: model.providerID || model.modelID
          ? `${bounded(model.providerID, "unknown", 80)}/${bounded(model.modelID, "unknown", 80)}`
          : "unknown",
        variant: typeof hookInput.variant === "string" ? bounded(hookInput.variant, "unknown", 80) : undefined,
        messageKey: typeof hookInput.messageID === "string" ? hash(salt, "message", hookInput.messageID) : undefined,
      });
    },
    "chat.params": async (hookInput: JsonRecord, output: JsonRecord) => {
      const sessionID = bounded(hookInput.sessionID, "", 300);
      if (!sessionID) return;
      const model = asRecord(hookInput.model);
      const provider = asRecord(hookInput.provider);
      const providerInfo = asRecord(provider.info);
      const rawEffort = asRecord(output.options).reasoningEffort;
      updateProfile(sessionID, {
        agent: bounded(hookInput.agent, "unknown", 160),
        model: `${bounded(model.providerID ?? providerInfo.id, "unknown", 80)}/${bounded(model.id, "unknown", 80)}`,
        reasoningEffort: typeof rawEffort === "string" && efforts.has(rawEffort) ? rawEffort as HostProfile["reasoningEffort"] : "unknown",
      });
    },
    "tool.execute.after": async (hookInput: JsonRecord, output: JsonRecord) => {
      try {
        const sessionID = bounded(hookInput.sessionID, "", 300);
        const toolName = bounded(hookInput.tool, "", 160);
        if (sessionID && toolName) rememberTrace(sessionID, toolName, output.output);
      } catch {
        await warn("Host trace correlation was ignored.");
      }
    },
    event: async ({ event }: { event: unknown }) => {
      try {
        const record = asRecord(event);
        if (record.type === "session.created" || record.type === "session.updated") {
          captureSessionParent(record);
          return;
        }
        if (record.type === "session.deleted") {
          const sessionID = bounded(asRecord(asRecord(record.properties).info).id, "", 300);
          if (sessionID) sessionParents.delete(sessionID);
          return;
        }
        if (record.type !== "message.part.updated") return;
        const properties = asRecord(record.properties);
        const part = asRecord(properties.part);
        if (part.type === "tool") await emitTerminalCall(part);
      } catch {
        await warn("Host metadata event was ignored.");
      }
    },
  };
}

export default createMssrOpenCodePlugin;
