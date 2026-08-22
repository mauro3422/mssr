import { execFile } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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
  client?: {
    app?: { log?: (input: unknown) => Promise<unknown> };
    /**
     * OpenCode's read-only `GET /session/:id` SDK endpoint. It is optional so
     * the plugin continues to work across supported host SDK versions.
     */
    session?: { get?: (input: { path: { id: string } }) => Promise<unknown> | unknown };
  };
};

export type OpenCodePluginOptions = {
  sink?: MssrExternalTelemetrySink | null;
  salt?: string;
  /** Override the machine-local secret file consulted when no salt is supplied. */
  saltPath?: string;
  /** Receives bounded operational diagnostics without secrets or raw host identifiers. */
  onDiagnostic?: (diagnostic: { code: string; message: string }) => void;
  now?: () => Date;
  /** Test/operational override; stored records are already schema-validated and privacy-safe. */
  queuePath?: string;
  queueMaxEntries?: number;
  queueMaxAttempts?: number;
  retryBaseMs?: number;
  /** Bound the optional read-only parent lookup; never delay host execution. */
  parentLookupTimeoutMs?: number;
};

const efforts = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const queueVersion = 1 as const;
const maxQueueAgeMs = 24 * 60 * 60_000;
const queueLockTimeoutMs = 2_000;
const queueLockStaleMs = 15_000;
const metadataLockTimeoutMs = 10_000;
const metadataLockHeartbeatMs = 2_000;
const asRecord = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
const bounded = (value: unknown, fallback: string, max: number) => typeof value === "string" && value.trim()
  ? value.trim().slice(0, max)
  : fallback;
const hash = (salt: string, kind: string, value: string) => createHash("sha256").update(`${salt}\0${kind}\0${value}`).digest("hex");
const positiveInteger = (value: number | undefined, fallback: number, maximum: number) => typeof value === "number" && Number.isInteger(value) && value > 0
  ? Math.min(value, maximum)
  : fallback;

export function defaultStateRoot(
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
  localAppData: string | null | undefined = process.env.LOCALAPPDATA,
  xdgStateHome: string | null | undefined = process.env.XDG_STATE_HOME,
): string {
  if (platform === "win32" && localAppData) return path.join(localAppData, "MauroPrime", "MSSR");
  if (platform === "darwin") return path.join(home, "Library", "Application Support", "MauroPrime", "MSSR");
  if (platform !== "win32" && xdgStateHome) return path.join(xdgStateHome, "mssr");
  return path.join(home, ".local", "state", "mssr");
}

function defaultQueuePath(): string {
  const configured = process.env.MSSR_OPENCODE_TELEMETRY_QUEUE_PATH?.trim();
  if (configured) return configured;
  return path.join(defaultStateRoot(), "opencode-host-call-queue.json");
}

function defaultSaltPath(): string {
  return path.join(defaultStateRoot(), "host-metadata-salt.key");
}

const saltHexPattern = /^[a-f0-9]{64}$/i;
const saltRotationPreviousSuffix = ".previous";
const execFileAsync = promisify(execFile);
const privateFileCommandTimeoutMs = 5_000;

type Diagnostic = Parameters<NonNullable<OpenCodePluginOptions["onDiagnostic"]>>[0];
const emitDiagnostic = (
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"],
  code: string,
  message: string,
): void => {
  const diagnostic: Diagnostic = { code, message };
  if (onDiagnostic) onDiagnostic(diagnostic);
  else process.emitWarning(message, { code });
};

/**
 * Windows `0o600` file modes do not restrict NTFS ACLs, so a private metadata
 * file could remain readable by other local accounts. Restrict the ACL to the
 * current user when possible. This is best-effort: on any failure a fail-safe
 * diagnostic is emitted (never the secret) and execution continues.
 */
export async function hardenPrivateFile(
  filePath: string,
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"] = undefined,
): Promise<void> {
  try {
    if (process.platform !== "win32") {
      await fs.chmod(filePath, 0o600);
      return;
    }
    // Rebuild the DACL instead of merely changing inheritance: pre-existing
    // explicit ACEs must not survive. The script also reads the DACL back and
    // rejects any trustee other than the current user SID.
    const script = [
      "$ErrorActionPreference='Stop'",
      "$p=$env:MSSR_PRIVATE_FILE_PATH",
      "$identity=[System.Security.Principal.WindowsIdentity]::GetCurrent()",
      "$sid=$identity.User",
      "$existing=Get-Acl -LiteralPath $p",
      "$existingBad=@($existing.Access | Where-Object { $_.AccessControlType -ne 'Allow' -or $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value })",
      "if ($existing.AreAccessRulesProtected -and $existing.Access.Count -gt 0 -and $existingBad.Count -eq 0) { exit 0 }",
      "$acl=New-Object System.Security.AccessControl.FileSecurity",
      "$acl.SetOwner($sid)",
      "$acl.SetAccessRuleProtection($true,$false)",
      "$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')",
      "[void]$acl.AddAccessRule($rule)",
      "Set-Acl -LiteralPath $p -AclObject $acl",
      "$actual=Get-Acl -LiteralPath $p",
      "$bad=@($actual.Access | Where-Object { $_.AccessControlType -ne 'Allow' -or $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value })",
      "if (-not $actual.AreAccessRulesProtected -or $bad.Count -ne 0) { throw 'private DACL verification failed' }",
    ].join("; ");
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        timeout: privateFileCommandTimeoutMs,
        windowsHide: true,
        env: { ...process.env, MSSR_PRIVATE_FILE_PATH: filePath },
      },
    );
  } catch {
    emitDiagnostic(
      onDiagnostic,
      process.platform === "win32" ? "mssr-opencode-windows-acl-unavailable" : "mssr-opencode-private-file-permissions-unavailable",
      process.platform === "win32"
        ? "MSSR could not restrict Windows ACLs on a private metadata file; continuing in best-effort mode."
        : "MSSR could not restrict POSIX permissions on a private metadata file; continuing in best-effort mode.",
    );
  }
}

const explicitSaltIsStructurallyStrong = (salt: string): boolean => {
  if (!saltHexPattern.test(salt)) return false;
  const counts = new Map<string, number>();
  for (const character of salt.toLowerCase()) counts.set(character, (counts.get(character) ?? 0) + 1);
  const entropyPerNibble = [...counts.values()].reduce((entropy, count) => {
    const probability = count / salt.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
  const periodic = Array.from({ length: salt.length / 2 }, (_, index) => index + 1)
    .some((period) => salt.length % period === 0 && [...salt].every((character, index) => character === salt[index % period]));
  return counts.size >= 12 && entropyPerNibble >= 3.5 && !periodic;
};

/**
 * Machine-local salts are CSPRNG-generated, but the persisted format is also
 * guarded by the structural validator used on later reads. A cryptographically
 * random 32-byte sample can rarely fail that statistical floor by chance; if we
 * persisted such a sample, one process would reject its own write and degrade
 * to an ephemeral salt while a concurrent process healed the file with another
 * value, breaking host correlation. Rejection-sample before persistence so
 * every internally generated durable salt satisfies the contract it will later
 * be read under.
 */
export function generatePersistableMachineSalt(
  candidateSource: () => string = () => randomBytes(32).toString("hex"),
): string {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = candidateSource();
    if (explicitSaltIsStructurallyStrong(candidate)) return candidate;
  }
  throw new Error("MSSR could not generate a structurally valid OpenCode metadata salt.");
}

async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === "win32") return;
  const handle = await fs.open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}

async function writePrivateFileAtomic(
  filePath: string,
  value: string,
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"],
): Promise<void> {
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    handle = await fs.open(temporary, "wx", 0o600);
    await handle.writeFile(value, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await hardenPrivateFile(temporary, onDiagnostic);
    await fs.rename(temporary, filePath);
    await syncDirectory(path.dirname(filePath));
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.unlink(temporary).catch(() => undefined);
  }
}

/**
 * A fixed public default salt would let anyone with access to hashed host
 * metadata dictionary-attack low-entropy session, message, and call IDs. When
 * the caller supplies no salt, resolve a secret that is random and machine-local
 * so the same values still correlate across OpenCode processes on one host. The
 * secret file is best-effort: on any failure it degrades to an ephemeral
 * per-process secret rather than ever falling back to a public constant.
 *
 * All cooperating processes serialize through the same stale-aware lock while
 * reading or writing, so an empty/partial file is healed without exposing a
 * half-written value to another plugin process.
 */
async function withMetadataLock<T>(saltPath: string, action: () => Promise<T>): Promise<T> {
  const lockPath = `${saltPath}.lock`;
  const deadline = Date.now() + metadataLockTimeoutMs;
  const ownerToken = randomUUID();
  await fs.mkdir(path.dirname(lockPath), { recursive: true });
  let lockHandle: Awaited<ReturnType<typeof fs.open>> | undefined;
  while (!lockHandle && Date.now() < deadline) {
    try {
      const candidate = await fs.open(lockPath, "wx", 0o600);
      try {
        await candidate.writeFile(ownerToken, "utf8");
        await candidate.sync();
        lockHandle = candidate;
      } catch (error) {
        await candidate.close().catch(() => undefined);
        await fs.unlink(lockPath).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const stat = await fs.stat(lockPath);
        if (Date.now() - stat.mtimeMs > queueLockStaleMs) {
          const stalePath = `${lockPath}.${process.pid}.${Date.now()}.stale`;
          await fs.rename(lockPath, stalePath).catch(() => undefined);
          await fs.unlink(stalePath).catch(() => undefined);
        }
      } catch {
        // Another process released or recovered the lock.
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 15));
    }
  }
  if (!lockHandle) throw new Error("MSSR OpenCode metadata salt lock timed out.");
  const heartbeat = setInterval(() => {
    void fs.readFile(lockPath, "utf8").then(async (currentOwner) => {
      if (currentOwner === ownerToken) {
        const now = new Date();
        await fs.utimes(lockPath, now, now);
      }
    }).catch(() => undefined);
  }, metadataLockHeartbeatMs);
  heartbeat.unref();
  try {
    return await action();
  } finally {
    clearInterval(heartbeat);
    await lockHandle.close().catch(() => undefined);
    const currentOwner = await fs.readFile(lockPath, "utf8").catch(() => "");
    if (currentOwner === ownerToken) await fs.unlink(lockPath).catch(() => undefined);
  }
}

async function loadOrCreateSalt(
  saltPath: string,
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"],
): Promise<string> {
  let persisted = "";
  await withMetadataLock(saltPath, async () => {
    const existing = await fs.readFile(saltPath, "utf8").catch(() => "");
    if (explicitSaltIsStructurallyStrong(existing.trim())) {
      persisted = existing.trim();
      await hardenPrivateFile(saltPath, onDiagnostic);
      return;
    }
    // An empty/partial file is healed under the lock. Generate only when a
    // durable replacement is actually needed, and ensure the replacement
    // already satisfies the validator used by every later process.
    const fresh = generatePersistableMachineSalt();
    await writePrivateFileAtomic(saltPath, fresh, onDiagnostic);
    const written = (await fs.readFile(saltPath, "utf8")).trim();
    if (!explicitSaltIsStructurallyStrong(written)) {
      throw new Error("MSSR OpenCode metadata salt was not persisted completely.");
    }
    persisted = written;
  });
  return persisted;
}

/**
 * Explicit, observable salt rotation. It never happens implicitly: only a call
 * to this function (or an operator replacing the file under the same lock)
 * rotates the secret. Writes are ordered and individually atomic: the prior
 * generation is durably published before the current generation changes. The
 * `.previous` sidecar is intended for operator-led reconciliation.
 */
export async function rotateMachineSalt(
  saltPath: string,
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"] = undefined,
): Promise<string> {
  const fresh = generatePersistableMachineSalt();
  let rotated = "";
  await withMetadataLock(saltPath, async () => {
    const existing = await fs.readFile(saltPath, "utf8").catch(() => "");
    const current = saltHexPattern.test(existing.trim()) ? existing.trim() : undefined;
    // Preserve the old generation before publishing the new one. If this write
    // fails, rotation fails closed and the current salt remains authoritative.
    // The sidecar intentionally retains exactly one prior generation.
    if (current) {
      const previousPath = `${saltPath}${saltRotationPreviousSuffix}`;
      await writePrivateFileAtomic(previousPath, current, onDiagnostic);
    }
    await writePrivateFileAtomic(saltPath, fresh, onDiagnostic);
    rotated = fresh;
  });
  emitDiagnostic(
    onDiagnostic,
    "mssr-opencode-salt-rotated",
    "MSSR rotated its machine-local OpenCode metadata salt. Correlation continues under the new secret; one prior generation is retained for migration.",
  );
  return rotated;
}

async function resolveSalt(
  provided: string | undefined,
  saltPath: string,
  onDiagnostic: OpenCodePluginOptions["onDiagnostic"],
): Promise<string> {
  const explicit = provided?.trim();
  const configured = explicit ? undefined : process.env.MSSR_OPENCODE_HASH_SALT?.trim();
  const candidate = explicit ?? configured;
  const source = explicit ? "option" : configured ? "env" : undefined;
  if (candidate && source) {
    // Accept only a canonical 32-byte value with a structural diversity and
    // anti-repetition floor. Operators must still generate it with a CSPRNG;
    // static validation cannot prove randomness.
    if (explicitSaltIsStructurallyStrong(candidate)) return candidate;
    // Reject a weak explicit salt without ever logging its value, then fall
    // back to a strong machine-local secret so the plugin keeps working.
    emitDiagnostic(
      onDiagnostic,
      "mssr-opencode-salt-rejected-weak",
      `MSSR ignored the explicit OpenCode hash salt from ${source} because it does not meet the minimum strength requirement; a strong machine-local secret is used instead.`,
    );
  }
  try {
    return await loadOrCreateSalt(saltPath, onDiagnostic);
  } catch {
    emitDiagnostic(
      onDiagnostic,
      "mssr-opencode-salt-degraded",
      "MSSR could not persist its machine-local OpenCode metadata salt; correlation is limited to this process.",
    );
    return randomBytes(32).toString("hex");
  }
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
  const salt = await resolveSalt(options.salt, options.saltPath ?? defaultSaltPath(), options.onDiagnostic);
  const sessionProfiles = new Map<string, HostProfile>();
  const sessionParents = new Map<string, string>();
  // A lifecycle event (or an authoritative GET /session/:id fallback) tells us
  // that the absence of parentID is meaningful. Do not fill it from ordering,
  // agent names, a task call, or another session's recent activity.
  const observedSessionParents = new Set<string>();
  const sessionParentLookups = new Map<string, Promise<void>>();
  const sessionParentLookupAttempts = new Set<string>();
  const sessionTraces = new Map<string, string>();
  const emittedCalls = new Set<string>();
  const queue = sink ? new MssrHostCallRetryQueue(
    options.queuePath ?? defaultQueuePath(),
    now,
    positiveInteger(options.queueMaxEntries, 128, 1_024),
    positiveInteger(options.queueMaxAttempts, 5, 12),
    positiveInteger(options.retryBaseMs, 1_000, 60_000),
  ) : null;
  const parentLookupTimeoutMs = positiveInteger(options.parentLookupTimeoutMs, 250, 5_000);
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
    try {
      const delay = await queue.nextDelayMs();
      if (delay === null || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void drainQueue();
      }, Math.min(delay, 60_000));
      retryTimer.unref?.();
    } catch {
      await warn("Host metadata retry queue could not be scheduled.");
    }
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
    observedSessionParents.add(sessionID);
  };

  const hydrateSessionParent = (sessionID: string): Promise<void> => {
    if (observedSessionParents.has(sessionID)) return Promise.resolve();
    const active = sessionParentLookups.get(sessionID);
    if (active) return active;
    const get = input.client?.session?.get;
    if (!get || sessionParentLookupAttempts.has(sessionID)) return Promise.resolve();
    sessionParentLookupAttempts.add(sessionID);
    let timeout: number | undefined;
    const expires = new Promise<undefined>((resolve) => {
      timeout = setTimeout(resolve, parentLookupTimeoutMs);
    });
    const lookup = Promise.race([
      Promise.resolve().then(() => get({ path: { id: sessionID } })),
      expires,
    ])
      .then((response) => {
        // Ignore a late lookup after an explicit deletion cleaned this session
        // from the in-memory observation boundary.
        if (!sessionParentLookupAttempts.has(sessionID)) return;
        // A lifecycle event that arrived while this request was in flight is
        // newer authoritative evidence. Never let the fallback overwrite it.
        if (observedSessionParents.has(sessionID)) return;
        // The generated OpenCode SDK returns `{ data: Session }`; accept a
        // direct Session only for compatibility with a minimal host mock.
        const outer = asRecord(response);
        const info = asRecord(outer.data);
        const session = bounded(info.id, "", 300) ? info : outer;
        if (bounded(session.id, "", 300) !== sessionID) return;
        const parentID = bounded(session.parentID, "", 300);
        if (parentID) sessionParents.set(sessionID, hash(salt, "session", parentID));
        else sessionParents.delete(sessionID);
        observedSessionParents.add(sessionID);
      })
      .catch(() => {
        // This is an optional enrichment path. Its failure leaves the parent
        // unknown; it must not block a hook or create a guessed relationship.
      })
      .finally(() => {
        if (timeout) clearTimeout(timeout);
        sessionParentLookups.delete(sessionID);
      });
    sessionParentLookups.set(sessionID, lookup);
    return lookup;
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
    emittedCalls.add(callKey);
    const emit = () => {
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
      void deliverOrQueue(envelope);
    };
    // Do not await transport or local I/O from a host hook. OpenCode execution
    // remains authoritative even if Bridge and the local queue are unavailable.
    if (observedSessionParents.has(sessionID) || !input.client?.session?.get) emit();
    else void hydrateSessionParent(sessionID).finally(emit);
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
          if (sessionID) {
            sessionParents.delete(sessionID);
            observedSessionParents.delete(sessionID);
            sessionParentLookups.delete(sessionID);
            sessionParentLookupAttempts.delete(sessionID);
            sessionProfiles.delete(sessionID);
            sessionTraces.delete(sessionID);
          }
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
