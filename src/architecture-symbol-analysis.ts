import { z } from "zod";
import {
  architectureImpactExactRefSchema,
  architectureImpactIdSchema,
  type ArchitectureImpactManifest,
} from "./architecture-impact.js";
import {
  architectureImpactRevisionSchema,
} from "./architecture-impact-observation.js";
import {
  architectureSymbolSelectorSchema,
  validateArchitectureStructureAgainstImpactManifest,
  type ArchitectureStructureManifest,
  type ArchitectureSymbolSelector,
} from "./architecture-impact-structure.js";

export const MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION = 1 as const;
export const MAX_ARCHITECTURE_SYMBOL_ANALYSIS_RESULTS = 32;

export const architectureStructuralFingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const architectureSymbolAnalyzerIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);
export const architectureSymbolFingerprintSchemeSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);
export const architectureSymbolAnalysisReasonCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{0,79}$/);
export const architectureSymbolSourceLocationSchema = z.object({
  startLine: z.number().int().min(1).max(1_000_000),
  endLine: z.number().int().min(1).max(1_000_000),
}).strict().superRefine((value, ctx) => {
  if (value.endLine < value.startLine) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Architecture symbol source location endLine must be greater than or equal to startLine.",
      path: ["endLine"],
    });
  }
});

const observedSymbolResultSchema = z.object({
  selector: architectureSymbolSelectorSchema,
  availability: z.literal("observed"),
  structuralFingerprint: architectureStructuralFingerprintSchema,
  location: architectureSymbolSourceLocationSchema.optional(),
}).strict();

const missingSymbolResultSchema = z.object({
  selector: architectureSymbolSelectorSchema,
  availability: z.literal("missing"),
}).strict();

const unavailableSymbolResultSchema = z.object({
  selector: architectureSymbolSelectorSchema,
  availability: z.literal("unavailable"),
  reasonCode: architectureSymbolAnalysisReasonCodeSchema.optional(),
}).strict();

export const architectureSymbolAnalysisResultSchema = z.discriminatedUnion("availability", [
  observedSymbolResultSchema,
  missingSymbolResultSchema,
  unavailableSymbolResultSchema,
]);

export const architectureSymbolAnalysisPlanSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  ref: architectureImpactExactRefSchema,
  selectors: z.array(architectureSymbolSelectorSchema).min(1).max(MAX_ARCHITECTURE_SYMBOL_ANALYSIS_RESULTS),
}).strict();

export const architectureSymbolHostEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  ref: architectureImpactExactRefSchema,
  sourceRevision: architectureImpactRevisionSchema,
  analyzerId: architectureSymbolAnalyzerIdSchema,
  fingerprintScheme: architectureSymbolFingerprintSchemeSchema,
  results: z.array(architectureSymbolAnalysisResultSchema).min(1).max(MAX_ARCHITECTURE_SYMBOL_ANALYSIS_RESULTS),
}).strict().superRefine((value, ctx) => {
  const seen = new Set<string>();
  for (let index = 0; index < value.results.length; index += 1) {
    const key = architectureSymbolSelectorKey(value.results[index].selector);
    if (seen.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate architecture symbol analysis result: ${key}`,
        path: ["results", index, "selector"],
      });
    }
    seen.add(key);
  }
});

export const normalizedArchitectureSymbolEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION),
  architectureId: architectureImpactIdSchema,
  relationshipClass: z.literal("declared"),
  evidenceClass: z.literal("observed"),
  ref: architectureImpactExactRefSchema,
  sourceRevision: architectureImpactRevisionSchema,
  analyzerId: architectureSymbolAnalyzerIdSchema,
  fingerprintScheme: architectureSymbolFingerprintSchemeSchema,
  results: z.array(architectureSymbolAnalysisResultSchema).min(1).max(MAX_ARCHITECTURE_SYMBOL_ANALYSIS_RESULTS),
}).strict();

export type ArchitectureSymbolAnalysisResult = z.infer<typeof architectureSymbolAnalysisResultSchema>;
export type ArchitectureSymbolAnalysisPlan = z.infer<typeof architectureSymbolAnalysisPlanSchema>;
export type ArchitectureSymbolHostEvidence = z.infer<typeof architectureSymbolHostEvidenceSchema>;
export type NormalizedArchitectureSymbolEvidence = z.infer<typeof normalizedArchitectureSymbolEvidenceSchema>;
export type ArchitectureSymbolAnalyzer = (
  plan: ArchitectureSymbolAnalysisPlan,
) => ArchitectureSymbolHostEvidence | Promise<ArchitectureSymbolHostEvidence>;

export function architectureSymbolSelectorKey(selectorInput: ArchitectureSymbolSelector): string {
  const selector = architectureSymbolSelectorSchema.parse(selectorInput);
  return [selector.kind, selector.language, selector.name, selector.aspect]
    .map((part) => `${part.length}:${part}`)
    .join("|");
}

/**
 * Produce exact host-neutral analysis requests only for symbol selectors already
 * reviewed into the non-widening architecture structure manifest. A plan names
 * what to analyze but performs no file read, parser invocation or graph lookup.
 */
export function planArchitectureSymbolAnalysis(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
): ArchitectureSymbolAnalysisPlan[] {
  const structure = validateArchitectureStructureAgainstImpactManifest(structureInput, impactManifest);
  const plans: ArchitectureSymbolAnalysisPlan[] = [];

  for (const entry of structure.architectures) {
    for (const implementation of entry.implementation ?? []) {
      plans.push(architectureSymbolAnalysisPlanSchema.parse({
        schemaVersion: MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION,
        architectureId: entry.architectureId,
        ref: implementation.ref,
        selectors: implementation.selectors,
      }));
    }
  }

  return plans;
}

function findAnalysisPlan(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  architectureId: string,
  ref: string,
): ArchitectureSymbolAnalysisPlan {
  const plan = planArchitectureSymbolAnalysis(impactManifest, structureInput)
    .find((candidate) => candidate.architectureId === architectureId && candidate.ref === ref);
  if (!plan) {
    throw new Error(`Architecture symbol evidence references undeclared analysis target: ${architectureId}:${ref}`);
  }
  return plan;
}

/**
 * Validate host evidence against the reviewed selector declaration and normalize
 * results back into declaration order. Extras, duplicates and omissions fail;
 * MSSR never turns a missing result or analyzer exception into invented evidence.
 */
export function normalizeArchitectureSymbolAnalysisEvidence(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  evidenceInput: ArchitectureSymbolHostEvidence,
): NormalizedArchitectureSymbolEvidence {
  const evidence = architectureSymbolHostEvidenceSchema.parse(evidenceInput);
  const plan = findAnalysisPlan(impactManifest, structureInput, evidence.architectureId, evidence.ref);
  const expectedKeys = new Set(plan.selectors.map(architectureSymbolSelectorKey));
  const byKey = new Map(evidence.results.map((result) => [architectureSymbolSelectorKey(result.selector), result] as const));

  const extras = [...byKey.keys()].filter((key) => !expectedKeys.has(key));
  if (extras.length > 0) {
    throw new Error(
      `Architecture symbol evidence contains undeclared selector results for ${plan.architectureId}:${plan.ref}: ${extras.join(", ")}`,
    );
  }

  const missing = plan.selectors
    .map((selector) => architectureSymbolSelectorKey(selector))
    .filter((key) => !byKey.has(key));
  if (missing.length > 0) {
    throw new Error(
      `Architecture symbol evidence omitted declared selectors for ${plan.architectureId}:${plan.ref}: ${missing.join(", ")}. Return explicit missing or unavailable evidence instead of omitting a selector.`,
    );
  }

  return normalizedArchitectureSymbolEvidenceSchema.parse({
    schemaVersion: MSSR_ARCHITECTURE_SYMBOL_ANALYSIS_SCHEMA_VERSION,
    architectureId: plan.architectureId,
    relationshipClass: "declared",
    evidenceClass: "observed",
    ref: plan.ref,
    sourceRevision: evidence.sourceRevision,
    analyzerId: evidence.analyzerId,
    fingerprintScheme: evidence.fingerprintScheme,
    results: plan.selectors.map((selector) => byKey.get(architectureSymbolSelectorKey(selector))!),
  });
}

/**
 * Execute one host-owned analyzer call per declared implementation target.
 * Exceptions propagate immediately and are not retried or converted to portable
 * evidence. The callback may be implemented by Codex, OpenCode, a CLI adapter,
 * or a future optional MSSR analyzer as long as it obeys the same contract.
 */
export async function analyzeArchitectureStructureManifest(
  impactManifest: ArchitectureImpactManifest,
  structureInput: ArchitectureStructureManifest,
  analyzer: ArchitectureSymbolAnalyzer,
): Promise<NormalizedArchitectureSymbolEvidence[]> {
  const plans = planArchitectureSymbolAnalysis(impactManifest, structureInput);
  const normalized: NormalizedArchitectureSymbolEvidence[] = [];
  for (const plan of plans) {
    const raw = await analyzer(plan);
    normalized.push(normalizeArchitectureSymbolAnalysisEvidence(impactManifest, structureInput, raw));
  }
  return normalized;
}
