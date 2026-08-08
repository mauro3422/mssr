import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SkillEntry, SkillSource } from "./skill-routing.js";

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
  observedAt: string;
  capabilityCount: number;
  warning?: string;
  usingCachedCapabilities: boolean;
}>;

export type CapabilitySnapshot = Readonly<{
  version: number;
  observedAt: string;
  capabilities: readonly Capability[];
  providers: readonly ProviderHealth[];
  warnings: readonly string[];
}>;

type ProviderState = {
  capabilities: readonly Capability[];
  health: ProviderHealth;
  inflight?: Promise<void>;
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
  return freeze({ id, status: "unavailable", observedAt: now(), capabilityCount: 0, usingCachedCapabilities: false });
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
  private version = 0;
  private snapshot: CapabilitySnapshot;

  constructor(providers: readonly CapabilityProvider[] = []) {
    for (const provider of providers) this.addProvider(provider);
    this.snapshot = this.makeSnapshot();
  }

  addProvider(provider: CapabilityProvider): void {
    if (this.providers.has(provider.id)) throw new Error(`Capability provider already registered: ${provider.id}`);
    this.providers.set(provider.id, provider);
    this.states.set(provider.id, { capabilities: freeze([]), health: emptyHealth(provider.id) });
    if (provider.subscribe) {
      const unsubscribe = provider.subscribe(() => {
        // A failed refresh retains the last known-good snapshot and records
        // degradation; a notification must not produce an unhandled rejection.
        void this.refresh([provider.id]).catch(() => undefined);
      });
      this.providerSubscriptions.set(provider.id, unsubscribe);
    }
    this.snapshot = this.makeSnapshot();
  }

  removeProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider) return false;
    this.providerSubscriptions.get(providerId)?.();
    this.providerSubscriptions.delete(providerId);
    this.providers.delete(providerId);
    this.states.delete(providerId);
    this.snapshot = this.makeSnapshot();
    return true;
  }

  async close(): Promise<void> {
    for (const unsubscribe of this.providerSubscriptions.values()) unsubscribe();
    this.providerSubscriptions.clear();
    await Promise.all([...this.providers.values()].map((provider) => provider.close ? provider.close() : Promise.resolve()));
  }

  getSnapshot(): CapabilitySnapshot { return this.snapshot; }

  async refresh(providerIds?: readonly string[]): Promise<CapabilitySnapshot> {
    const ids = providerIds?.length ? [...new Set(providerIds)] : [...this.providers.keys()];
    for (const id of ids) if (!this.providers.has(id)) throw new Error(`Unknown capability provider: ${id}`);
    await Promise.all(ids.map((id) => this.refreshProvider(id)));
    this.snapshot = this.makeSnapshot();
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
      try {
        const result = await provider.refresh();
        const capabilities = freeze([...result.capabilities].map((item) => freeze({ ...item, providerId: provider.id })));
        current.capabilities = capabilities;
        current.health = freeze({ id, status: "healthy", observedAt: result.observedAt ?? now(), capabilityCount: capabilities.length, warning: result.warning, usingCachedCapabilities: false });
      } catch (error) {
        const warning = error instanceof Error ? error.message : String(error);
        const stale = current.capabilities.length > 0;
        current.health = freeze({ id, status: stale ? "degraded" : "unavailable", observedAt: now(), capabilityCount: current.capabilities.length, warning, usingCachedCapabilities: stale });
      } finally {
        current.inflight = undefined;
      }
    })();
    current.inflight = inflight;
    return inflight;
  }

  private makeSnapshot(): CapabilitySnapshot {
    const providers = [...this.states.values()].map((state) => state.health).sort((a, b) => a.id.localeCompare(b.id));
    const capabilities = [...this.states.values()].flatMap((state) => state.capabilities).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const warnings = providers.flatMap((provider) => provider.warning ? [`${provider.id}: ${provider.warning}`] : []);
    this.version += 1;
    return freeze({ version: this.version, observedAt: now(), capabilities, providers, warnings });
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

function descriptionFor(text: string): string {
  const frontmatter = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  const match = frontmatter?.[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return match?.[1]?.trim() || "Skill discovered from its SKILL.md file.";
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
      const text = await fs.readFile(location, "utf8");
      const name = path.basename(path.dirname(location));
      const source = sourceFor(location);
      const skill: SkillEntry = { name, description: descriptionFor(text), source, path: location, origin: this.id };
      return { id: `${this.id}:skill:${location}`, name, description: skill.description, kind: "skill", providerId: this.id, source, location, skill };
    }));
    return { capabilities, observedAt: now() };
  }
}
