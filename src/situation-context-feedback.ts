import { z } from "zod";
import type { MssrConsistencyAction } from "./consistency-projection.js";
import type { ProjectContextManifest, ProjectContextKind, ProjectContextTopic } from "./project-context.js";
import {
  MSSR_SITUATION_CATEGORIES,
  type MssrSituationCategory,
  type MssrSituationModelResult,
  type MssrSituationObservation,
} from "./situation-model.js";

/**
 * C2e-E Situation-to-context feedback.
 *
 * This layer does not load context and does not reinterpret project prose. It
 * consumes the mismatch keys/actions already selected by C2c/C2d, resolves the
 * canonical observation for those keys, and optionally maps that explicit
 * source reference to one exact project-context manifest entry.
 */
export const MSSR_SITUATION_CONTEXT_ACTIONS = [
  "load-canonical-authority",
  "inspect-canonical-authorities",
  "revalidate-context-evidence",
] as const satisfies readonly MssrConsistencyAction[];
export type MssrSituationContextAction = typeof MSSR_SITUATION_CONTEXT_ACTIONS[number];

export const MSSR_SITUATION_CONTEXT_REQUEST_KINDS = ["project-context-entry", "canonical-authority"] as const;
export type MssrSituationContextRequestKind = typeof MSSR_SITUATION_CONTEXT_REQUEST_KINDS[number];

export const MSSR_SITUATION_CONTEXT_RESOLUTIONS = ["exact-entry", "ambiguous-authority", "unindexed-authority"] as const;
export type MssrSituationContextResolution = typeof MSSR_SITUATION_CONTEXT_RESOLUTIONS[number];

const manifestEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  placement: z.enum(["core", "module"]),
  kind: z.enum(["context", "memory", "state", "directive"]),
  sourcePath: z.string().min(1).max(240),
  sections: z.array(z.string().min(1).max(160)).min(1).max(24).optional(),
  topic: z.string().min(1).max(80).optional(),
  area: z.string().min(1).max(80).optional(),
  suggestedMaxChars: z.number().int().min(200).max(20_000).optional(),
}).strict();

export const mssrSituationContextRequestSchema = z.object({
  kind: z.enum(MSSR_SITUATION_CONTEXT_REQUEST_KINDS),
  resolution: z.enum(MSSR_SITUATION_CONTEXT_RESOLUTIONS),
  key: z.string().min(1).max(160),
  action: z.enum(MSSR_SITUATION_CONTEXT_ACTIONS),
  authorityRef: z.string().min(1).max(240),
  category: z.enum(MSSR_SITUATION_CATEGORIES),
  priority: z.number().int().min(0).max(100),
  required: z.boolean(),
  entry: manifestEntrySchema.optional(),
  reasonCodes: z.array(z.string().min(1).max(120)).max(20),
  advisoryOnly: z.literal(true),
}).strict();
export type MssrSituationContextRequest = z.infer<typeof mssrSituationContextRequestSchema>;

export const MSSR_SITUATION_CONTEXT_UNRESOLVED_REASONS = ["canonical-source-unresolved"] as const;
export const mssrSituationContextFeedbackSchema = z.object({
  requests: z.array(mssrSituationContextRequestSchema).max(24),
  unresolved: z.array(z.object({
    key: z.string().min(1).max(160),
    reason: z.enum(MSSR_SITUATION_CONTEXT_UNRESOLVED_REASONS),
  }).strict()).max(24),
  overflowKeys: z.array(z.string().min(1).max(160)).max(128),
  advisoryOnly: z.literal(true),
}).strict();
export type MssrSituationContextFeedback = z.infer<typeof mssrSituationContextFeedbackSchema>;

export type BuildMssrSituationContextFeedbackArgs = Readonly<{
  situation: MssrSituationModelResult;
  manifest?: ProjectContextManifest | null;
  maxRequests?: number;
}>;

type IndexedEntry = Readonly<{
  id: string;
  placement: "core" | "module";
  kind: ProjectContextKind;
  sourcePath: string;
  sections?: readonly string[];
  topic?: ProjectContextTopic;
  area?: string;
  maxChars?: number;
}>;

const ACTION_SET = new Set<MssrConsistencyAction>(MSSR_SITUATION_CONTEXT_ACTIONS);

function normalizeRef(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function splitAuthorityRef(value: string): { path: string; selector: string | null } {
  const normalized = normalizeRef(value);
  const hashIndex = normalized.indexOf("#");
  if (hashIndex < 0) return { path: normalized, selector: null };
  return {
    path: normalized.slice(0, hashIndex),
    selector: normalized.slice(hashIndex + 1) || null,
  };
}

function selectorKey(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function indexedEntries(manifest?: ProjectContextManifest | null): IndexedEntry[] {
  if (!manifest) return [];
  return [
    ...manifest.core.map((entry) => ({
      id: entry.id,
      placement: "core" as const,
      kind: entry.kind,
      sourcePath: normalizeRef(entry.source.path),
      ...(entry.source.sections ? { sections: entry.source.sections } : {}),
      ...(entry.topic ? { topic: entry.topic } : {}),
      ...(entry.area ? { area: entry.area } : {}),
      ...(entry.maxChars !== undefined ? { maxChars: entry.maxChars } : {}),
    })),
    ...manifest.modules.map((entry) => ({
      id: entry.id,
      placement: "module" as const,
      kind: entry.kind,
      sourcePath: normalizeRef(entry.source.path),
      ...(entry.source.sections ? { sections: entry.source.sections } : {}),
      ...(entry.topic ? { topic: entry.topic } : {}),
      ...(entry.area ? { area: entry.area } : {}),
      ...(entry.maxChars !== undefined ? { maxChars: entry.maxChars } : {}),
    })),
  ].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath) || left.id.localeCompare(right.id));
}

export type MssrSituationContextReferenceResolution = {
  resolution: MssrSituationContextResolution;
  entry?: MssrSituationContextRequest["entry"];
  reasonCode?: string;
};
function requestEntryFromIndexed(match: IndexedEntry): MssrSituationContextRequest["entry"] {
  return {
    id: match.id,
    placement: match.placement,
    kind: match.kind,
    sourcePath: match.sourcePath,
    ...(match.sections ? { sections: [...match.sections] } : {}),
    ...(match.topic ? { topic: match.topic } : {}),
    ...(match.area ? { area: match.area } : {}),
    ...(match.maxChars !== undefined ? { suggestedMaxChars: Math.min(match.maxChars, 20_000) } : {}),
  };
}

function exactManifestResolution(authorityRef: string, entries: readonly IndexedEntry[]): MssrSituationContextReferenceResolution {
  const reference = splitAuthorityRef(authorityRef);
  const pathMatches = entries.filter((entry) => entry.sourcePath === reference.path);
  if (pathMatches.length === 0) return { resolution: "unindexed-authority", reasonCode: "authority-not-indexed" };

  let matches = pathMatches;
  if (reference.selector) {
    const target = selectorKey(reference.selector);
    const selectorMatches = pathMatches.filter((entry) => entry.sections?.some((section) => selectorKey(section) === target));
    if (selectorMatches.length > 0) matches = selectorMatches;
  }
  if (matches.length > 1) return { resolution: "ambiguous-authority", reasonCode: "authority-maps-to-multiple-context-entries" };

  const match = matches[0];
  return { resolution: "exact-entry", entry: requestEntryFromIndexed(match) };
}

/** Resolve one explicit canonical authority against already-loaded project-context metadata. */
export function resolveMssrSituationContextAuthorityRef(
  authorityRef: string,
  manifest?: ProjectContextManifest | null,
): MssrSituationContextReferenceResolution {
  return exactManifestResolution(authorityRef, indexedEntries(manifest));
}

/** Resolve one exact project-context entry id without semantic retrieval or ranking. */
export function resolveMssrSituationContextEntryId(
  entryId: string,
  manifest?: ProjectContextManifest | null,
): MssrSituationContextReferenceResolution {
  const matches = indexedEntries(manifest).filter((entry) => entry.id === entryId);
  if (matches.length === 0) return { resolution: "unindexed-authority", reasonCode: "context-entry-not-indexed" };
  if (matches.length > 1) return { resolution: "ambiguous-authority", reasonCode: "context-entry-id-ambiguous" };
  return { resolution: "exact-entry", entry: requestEntryFromIndexed(matches[0]) };
}

function canonicalObservationsForKey(
  observations: readonly (MssrSituationObservation & { confidence: number })[],
  key: string,
): Array<MssrSituationObservation & { confidence: number }> {
  return observations
    .filter((observation) => observation.key === key && observation.authority === "canonical")
    .sort((left, right) => `${left.sourceRef ?? ""}:${left.observer}`.localeCompare(`${right.sourceRef ?? ""}:${right.observer}`));
}

function mismatchRequired(situation: MssrSituationModelResult, key: string): boolean {
  return situation.decision.mismatches.some((mismatch) => mismatch.key === key && mismatch.required);
}

function uniqSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

/**
 * Build bounded advisory requests for the current Situation attention.
 *
 * A manifest entry is selected only when the canonical sourceRef maps to
 * exactly one manifest entry. Multiple entries sharing PROJECT_MEMORY/STATE are
 * intentionally left as authority-only requests because this layer has no
 * section-level evidence and must not guess which module contains the truth.
 */
export function buildMssrSituationContextFeedback(args: BuildMssrSituationContextFeedbackArgs): MssrSituationContextFeedback {
  const maxRequests = Math.max(0, Math.min(args.maxRequests ?? 12, 24));
  if (args.situation.decision.level === "ok" || maxRequests === 0) {
    return { requests: [], unresolved: [], overflowKeys: [], advisoryOnly: true };
  }

  const entries = indexedEntries(args.manifest);
  const candidates: MssrSituationContextRequest[] = [];
  const unresolved = new Map<string, { key: string; reason: "canonical-source-unresolved" }>();

  const recommendations = [...args.situation.decision.recommendations]
    .filter((item) => item.status === "ready" && ACTION_SET.has(item.action))
    .sort((left, right) => left.rank - right.rank || right.score - left.score || left.action.localeCompare(right.action));

  for (const recommendation of recommendations) {
    const action = recommendation.action as MssrSituationContextAction;
    for (const key of recommendation.mismatchKeys) {
      const canonical = canonicalObservationsForKey(args.situation.observations, key);
      if (canonical.length === 0 || canonical.every((observation) => !observation.sourceRef)) {
        unresolved.set(key, { key, reason: "canonical-source-unresolved" });
        continue;
      }

      for (const observation of canonical) {
        if (!observation.sourceRef) continue;
        const manifestResolution = exactManifestResolution(observation.sourceRef, entries);
        const reasonCodes = uniqSorted([
          ...recommendation.reasonCodes,
          ...(manifestResolution.reasonCode ? [manifestResolution.reasonCode] : []),
        ]).slice(0, 20);
        candidates.push(mssrSituationContextRequestSchema.parse({
          kind: manifestResolution.entry ? "project-context-entry" : "canonical-authority",
          resolution: manifestResolution.resolution,
          key,
          action,
          authorityRef: observation.sourceRef,
          category: observation.category as MssrSituationCategory,
          priority: args.situation.classification.priority,
          required: observation.required || mismatchRequired(args.situation, key),
          ...(manifestResolution.entry ? { entry: manifestResolution.entry } : {}),
          reasonCodes,
          advisoryOnly: true,
        }));
      }
    }
  }

  const deduped = new Map<string, MssrSituationContextRequest>();
  for (const request of candidates) {
    const identity = `${request.key}\0${normalizeRef(request.authorityRef)}`;
    const existing = deduped.get(identity);
    if (!existing) {
      deduped.set(identity, request);
      continue;
    }
    deduped.set(identity, mssrSituationContextRequestSchema.parse({
      ...existing,
      required: existing.required || request.required,
      priority: Math.max(existing.priority, request.priority),
      reasonCodes: uniqSorted([...existing.reasonCodes, ...request.reasonCodes]).slice(0, 20),
    }));
  }

  const ordered = [...deduped.values()].sort((left, right) =>
    right.priority - left.priority
    || Number(right.required) - Number(left.required)
    || left.key.localeCompare(right.key)
    || left.authorityRef.localeCompare(right.authorityRef));
  const requests = ordered.slice(0, maxRequests);
  const overflowKeys = uniqSorted(ordered.slice(maxRequests).map((request) => request.key));

  return mssrSituationContextFeedbackSchema.parse({
    requests,
    unresolved: [...unresolved.values()].sort((left, right) => left.key.localeCompare(right.key)).slice(0, 24),
    overflowKeys,
    advisoryOnly: true,
  });
}
