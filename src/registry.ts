import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SkillEntry, SkillSource } from "./skill-routing.js";
import {
  MSSR_FIRST_PARTY_SKILL_MANIFEST,
  mssrFirstPartySkillManifestSchema,
  mssrFirstPartySkillsRoot,
  type MssrFirstPartySkillManifest,
} from "./first-party-skills.js";

/** A capability is metadata for discovery. It is never an authorization grant. */
export type Capability = Readonly<{
  id: string;
  name: string;
  description: string;
  kind: "skill" | "tool";
  providerId: string;
  source: string;
  location?: string;
  schema?: unknown;
  skill?: SkillEntry;
}>;

export type ProviderResult = Readonly<{
  capabilities: readonly Capability[];
  warning?: string;
  observedAt?: string;
  /**
   * Optional validity window for this catalog observation. Absence means the
   * registry cannot claim the catalog is current; it does not make the
   * provider unavailable.
   */
  ttlMs?: number;
}>;

export interface CapabilityProvider {
  readonly id: string;
  refresh(): Promise<ProviderResult>;

  /** Lets dynamic providers announce a catalog change without coupling the registry to their transport. */
  subscribe?(listener: () => void): () => void;

  /** Releases provider-owned resources, such as an MCP client transport. */
  close?(): Promise<void>;
}

export type ProviderHealth = Readonly<{
  id: string;
  status: "healthy" | "degraded" | "unavailable";
  /** Freshness of catalog metadata, independent from transport health. */
  freshness: "fresh" | "stale" | "unknown";
  observedAt: string;
  lastAttemptAt: string;
  capabilityCount: number;
  warning?: string;
  usingCachedCapabilities: boolean;
  ttlMs?: number;
  expiresAt?: string;
}>;

export type CapabilityRegistryChange = Readonly<{
  kind: "provider-added" | "provider-removed" | "provider-change-notified" | "provider-refreshed" | "provider-refresh-failed" | "provider-catalog-stale";
  providerId: string;
  observedAt: string;
}>;

export type CapabilitySnapshot = Readonly<{
  version: number;
  observedAt: string;
  capabilities: readonly Capability[];
  providers: readonly ProviderHealth[];
  warnings: readonly string[];
  /** Bounded reason for the current published snapshot, when it changed. */
  lastChange?: CapabilityRegistryChange;
}>;

type ProviderState = {
  capabilities: readonly Capability[];
  health: ProviderHealth;
  inflight?: Promise<void>;
  refreshQueued?: boolean;
};

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function now(): string { return new Date().toISOString(); }

function emptyHealth(id: string): ProviderHealth {
  const observedAt = now();
  return freeze({ id, status: "unavailable", freshness: "unknown", observedAt, lastAttemptAt: observedAt, capabilityCount: 0, usingCachedCapabilities: false });
}

function normalizedTtlMs(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 86_400_000
    ? value
    : undefined;
}

function normalizedObservedAt(value: unknown, fallback: string): string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : fallback;
}

function effectiveHealth(health: ProviderHealth, at = Date.now()): ProviderHealth {
  if (health.freshness !== "fresh" || !health.expiresAt || Date.parse(health.expiresAt) > at) return health;
  return freeze({ ...health, freshness: "stale", usingCachedCapabilities: health.capabilityCount > 0 || health.usingCachedCapabilities });
}

/**
 * Concurrent capability registry. Provider refreshes are single-flight and every
 * reader receives an immutable snapshot. A failed refresh retains the last good
 * provider result but marks it explicitly degraded; cached metadata is planning
 * evidence, never proof that a tool is currently callable.
 */
export class CapabilityRegistry {
  private readonly providers = new Map<string, CapabilityProvider>();
  private readonly states = new Map<string, ProviderState>();
  private readonly providerSubscriptions = new Map<string, () => void>();
  private readonly snapshotListeners = new Set<(snapshot: CapabilitySnapshot) => void>();
  private version = 0;
  private snapshot: CapabilitySnapshot;

  constructor(providers: readonly CapabilityProvider[] = []) {
    this.snapshot = this.makeSnapshot();
    for (const provider of providers) this.addProvider(provider);
  }

  addProvider(provider: CapabilityProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Capability provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
    this.states.set(provider.id, { capabilities: freeze([]), health: emptyHealth(provider.id) });
    if (provider.subscribe) {
      const unsubscribe = provider.subscribe(() => {
        this.scheduleProviderRefresh(provider.id);
      });
      this.providerSubscriptions.set(provider.id, unsubscribe);
    }
    this.publish({ kind: "provider-added", providerId: provider.id, observedAt: now() });
  }

  removeProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    this.providerSubscriptions.get(providerId)?.();
    this.providerSubscriptions.delete(providerId);
    this.providers.delete(providerId);
    this.states.delete(providerId);
    this.publish({ kind: "provider-removed", providerId, observedAt: now() });
    return true;
  }

  async close(): Promise<void> {
    for (const unsubscribe of this.providerSubscriptions.values()) unsubscribe();
    this.providerSubscriptions.clear();
    await Promise.all([...this.providers.values()].map((provider) => provider.close ? provider.close() : Promise.resolve()));
  }

  /**
   * Observes TTL expiry without performing I/O. Callers may decide to refresh
   * a stale provider; reading metadata never invokes a provider tool.
   */
  getSnapshot(): CapabilitySnapshot {
    this.expireStaleCatalogs();
    return this.snapshot;
  }

  /** Lets adapters observe dynamic provider registration and catalog changes. */
  subscribe(listener: (snapshot: CapabilitySnapshot) => void): () => void {
    this.snapshotListeners.add(listener);
    return () => this.snapshotListeners.delete(listener);
  }

  async refresh(providerIds?: readonly string[]): Promise<CapabilitySnapshot> {
    const ids = providerIds?.length ? [...new Set(providerIds)] : [...this.providers.keys()];
    for (const id of ids) if (!this.providers.has(id)) throw new Error(`Unknown capability provider: ${id}`);
    await Promise.all(ids.map((id) => this.refreshProvider(id)));
    return this.snapshot;
  }

  search(query: string, limit = 20): readonly Capability[] {
    const tokens = query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!tokens.length) return this.snapshot.capabilities.slice(0, Math.max(1, limit));
    return this.snapshot.capabilities
      .map((capability) => ({ capability, score: tokens.reduce((score, token) => score + Number(`${capability.name} ${capability.description} ${capability.source}`.toLocaleLowerCase().includes(token)), 0) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.capability.name.localeCompare(b.capability.name))
      .slice(0, Math.max(1, limit))
      .map((item) => item.capability);
  }

  inspect(idOrName: string): Capability | undefined {
    return this.snapshot.capabilities.find((item) => item.id === idOrName || item.name === idOrName);
  }

  private async refreshProvider(id: string): Promise<void> {
    const current = this.states.get(id)!;
    if (current.inflight) return current.inflight;
    const provider = this.providers.get(id)!;
    const inflight = (async () => {
      do {
        current.refreshQueued = false;
        const attemptedAt = now();
        try {
          const result = await provider.refresh();
          const capabilities = freeze([...result.capabilities].map((item) => freeze({ ...item, providerId: provider.id })));
          const ttlMs = normalizedTtlMs(result.ttlMs);
          const observedAt = normalizedObservedAt(result.observedAt, attemptedAt);
          const expiresAt = ttlMs ? new Date(Date.parse(observedAt) + ttlMs).toISOString() : undefined;
          current.capabilities = capabilities;
          current.health = freeze({
            id,
            status: "healthy",
            freshness: ttlMs ? "fresh" : "unknown",
            observedAt,
            lastAttemptAt: attemptedAt,
            capabilityCount: capabilities.length,
            warning: result.warning,
            usingCachedCapabilities: false,
            ttlMs,
            expiresAt,
          });
          this.publish({ kind: "provider-refreshed", providerId: id, observedAt: attemptedAt });
        } catch (error) {
          const warning = error instanceof Error ? error.message : String(error);
          const stale = current.capabilities.length > 0;
          const prior = effectiveHealth(current.health);
          current.health = freeze({
            ...prior,
            status: stale ? "degraded" : "unavailable",
            lastAttemptAt: attemptedAt,
            capabilityCount: current.capabilities.length,
            warning,
            usingCachedCapabilities: stale || prior.usingCachedCapabilities,
          });
          this.publish({ kind: "provider-refresh-failed", providerId: id, observedAt: attemptedAt });
        }
      } while (current.refreshQueued);
      current.inflight = undefined;
    })();
    current.inflight = inflight;
    return inflight;
  }

  private makeSnapshot(): CapabilitySnapshot {
    const providers = [...this.states.values()].map((state) => effectiveHealth(state.health)).sort((a, b) => a.id.localeCompare(b.id));
    const capabilities = [...this.states.values()].flatMap((state) => state.capabilities).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const warnings = providers.flatMap((provider) => provider.warning ? [`${provider.id}: ${provider.warning}`] : []);
    this.version += 1;
    return freeze({ version: this.version, observedAt: now(), capabilities, providers, warnings });
  }

  private publish(change?: CapabilityRegistryChange): void {
    this.snapshot = freeze({ ...this.makeSnapshot(), ...(change ? { lastChange: change } : {}) });
    for (const listener of this.snapshotListeners) {
      try { listener(this.snapshot); } catch { /* Registry observers are advisory only. */ }
    }
  }

  private scheduleProviderRefresh(providerId: string): void {
    const state = this.states.get(providerId);
    if (!state || !this.providers.has(providerId)) return;
    this.publish({ kind: "provider-change-notified", providerId, observedAt: now() });
    if (state.inflight) {
      // A change notification that races an in-flight tools/list must result in
      // one additional list, otherwise the final snapshot can miss the change.
      state.refreshQueued = true;
      return;
    }
    // A failed refresh retains the last known-good snapshot and records
    // degradation; a notification must not produce an unhandled rejection.
    void this.refresh([providerId]).catch(() => undefined);
  }

  private expireStaleCatalogs(): void {
    const expired = [...this.states.entries()].filter(([, state]) => {
      const health = state.health;
      return health.freshness === "fresh" && health.expiresAt && Date.parse(health.expiresAt) <= Date.now();
    });
    if (!expired.length) return;
    for (const [, state] of expired) state.health = effectiveHealth(state.health);
    const [providerId] = expired[0];
    this.publish({ kind: "provider-catalog-stale", providerId, observedAt: now() });
  }
}

function defaultRoots(): string[] {
  const configured = process.env.MSSR_SKILL_ROOTS?.split(path.delimiter).map((item) => item.trim()).filter(Boolean);
  if (configured?.length) return configured;
  const codexHome = process.env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  return [
    path.join(codexHome, "skills"),
    path.join(codexHome, "plugins", "cache"),
  ];
}

function sourceFor(location: string): SkillSource {
  const normalized = location.replace(/\\/g, "/").toLowerCase();
  if (normalized.includes("/.system/")) return "codex-system";
  if (normalized.includes("/plugins/cache/")) return "codex-plugin";
  return "codex-local";
}

const SKILL_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export type SkillFrontmatter = Readonly<{ name: string; description: string }>;

/**
 * Skill identity is declared by frontmatter, not inferred from a mount path.
 * This supports providers whose package layout uses a router directory name
 * that intentionally differs from the public skill identity.
 */
export function parseSkillFrontmatter(text: string): SkillFrontmatter {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error("SKILL.md is missing YAML frontmatter");
  const nameMatch = frontmatter[1].match(/^name:\s*["']?([^"'\r\n#]+?)["']?\s*$/m);
  const name = nameMatch?.[1]?.trim() ?? "";
  if (!SKILL_NAME_PATTERN.test(name)) throw new Error("SKILL.md frontmatter name must be a bounded skill identifier");
  const match = frontmatter?.[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return { name, description: match?.[1]?.trim() || "Skill discovered from its SKILL.md file." };
}

async function skillFiles(root: string): Promise<string[]> {
  const output: string[] = [];
  const visited = new Set<string>();
  const walk = async (directory: string): Promise<void> => {
    let resolved: string;
    try { resolved = (await fs.realpath(directory)).toLocaleLowerCase(); } catch { return; }
    if (visited.has(resolved)) return;
    visited.add(resolved);
    let entries: import("node:fs").Dirent[];
    try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
    await Promise.all(entries.map(async (entry) => {
      if (entry.name === ".git" || entry.name === "node_modules") return;
      const candidate = path.join(directory, entry.name);
      if (entry.isFile() && entry.name === "SKILL.md") output.push(candidate);
      else if (entry.isDirectory()) await walk(candidate);
      else if (entry.isSymbolicLink()) {
        try {
          if ((await fs.stat(candidate)).isDirectory()) await walk(candidate);
        } catch {
          // A broken skill link is omitted from discovery and will surface in
          // the owning installer/audit rather than aborting every provider.
        }
      }
    }));
  };
  await walk(root);
  return output;
}

/** Discovers local Skill files without making the full catalog part of an agent prompt. */
export class FilesystemSkillProvider implements CapabilityProvider {
  readonly id: string;
  readonly roots: readonly string[];

  constructor(options: { id?: string; roots?: readonly string[] } = {}) {
    this.id = options.id ?? "filesystem-skills";
    this.roots = freeze([...(options.roots ?? defaultRoots())]);
  }

  async refresh(): Promise<ProviderResult> {
    const paths = (await Promise.all(this.roots.map(skillFiles))).flat();
    const capabilities = await Promise.all(paths.map(async (location): Promise<Capability> => {
      const resolvedLocation = await fs.realpath(location);
      const text = await fs.readFile(resolvedLocation, "utf8");
      const frontmatter = parseSkillFrontmatter(text);
      const name = frontmatter.name;
      const source = sourceFor(location);
      const skill: SkillEntry = { name, description: frontmatter.description, source, path: resolvedLocation, origin: this.id, contentHash: createHash("sha256").update(text).digest("hex") };
      return { id: `${this.id}:skill:${resolvedLocation}`, name, description: skill.description, kind: "skill", providerId: this.id, source, location: resolvedLocation, skill };
    }));
    return { capabilities, observedAt: now() };
  }
}

/**
 * Reads only skill names reserved and shipped by MSSR. It is independent of a
 * Codex runtime mount, allowing native MCP and OpenCode to discover the
 * package-owned source directly after the skill-tree migration lands.
 */
export class MssrFirstPartySkillProvider implements CapabilityProvider {
  readonly id: string;
  readonly root: string;
  readonly manifest: MssrFirstPartySkillManifest;

  constructor(options: { id?: string; root?: string; manifest?: MssrFirstPartySkillManifest } = {}) {
    this.id = options.id ?? "mssr-first-party-skills";
    this.root = path.resolve(options.root ?? mssrFirstPartySkillsRoot());
    this.manifest = mssrFirstPartySkillManifestSchema.parse(options.manifest ?? MSSR_FIRST_PARTY_SKILL_MANIFEST);
  }

  async refresh(): Promise<ProviderResult> {
    const capabilities = (await Promise.all(this.manifest.skills.map(async ({ name }): Promise<Capability | null> => {
      const candidate = path.join(this.root, name, "SKILL.md");
      try {
        const location = await fs.realpath(candidate);
        const text = await fs.readFile(location, "utf8");
        const frontmatter = parseSkillFrontmatter(text);
        if (frontmatter.name !== name) throw new Error(`Bundled first-party skill ${name} declares frontmatter name ${frontmatter.name}`);
        const skill: SkillEntry = { name: frontmatter.name, description: frontmatter.description, source: "mssr-first-party", path: location, origin: this.id, contentHash: createHash("sha256").update(text).digest("hex") };
        return { id: `${this.id}:skill:${location}`, name, description: skill.description, kind: "skill", providerId: this.id, source: skill.source, location, skill };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }))).filter((item): item is Capability => item !== null);
    return { capabilities, observedAt: now() };
  }
}
