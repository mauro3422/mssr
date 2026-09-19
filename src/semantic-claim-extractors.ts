import type { MssrConsistencyAuthority } from "./consistency-projection.js";
import {
  mssrSituationSemanticClaimBatchSchema,
  type MssrSituationClaimSource,
  type MssrSituationClaimValidity,
  type MssrSituationSemanticClaim,
} from "./situation-claims.js";

const ROADMAP_GATE_LINE = /^- \[([ xX])\] \*\*(R[1-9][0-9]*) — /;
const DECLARED_STATE_LINE = /^<!-- mssr-state:([a-z0-9][a-z0-9._:-]{0,79})=([a-z0-9][a-z0-9._:-]{0,79}) -->$/;

function assertUniqueSubjects(claims: readonly MssrSituationSemanticClaim[], extractor: string): void {
  const seen = new Set<string>();
  for (const claim of claims) {
    const key = `${claim.scope}:${claim.subject}`;
    if (seen.has(key)) throw new Error(`${extractor} produced duplicate semantic subject ${key}`);
    seen.add(key);
  }
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
  const parsed = mssrSituationSemanticClaimBatchSchema.parse(claims);
  assertUniqueSubjects(parsed, "roadmap-checklist-v1");
  return parsed;
}

/**
 * Explicit machine-readable state markers for canonical/current-state docs.
 * Example: `<!-- mssr-state:roadmap.r3=completed -->`.
 * The extractor never infers state from surrounding prose.
 */
export function extractMssrDeclaredStateClaims(input: Readonly<{
  markdown: string;
  sourceRef: string;
  source?: MssrSituationClaimSource;
  authority?: MssrConsistencyAuthority;
  scope?: string;
  validity?: MssrSituationClaimValidity;
  required?: boolean;
  observedAt?: string;
}>): MssrSituationSemanticClaim[] {
  const claims: MssrSituationSemanticClaim[] = [];
  for (const line of input.markdown.split(/\r?\n/)) {
    const match = DECLARED_STATE_LINE.exec(line.trim());
    if (!match) continue;
    claims.push({
      kind: "state-value",
      subject: match[1],
      source: input.source ?? "project-state",
      sourceRef: `${input.sourceRef}#${match[1]}`,
      authority: input.authority ?? "canonical",
      state: "observed",
      scope: input.scope ?? "project",
      validity: input.validity ?? "current",
      ...(input.observedAt ? { observedAt: input.observedAt } : {}),
      extractor: "declared-state-marker-v1",
      value: match[2],
      required: input.required ?? false,
    });
  }
  const parsed = mssrSituationSemanticClaimBatchSchema.parse(claims);
  assertUniqueSubjects(parsed, "declared-state-marker-v1");
  return parsed;
}
