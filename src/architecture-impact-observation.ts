import { createHash } from "node:crypto";
import { z } from "zod";
import {
  MAX_ARCHITECTURE_IMPACT_REFS,
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  architectureImpactManifestSchema,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import {
  mssrSituationObservationSchema,
  type MssrSituationObservation,
} from "./situation-model.js";

export const MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION = 1 as const;
export const MSSR_ARCHITECTURE_IMPACT_AVAILABILITY = ["available", "missing", "unavailable"] as const;

export const architectureImpactRevisionSchema = z.string().min(1).max(160).refine(
  (value) => value.trim() === value && !/[\r\n]/.test(value),
  "Architecture-impact revisions must be bounded non-empty single-line values without surrounding whitespace.",
);
export const architectureImpactReasonCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);

const availableFileObservationSchema = z.object({
  ref: architectureImpactExactRefSchema,
  availability: z.literal("available"),
  revision: architectureImpactRevisionSchema,
}).strict();

const missingFileObservationSchema = z.object({
  ref: architectureImpactExactRefSchema,
  availability: z.literal("missing"),
}).strict();

const unavailableFileObservationSchema = z.object({
  ref: architectureImpactExactRefSchema,
  availability: z.literal("unavailable"),
  reasonCode: architectureImpactReasonCodeSchema.optional(),
}).strict();

/**
 * One host-observed file state. A host must explicitly distinguish positive
 * absence (`missing`) from inability to inspect (`unavailable`). MSSR never
 * invents a revision for either state.
 */
export const architectureImpactFileObservationSchema = z.discriminatedUnion("availability", [
  availableFileObservationSchema,
  missingFileObservationSchema,
  unavailableFileObservationSchema,
]);

export const architectureImpactObservationPlanSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  authorityRef: architectureImpactExactRefSchema,
  impactRefs: z.array(architectureImpactExactRefSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
}).strict();

export const architectureImpactHostEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  authority: architectureImpactFileObservationSchema,
  impacts: z.array(architectureImpactFileObservationSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.impacts.length; index += 1) {
    const ref = value.impacts[index].ref;
    if (seen.has(ref)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate host observation for impactRef: ${ref}`,
        path: ["impacts", index, "ref"],
      });
    }
    seen.add(ref);
  }
});

const declaredRelationshipSchema = z.object({
  authorityRef: architectureImpactExactRefSchema,
  contextRef: architectureImpactIdSchema.optional(),
  impactRefs: z.array(architectureImpactExactRefSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
}).strict();

/**
 * Portable C2f-B evidence keeps relationship authority and host observation
 * visibly separate. `declared` came from the reviewed repository manifest;
 * `observed` is metadata supplied by the host.
 */
export const normalizedArchitectureImpactEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  declared: declaredRelationshipSchema,
  observed: z.object({
    authority: architectureImpactFileObservationSchema,
    impacts: z.array(architectureImpactFileObservationSchema).min(1).max(MAX_ARCHITECTURE_IMPACT_REFS),
  }).strict(),
}).strict();

export type ArchitectureImpactFileObservation = z.infer<typeof architectureImpactFileObservationSchema>;
export type ArchitectureImpactObservationPlan = z.infer<typeof architectureImpactObservationPlanSchema>;
export type ArchitectureImpactHostEvidence = z.infer<typeof architectureImpactHostEvidenceSchema>;
export type NormalizedArchitectureImpactEvidence = z.infer<typeof normalizedArchitectureImpactEvidenceSchema>;
export type ArchitectureImpactHostObserver = (
  plan: ArchitectureImpactObservationPlan,
) => ArchitectureImpactHostEvidence | Promise<ArchitectureImpactHostEvidence>;

/**
 * Produce exact read-only observation requests from the declared manifest.
 * The portable plan names files but performs no filesystem I/O.
 */
export function planArchitectureImpactObservations(
  manifestInput: ArchitectureImpactManifest,
): ArchitectureImpactObservationPlan[] {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  return manifest.architectures.map((entry) => architectureImpactObservationPlanSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION,
    architectureId: entry.architectureId,
    authorityRef: entry.authorityRef,
    impactRefs: [...entry.impactRefs],
  }));
}

function findManifestEntry(manifest: ArchitectureImpactManifest, architectureId: string) {
  const entry = manifest.architectures.find((candidate) => candidate.architectureId === architectureId);
  if (!entry) throw new Error(`Architecture-impact evidence references undeclared architectureId: ${architectureId}`);
  return entry;
}

/**
 * Validate a host observation against the reviewed declaration and return one
 * deterministic canonical record. Every declared ref must appear exactly once;
 * omissions are not silently converted to `unavailable`.
 */
export function normalizeArchitectureImpactObservationEvidence(
  manifestInput: ArchitectureImpactManifest,
  evidenceInput: ArchitectureImpactHostEvidence,
): NormalizedArchitectureImpactEvidence {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  const evidence = architectureImpactHostEvidenceSchema.parse(evidenceInput);
  const declared = findManifestEntry(manifest, evidence.architectureId);

  if (evidence.authority.ref !== declared.authorityRef) {
    throw new Error(
      `Architecture-impact authority observation mismatch for ${declared.architectureId}: expected ${declared.authorityRef}, received ${evidence.authority.ref}`,
    );
  }

  const byRef = new Map(evidence.impacts.map((item) => [item.ref, item] as const));
  const undeclared = evidence.impacts
    .map((item) => item.ref)
    .filter((ref) => !declared.impactRefs.includes(ref));
  if (undeclared.length > 0) {
    throw new Error(
      `Architecture-impact host evidence contains undeclared impactRefs for ${declared.architectureId}: ${undeclared.join(", ")}`,
    );
  }

  const missing = declared.impactRefs.filter((ref) => !byRef.has(ref));
  if (missing.length > 0) {
    throw new Error(
      `Architecture-impact host evidence omitted declared impactRefs for ${declared.architectureId}: ${missing.join(", ")}. Return explicit unavailable evidence instead of omitting a ref.`,
    );
  }

  return normalizedArchitectureImpactEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_IMPACT_OBSERVATION_SCHEMA_VERSION,
    architectureId: declared.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    declared: {
      authorityRef: declared.authorityRef,
      ...(declared.contextRef ? { contextRef: declared.contextRef } : {}),
      impactRefs: [...declared.impactRefs],
    },
    observed: {
      authority: evidence.authority,
      impacts: declared.impactRefs.map((ref) => byRef.get(ref)!),
    },
  });
}

/**
 * Execute a host-owned observer boundary once per declared architecture.
 * Exceptions propagate and are never synthesized into portable evidence; a host
 * that cannot inspect a file must explicitly return `unavailable` for that ref.
 */
export async function observeArchitectureImpactManifest(
  manifestInput: ArchitectureImpactManifest,
  observer: ArchitectureImpactHostObserver,
): Promise<NormalizedArchitectureImpactEvidence[]> {
  const manifest = architectureImpactManifestSchema.parse(manifestInput);
  const plans = planArchitectureImpactObservations(manifest);
  const normalized: NormalizedArchitectureImpactEvidence[] = [];
  for (const plan of plans) {
    const raw = await observer(plan);
    normalized.push(normalizeArchitectureImpactObservationEvidence(manifest, raw));
  }
  return normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function situationIdentity(architectureId: string, role: "authority" | "impact", ref: string): string {
  return sha256(`${architectureId}\0${role}\0${ref}`).slice(0, 24);
}

function boundedSourceRef(ref: string): string {
  if (ref.length <= 240) return ref;
  return `sha256:${ref.length}:${sha256(ref)}`;
}

function toSituationObservation(
  architectureId: string,
  role: "authority" | "impact",
  observation: ArchitectureImpactFileObservation,
): MssrSituationObservation {
  const identity = situationIdentity(architectureId, role, observation.ref);
  const state = observation.availability === "available"
    ? "observed"
    : observation.availability === "missing"
      ? "unavailable"
      : "unknown";

  return mssrSituationObservationSchema.parse({
    key: `architecture.file-revision:${identity}`,
    observer: `architecture-impact:${architectureId}:${role}:${identity}`,
    role: role === "authority" ? "reference" : "source",
    authority: "canonical",
    state,
    ...(observation.availability === "available" ? { revision: observation.revision } : {}),
    required: false,
    category: "architecture",
    evidenceClass: "observed",
    sourceRef: boundedSourceRef(observation.ref),
  });
}

/**
 * Convert normalized C2f-B metadata into ordinary Situation observations without
 * comparing it to a historical/reviewed baseline. C2f-C owns source-set
 * fingerprinting, changed/stable classification, attention and resolution.
 */
export function buildArchitectureImpactSituationObservations(
  evidenceInput: NormalizedArchitectureImpactEvidence,
): MssrSituationObservation[] {
  const evidence = normalizedArchitectureImpactEvidenceSchema.parse(evidenceInput);
  return [
    toSituationObservation(evidence.architectureId, "authority", evidence.observed.authority),
    ...evidence.observed.impacts.map((item) => toSituationObservation(evidence.architectureId, "impact", item)),
  ];
}
