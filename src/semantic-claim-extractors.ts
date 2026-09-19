import type { MssrConsistencyAuthority } from "./consistency-projection.js";
import {
  mssrSituationSemanticClaimBatchSchema,
  mssrSituationSemanticClaimSchema,
  type MssrSituationClaimSource,
  type MssrSituationClaimValidity,
  type MssrSituationSemanticClaim,
} from "./situation-claims.js";

const ROADMAP_GATE_LINE = /^- \[([ xX])\] \*\*(R[1-9][0-9]*) — /;
const DECLARED_STATE_LINE = /^<!-- mssr-state:([a-z0-9][a-z0-9._:-]{0,79})=([a-z0-9][a-z0-9._:-]{0,79}) -->$/;
const DECLARED_VERSION_LINE = /^<!-- mssr-version:([a-z0-9][a-z0-9._:-]{0,79})=([0-9A-Za-z][0-9A-Za-z.+_-]{0,79}) -->$/;
const DECLARED_OWNER_LINE = /^<!-- mssr-owner:([a-z0-9][a-z0-9._:-]{0,79})=([A-Za-z0-9][A-Za-z0-9._:/-]{0,119}) -->$/;
const DECLARED_DECISION_LINE = /^<!-- mssr-decision:([a-z0-9][a-z0-9._:-]{0,79})=([0-9A-Za-z][0-9A-Za-z._:+/-]{0,119}) -->$/;

function assertUniqueSubjects(claims: readonly MssrSituationSemanticClaim[], extractor: string): void {
  const seen = new Set<string>();
  for (const claim of claims) {
    const key = `${claim.scope}:${claim.subject}`;
    if (seen.has(key)) throw new Error(`${extractor} produced duplicate semantic subject ${key}`);
    seen.add(key);
  }
}

type DeclaredMarkerInput = Readonly<{
  markdown: string;
  sourceRef: string;
  source?: MssrSituationClaimSource;
  authority?: MssrConsistencyAuthority;
  scope?: string;
  validity?: MssrSituationClaimValidity;
  required?: boolean;
  observedAt?: string;
}>;

function markerBase(input: DeclaredMarkerInput, subject: string, extractor: string) {
  return {
    subject,
    source: input.source ?? "project-state" as const,
    sourceRef: `${input.sourceRef}#${subject}`,
    authority: input.authority ?? "canonical" as const,
    state: "observed" as const,
    scope: input.scope ?? "project",
    validity: input.validity ?? "current" as const,
    ...(input.observedAt ? { observedAt: input.observedAt } : {}),
    extractor,
    required: input.required ?? false,
  };
}

function parseMarkerClaims(claims: readonly MssrSituationSemanticClaim[], extractor: string): MssrSituationSemanticClaim[] {
  const parsed = mssrSituationSemanticClaimBatchSchema.parse(claims);
  assertUniqueSubjects(parsed, extractor);
  return parsed;
}

/**
 * Narrow deterministic ROADMAP extractor. It understands only the explicit
 * checked-list R<n> gate syntax used by MSSR; all other Markdown is ignored.
 */
export function extractMssrRoadmapGateClaims(input: Readonly<{
  markdown: string;
  sourceRef: string;
  authority?: MssrConsistencyAuthority;
  scope?: string;
  validity?: MssrSituationClaimValidity;
  required?: boolean;
  observedAt?: string;
}>): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = ROADMAP_GATE_LINE.exec(line);
    if (!match) continue;
    const gate = match[2].toLowerCase();
    claims.push({
      kind: "state-value",
      subject: `roadmap.${gate}`,
      source: "project-context",
      sourceRef: `${input.sourceRef}#${gate}`,
      authority: input.authority ?? "replica",
      state: "observed",
      scope: input.scope ?? "project",
      validity: input.validity ?? "current",
      ...(input.observedAt ? { observedAt: input.observedAt } : {}),
      extractor: "roadmap-checklist-v1",
      value: match[1].toLowerCase() === "x" ? "completed" : "pending",
      required: input.required ?? false,
    });
  }
  return parseMarkerClaims(claims, "roadmap-checklist-v1");
}

/** Explicit current-state marker: `<!-- mssr-state:roadmap.r3=completed -->`. */
export function extractMssrDeclaredStateClaims(input: DeclaredMarkerInput): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = DECLARED_STATE_LINE.exec(line.trim());
    if (!match) continue;
    claims.push({ kind: "state-value", ...markerBase(input, match[1], "declared-state-marker-v1"), value: match[2] });
  }
  return parseMarkerClaims(claims, "declared-state-marker-v1");
}

/** Explicit version marker: `<!-- mssr-version:bridge.live=0.6.139 -->`. */
export function extractMssrDeclaredVersionClaims(input: DeclaredMarkerInput): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = DECLARED_VERSION_LINE.exec(line.trim());
    if (!match) continue;
    claims.push({ kind: "release-version", ...markerBase(input, match[1], "declared-version-marker-v1"), value: match[2] });
  }
  return parseMarkerClaims(claims, "declared-version-marker-v1");
}

/** Explicit owner marker: `<!-- mssr-owner:semantic.consistency=mssr -->`. */
export function extractMssrDeclaredOwnerClaims(input: DeclaredMarkerInput): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = DECLARED_OWNER_LINE.exec(line.trim());
    if (!match) continue;
    claims.push({ kind: "ownership", ...markerBase(input, match[1], "declared-owner-marker-v1"), value: match[2] });
  }
  return parseMarkerClaims(claims, "declared-owner-marker-v1");
}

/** Explicit decision revision marker: `<!-- mssr-decision:adr.0006=rev-2 -->`. */
export function extractMssrDeclaredDecisionClaims(input: DeclaredMarkerInput): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = DECLARED_DECISION_LINE.exec(line.trim());
    if (!match) continue;
    claims.push({ kind: "decision-revision", ...markerBase(input, match[1], "declared-decision-marker-v1"), revision: match[2] });
  }
  return parseMarkerClaims(claims, "declared-decision-marker-v1");
}

/**
 * Structured package metadata extractor. It reads only the explicit `version`
 * field of an already-parsed package object and never scans package prose.
 */
export function extractMssrPackageVersionClaim(input: Readonly<{
  packageJson: unknown;
  subject: string;
  sourceRef: string;
  scope?: string;
  authority?: MssrConsistencyAuthority;
  source?: MssrSituationClaimSource;
  required?: boolean;
  observedAt?: string;
}>): MssrSituationSemanticClaim {
  if (typeof input.packageJson !== "object" || input.packageJson === null || !("version" in input.packageJson)) {
    throw new Error("package-version-v1 requires an explicit packageJson.version field");
  }
  const version = (input.packageJson as { version?: unknown }).version;
  if (typeof version !== "string" || version.length === 0) throw new Error("package-version-v1 requires a non-empty string version");
  return mssrSituationSemanticClaimSchema.parse({
    kind: "release-version",
    subject: input.subject,
    source: input.source ?? "source",
    sourceRef: input.sourceRef,
    authority: input.authority ?? "canonical",
    scope: input.scope ?? "project",
    validity: "current",
    ...(input.observedAt ? { observedAt: input.observedAt } : {}),
    extractor: "package-version-v1",
    value: version,
    required: input.required ?? false,
  });
}
