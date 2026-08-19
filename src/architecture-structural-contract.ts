import { createHash } from "node:crypto";
import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import { architectureImpactRevisionSchema } from "./architecture-impact-observation.js";
import {
  architectureMarkdownAnchorIdSchema,
  architectureStructureManifestSchema,
  validateArchitectureStructureAgainstImpactManifest,
  type ArchitectureStructureManifest,
  type ArchitectureSymbolSelector,
} from "./architecture-impact-structure.js";
import {
  architectureStructuralFingerprintSchema,
  architectureSymbolAnalysisReasonCodeSchema,
  architectureSymbolAnalyzerIdSchema,
  architectureSymbolFingerprintSchemeSchema,
  architectureSymbolSelectorKey,
  normalizedArchitectureSymbolEvidenceSchema,
  type NormalizedArchitectureSymbolEvidence,
} from "./architecture-symbol-analysis.js";
import { parseMarkdownArchitectureSections } from "./architecture-markdown.js";

export const MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION = 1 as const;
export const MSSR_MARKDOWN_ARCHITECTURE_FINGERPRINT_SCHEME = "mssr-markdown-section-v1" as const;
export const MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS = 128;
export const MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_STATUSES = [
  "not-applicable",
  "noise-candidate",
  "structural-possible-impact",
  "unresolved",
] as const;
export const MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES = [
  "coarse-aligned",
  "coarse-unresolved",
  "structural-evidence-required",
  "structure-declaration-changed",
  "changed-source-without-structural-landmark",
  "coarse-availability-change-unresolved",
  "structural-landmark-missing",
  "structural-landmark-unavailable",
  "structural-fingerprint-scheme-mismatch",
  "structural-source-revision-mismatch",
  "structural-fingerprint-changed",
  "structural-fingerprints-aligned",
] as const;

const fingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const architectureStructuralLandmarkIdentitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("markdown-anchor"),
    anchorId: architectureMarkdownAnchorIdSchema,
  }).strict(),
  z.object({
    kind: z.literal("code-symbol"),
    selector: z.object({
      kind: z.literal("symbol"),
      language: z.enum(["typescript", "javascript"]),
      name: z.string().min(1).max(160).refine(
        (value) => value.trim() === value && !/[\r\n]/.test(value),
        "Architecture symbol names must be bounded single-line values without surrounding whitespace.",
      ),
      aspect: z.enum(["signature", "body", "shape"]),
    }).strict(),
  }).strict(),
]);

const structuralLandmarkCommon = {
  ref: architectureImpactExactRefSchema,
  sourceRevision: architectureImpactRevisionSchema,
  fingerprintScheme: architectureSymbolFingerprintSchemeSchema,
  analyzerId: architectureSymbolAnalyzerIdSchema.optional(),
  landmark: architectureStructuralLandmarkIdentitySchema,
};

const observedLandmarkSchema = z.object({
  ...structuralLandmarkCommon,
  availability: z.literal("observed"),
  structuralFingerprint: architectureStructuralFingerprintSchema,
}).strict();

const missingLandmarkSchema = z.object({
  ...structuralLandmarkCommon,
  availability: z.literal("missing"),
}).strict();

const unavailableLandmarkSchema = z.object({
  ...structuralLandmarkCommon,
  availability: z.literal("unavailable"),
  reasonCode: architectureSymbolAnalysisReasonCodeSchema.optional(),
}).strict();

export const architectureStructuralLandmarkEvidenceSchema = z.discriminatedUnion("availability", [
  observedLandmarkSchema,
  missingLandmarkSchema,
  unavailableLandmarkSchema,
]).superRefine((value, ctx) => {
  if (value.landmark.kind === "code-symbol" && !value.analyzerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Code-symbol structural evidence requires analyzerId provenance.",
      path: ["analyzerId"],
    });
  }
  if (value.landmark.kind === "markdown-anchor" && value.analyzerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Markdown-anchor structural evidence must not claim a code analyzerId.",
      path: ["analyzerId"],
    });
  }
});

export const architectureStructuralEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  landmarks: z.array(architectureStructuralLandmarkEvidenceSchema).min(1).max(MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.landmarks.length; index += 1) {
    const key = architectureStructuralLandmarkKey(value.landmarks[index]);
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture structural landmark evidence: ${key}`,
        path: ["landmarks", index],
      });
    }
    seen.add(key);
  }
});

export const reviewedStructuralLandmarkSchema = observedLandmarkSchema;

export const architectureStructuralReviewedBaselineSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  reviewClass: z.literal("reviewed"),
  coarseBaselineFingerprint: fingerprintSchema,
  structureFingerprint: fingerprintSchema,
  landmarks: z.array(reviewedStructuralLandmarkSchema).min(1).max(MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS),
  baselineFingerprint: fingerprintSchema,
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.landmarks.length; index += 1) {
    const item = value.landmarks[index];
    const key = architectureStructuralLandmarkKey(item);
    if (seen.has(key)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate reviewed structural landmark: ${key}`, path: ["landmarks", index] });
    }
    seen.add(key);
    if (item.landmark.kind === "code-symbol" && !item.analyzerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reviewed code-symbol landmarks require analyzerId provenance.", path: ["landmarks", index, "analyzerId"] });
    }
    if (item.landmark.kind === "markdown-anchor" && item.analyzerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reviewed Markdown landmarks must not claim a code analyzerId.", path: ["landmarks", index, "analyzerId"] });
    }
  }
});

export const structuralChangeSchema = z.object({
  key: z.string().min(1).max(720),
  ref: architectureImpactExactRefSchema,
  landmark: architectureStructuralLandmarkIdentitySchema,
  fingerprintScheme: architectureSymbolFingerprintSchemeSchema,
  baselineFingerprint: architectureStructuralFingerprintSchema,
  currentFingerprint: architectureStructuralFingerprintSchema,
}).strict();

export const structuralUnresolvedSchema = z.object({
  key: z.string().min(1).max(720),
  ref: architectureImpactExactRefSchema,
  landmark: architectureStructuralLandmarkIdentitySchema,
  reasonCode: z.enum(MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES),
}).strict();

export const architectureStructuralRefinementSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  coarseStatus: z.enum(["aligned", "possible-impact", "unresolved"]),
  coarseFingerprint: fingerprintSchema,
  status: z.enum(MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_STATUSES),
  level: z.enum(["ok", "watch", "review"]),
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  structureFingerprint: fingerprintSchema,
  structuralBaselineFingerprint: fingerprintSchema,
  reasonCodes: z.array(z.enum(MSSR_ARCHITECTURE_STRUCTURAL_REASON_CODES)).max(16),
  comparedLandmarkKeys: z.array(z.string().min(1).max(720)).max(MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS),
  changes: z.array(structuralChangeSchema).max(MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS),
  unresolved: z.array(structuralUnresolvedSchema).max(MAX_ARCHITECTURE_STRUCTURAL_LANDMARKS),
  evidenceComplete: z.boolean(),
  fingerprint: fingerprintSchema,
  notifyOnWatch: z.literal(false),
  advisoryOnly: z.literal(true),
}).strict().superRefine((value, ctx) => {
  const expectedLevel = value.status === "not-applicable" ? "ok" : value.status === "noise-candidate" ? "watch" : "review";
  if (value.level !== expectedLevel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Structural refinement level must be ${expectedLevel} for status ${value.status}.`, path: ["level"] });
  }
  if (value.evidenceComplete !== (value.status !== "unresolved")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Structural refinement evidenceComplete must be false only for unresolved status.", path: ["evidenceComplete"] });
  }
  if (value.status === "structural-possible-impact" && value.changes.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "structural-possible-impact requires at least one changed landmark.", path: ["changes"] });
  }
  if ((value.status === "not-applicable" || value.status === "noise-candidate") && (value.changes.length > 0 || value.unresolved.length > 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.status} cannot contain structural changes or unresolved landmarks.` });
  }
  if (value.status === "unresolved" && value.level !== "review") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unresolved structural refinement must remain review-level.", path: ["level"] });
  }
});

export type ArchitectureStructuralLandmarkIdentity = z.infer<typeof architectureStructuralLandmarkIdentitySchema>;
export type ArchitectureStructuralLandmarkEvidence = z.infer<typeof architectureStructuralLandmarkEvidenceSchema>;
export type ArchitectureStructuralEvidence = z.infer<typeof architectureStructuralEvidenceSchema>;
export type ArchitectureStructuralReviewedBaseline = z.infer<typeof architectureStructuralReviewedBaselineSchema>;
export type ArchitectureStructuralRefinement = z.infer<typeof architectureStructuralRefinementSchema>;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function semanticHash(label: string, parts: readonly string[]): string {
  const identity = [label, ...parts].map((part) => `${part.length}:${part}`).join("|");
  return `sha256:${sha256(identity)}`;
}

function identityPart(identity: ArchitectureStructuralLandmarkIdentity): string {
  return identity.kind === "markdown-anchor"
    ? `markdown-anchor:${identity.anchorId}`
    : `code-symbol:${architectureSymbolSelectorKey(identity.selector)}`;
}

export function architectureStructuralLandmarkKey(input: Pick<ArchitectureStructuralLandmarkEvidence, "ref" | "landmark">): string {
  const identity = architectureStructuralLandmarkIdentitySchema.parse(input.landmark);
  return [input.ref, identityPart(identity)].map((part) => `${part.length}:${part}`).join("|");
}

function structureEntryFor(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  architectureId: string,
) {
  const structure = validateArchitectureStructureAgainstImpactManifest(structureInput, impactManifest);
  return structure.architectures.find((entry) => entry.architectureId === architectureId) ?? null;
}

function expectedLandmarks(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  architectureId: string,
): Array<{ ref: string; landmark: ArchitectureStructuralLandmarkIdentity }> {
  const declared = impactManifest.architectures.find((entry) => entry.architectureId === architectureId);
  if (!declared) throw new Error(`Unknown architectureId for structural evidence: ${architectureId}`);
  const entry = structureEntryFor(impactManifest, structureInput, architectureId);
  if (!entry) return [];

  const result: Array<{ ref: string; landmark: ArchitectureStructuralLandmarkIdentity }> = [];
  for (const anchorId of entry.authorityAnchors ?? []) {
    result.push({ ref: declared.authorityRef, landmark: { kind: "markdown-anchor", anchorId } });
  }
  for (const implementation of entry.implementation ?? []) {
    for (const selector of implementation.selectors) {
      result.push({ ref: implementation.ref, landmark: { kind: "code-symbol", selector } });
    }
  }
  return result;
}

export function buildArchitectureStructureFingerprint(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  architectureId: string,
): string {
  const landmarks = expectedLandmarks(impactManifest, structureInput, architectureId);
  const entry = structureEntryFor(impactManifest, structureInput, architectureId);
  return semanticHash("architecture-structure-declaration-v1", [
    architectureId,
    ...(entry?.authorityAnchors ?? []).map((anchor) => `anchor:${anchor}`),
    ...landmarks.map((item) => `${item.ref}|${identityPart(item.landmark)}`),
  ]);
}

export function buildMarkdownArchitectureStructuralEvidence(input: Readonly<{
  architectureId: string;
  authorityRef: string;
  sourceRevision: string;
  markdown: string;
  anchorIds: readonly string[];
}>): ArchitectureStructuralEvidence {
  const architectureId = architectureImpactIdSchema.parse(input.architectureId);
  const ref = architectureImpactExactRefSchema.parse(input.authorityRef);
  const sourceRevision = architectureImpactRevisionSchema.parse(input.sourceRevision);
  const sections = new Map(parseMarkdownArchitectureSections(input.markdown).map((section) => [section.anchorId, section] as const));
  const landmarks: ArchitectureStructuralLandmarkEvidence[] = input.anchorIds.map((rawAnchor) => {
    const anchorId = architectureMarkdownAnchorIdSchema.parse(rawAnchor);
    const section = sections.get(anchorId);
    return section
      ? {
        ref,
        sourceRevision,
        fingerprintScheme: MSSR_MARKDOWN_ARCHITECTURE_FINGERPRINT_SCHEME,
        landmark: { kind: "markdown-anchor" as const, anchorId },
        availability: "observed" as const,
        structuralFingerprint: section.fingerprint,
      }
      : {
        ref,
        sourceRevision,
        fingerprintScheme: MSSR_MARKDOWN_ARCHITECTURE_FINGERPRINT_SCHEME,
        landmark: { kind: "markdown-anchor" as const, anchorId },
        availability: "missing" as const,
      };
  });
  return architectureStructuralEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION,
    architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    landmarks,
  });
}

export function buildSymbolArchitectureStructuralEvidence(
  input: NormalizedArchitectureSymbolEvidence,
): ArchitectureStructuralEvidence {
  const evidence = normalizedArchitectureSymbolEvidenceSchema.parse(input);
  const landmarks: ArchitectureStructuralLandmarkEvidence[] = evidence.results.map((result) => {
    const common = {
      ref: evidence.ref,
      sourceRevision: evidence.sourceRevision,
      fingerprintScheme: evidence.fingerprintScheme,
      analyzerId: evidence.analyzerId,
      landmark: { kind: "code-symbol" as const, selector: result.selector },
    };
    if (result.availability === "observed") {
      return { ...common, availability: "observed" as const, structuralFingerprint: result.structuralFingerprint };
    }
    if (result.availability === "missing") return { ...common, availability: "missing" as const };
    return { ...common, availability: "unavailable" as const, ...(result.reasonCode ? { reasonCode: result.reasonCode } : {}) };
  });
  return architectureStructuralEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION,
    architectureId: evidence.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    landmarks,
  });
}

export function mergeArchitectureStructuralEvidence(
  architectureIdInput: string,
  evidenceInputs: readonly ArchitectureStructuralEvidence[],
): ArchitectureStructuralEvidence {
  const architectureId = architectureImpactIdSchema.parse(architectureIdInput);
  const landmarks: ArchitectureStructuralLandmarkEvidence[] = [];
  for (const raw of evidenceInputs) {
    const evidence = architectureStructuralEvidenceSchema.parse(raw);
    if (evidence.architectureId !== architectureId) {
      throw new Error(`Architecture structural evidence architectureId mismatch: expected ${architectureId}, received ${evidence.architectureId}`);
    }
    landmarks.push(...evidence.landmarks);
  }
  return architectureStructuralEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_STRUCTURAL_REFINEMENT_SCHEMA_VERSION,
    architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    landmarks,
  });
}

export function normalizeArchitectureStructuralEvidence(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  evidenceInput: ArchitectureStructuralEvidence,
  options: Readonly<{ requireAll?: boolean }> = {},
): ArchitectureStructuralEvidence {
  const evidence = architectureStructuralEvidenceSchema.parse(evidenceInput);
  const expected = expectedLandmarks(impactManifest, structureInput, evidence.architectureId);
  const expectedByKey = new Map(expected.map((item) => [architectureStructuralLandmarkKey(item), item] as const));
  const byKey = new Map(evidence.landmarks.map((item) => [architectureStructuralLandmarkKey(item), item] as const));

  const extras = [...byKey.keys()].filter((key) => !expectedByKey.has(key));
  if (extras.length > 0) {
    throw new Error(`Architecture structural evidence contains undeclared landmarks for ${evidence.architectureId}: ${extras.join(", ")}`);
  }
  if (options.requireAll) {
    const missing = [...expectedByKey.keys()].filter((key) => !byKey.has(key));
    if (missing.length > 0) {
      throw new Error(`Architecture structural evidence omitted declared landmarks for ${evidence.architectureId}: ${missing.join(", ")}`);
    }
  }

  const ordered = expected
    .map((item) => byKey.get(architectureStructuralLandmarkKey(item)))
    .filter((item): item is ArchitectureStructuralLandmarkEvidence => Boolean(item));
  return architectureStructuralEvidenceSchema.parse({ ...evidence, landmarks: ordered });
}
