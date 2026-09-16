import type { CapabilitySnapshot } from "./registry.js";
import type { GlobalSkillContextPlan } from "./skill-context-loader.js";

/**
 * Compact route/bootstrap envelope projection.
 *
 * The full capability snapshot stays internal to routing (registry providers,
 * skill discovery, scoring). Normal MCP responses carry only a bounded
 * summary plus an explicit pointer to the bounded diagnostic tools, so the
 * envelope no longer grows proportionally with the registered catalog.
 * Full inspection remains available on demand through
 * `mssr_registry_status`, `mssr_capability_search` and
 * `mssr_capability_inspect`.
 */

export type RegistrySummaryProvider = Readonly<{
  id: string;
  status: string;
  freshness: string;
  capabilityCount: number;
  warning?: string;
}>;

export type RegistrySummary = Readonly<{
  version: number;
  observedAt: string;
  capabilityCount: number;
  skillCount: number;
  toolCount: number;
  providers: readonly RegistrySummaryProvider[];
  warnings: readonly string[];
}>;

export function summarizeRegistrySnapshot(snapshot: CapabilitySnapshot): RegistrySummary {
  const capabilities = snapshot.capabilities ?? [];
  const skillCount = capabilities.filter((item) => item.kind === "skill").length;
  const toolCount = capabilities.filter((item) => item.kind === "tool").length;
  return {
    version: snapshot.version,
    observedAt: snapshot.observedAt,
    capabilityCount: capabilities.length,
    skillCount,
    toolCount,
    providers: (snapshot.providers ?? []).map((provider) => ({
      id: provider.id,
      status: provider.status,
      freshness: provider.freshness,
      capabilityCount: provider.capabilityCount,
      ...(provider.warning ? { warning: provider.warning.slice(0, 300) } : {}),
    })),
    warnings: [...(snapshot.warnings ?? [])].map((warning) => warning.slice(0, 300)),
  };
}

export const ROUTE_ENVELOPE_DIAGNOSTICS = {
  registryDetail:
    "The full capability catalog is available to routing internally but is not attached to normal route responses. " +
    "Use mssr_registry_status for the bounded snapshot, mssr_capability_search to find capabilities, " +
    "and mssr_capability_inspect for one record.",
  tools: ["mssr_registry_status", "mssr_capability_search", "mssr_capability_inspect"],
} as const;

export type RouteEnvelopeDiagnostics = {
  readonly registryDetail: string;
  readonly tools: readonly string[];
};

export function routeEnvelopeDiagnostics(): RouteEnvelopeDiagnostics {
  return { registryDetail: ROUTE_ENVELOPE_DIAGNOSTICS.registryDetail, tools: [...ROUTE_ENVELOPE_DIAGNOSTICS.tools] };
}

export type StrippedSkillContext = Record<string, unknown> & { readonly contentOmittedFromPage: true };

export type CompactContextPage = Omit<GlobalSkillContextPlan, "skills"> & {
  readonly skills: readonly StrippedSkillContext[];
  readonly skillsContentStripped: true;
};

/**
 * Bootstrap envelope projection for the paged skill-context plan.
 *
 * `loaded` remains the canonical carrier of selected skill content. The page
 * keeps every budget/cursor/remaining/blocked field but omits the repeated
 * per-skill `content` strings, so the same text is not delivered twice.
 */
export function projectContextPageForEnvelope(plan: GlobalSkillContextPlan): CompactContextPage {
  const { skills, ...page } = plan;
  return {
    ...page,
    skills: skills.map((entry) => {
      const { content, ...rest } = entry as Record<string, unknown>;
      void content;
      return { ...rest, contentOmittedFromPage: true as const };
    }),
    skillsContentStripped: true as const,
  };
}

export type EnvelopeSectionSize = Readonly<{
  section: string;
  chars: number;
  bytes: number;
}>;

/**
 * Budget inspector: reports serialized sizes per top-level section without
 * printing content. Intended for tests and offline measurement, not as
 * another MCP/orchestration layer.
 */
export function measureEnvelopeSections(value: unknown): EnvelopeSectionSize[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const text = JSON.stringify(value ?? null);
    return [{ section: "<root>", chars: text.length, bytes: Buffer.byteLength(text, "utf8") }];
  }
  const entries = Object.entries(value as Record<string, unknown>).map(([section, sectionValue]) => {
    const text = JSON.stringify(sectionValue ?? null);
    return { section, chars: text.length, bytes: Buffer.byteLength(text, "utf8") };
  });
  entries.sort((a, b) => b.chars - a.chars);
  return entries;
}
