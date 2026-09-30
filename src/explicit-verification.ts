import { z } from "zod";

export const MSSR_EXPLICIT_VERIFICATION_SCHEMA_VERSION = 1 as const;

export const MSSR_EXPLICIT_VERIFIER_KINDS = [
  "human",
  "deterministic-readback",
  "test",
  "external-system",
  "host",
  "model",
] as const;

export const MSSR_EXPLICIT_VERIFICATION_STATUSES = ["confirmed", "corrected", "rejected"] as const;

const boundedToken = z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value));
const boundedRef = z.string().trim().min(1).max(320).refine((value) => !/[\r\n]/.test(value));
const traceIdSchema = z.string().regex(/^[A-Za-z0-9._:-]{6,128}$/);

export const mssrExplicitVerificationSubjectSchema = z.object({
  namespace: boundedToken,
  kind: boundedToken,
  identity: z.string().trim().min(1).max(400).refine((value) => !/[\r\n]/.test(value)),
  proposalProvider: boundedToken.optional(),
  proposalTraceId: traceIdSchema.optional(),
}).strict();
export type MssrExplicitVerificationSubject = z.infer<typeof mssrExplicitVerificationSubjectSchema>;

export const mssrExplicitVerifierIdentitySchema = z.object({
  kind: z.enum(MSSR_EXPLICIT_VERIFIER_KINDS),
  id: boundedToken,
  provider: boundedToken.optional(),
  traceId: traceIdSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.kind === "host" || value.kind === "model") && !value.provider) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["provider"],
      message: `${value.kind} verifier requires provider identity.`,
    });
  }
});
export type MssrExplicitVerifierIdentity = z.infer<typeof mssrExplicitVerifierIdentitySchema>;

export const mssrExplicitVerificationEvidenceSchema = z.object({
  schemaVersion: z.literal(MSSR_EXPLICIT_VERIFICATION_SCHEMA_VERSION).default(MSSR_EXPLICIT_VERIFICATION_SCHEMA_VERSION),
  verificationId: z.string().regex(/^[A-Za-z0-9._:-]{6,200}$/),
  subject: mssrExplicitVerificationSubjectSchema,
  status: z.enum(MSSR_EXPLICIT_VERIFICATION_STATUSES),
  value: z.string().trim().min(1).max(160).refine((value) => !/[\r\n]/.test(value)).optional(),
  evidenceRef: boundedRef,
  evidenceRevision: boundedToken.optional(),
  verifier: mssrExplicitVerifierIdentitySchema,
  observedAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, ctx) => {
  if (value.status === "corrected" && !value.value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Corrected explicit verification requires value." });
  }
  if (value.subject.proposalTraceId && !value.verifier.traceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["verifier", "traceId"],
      message: "Verifier traceId is required when the subject has proposalTraceId so trace independence can be proven.",
    });
  }
});
export type MssrExplicitVerificationEvidence = z.infer<typeof mssrExplicitVerificationEvidenceSchema>;

export type MssrExplicitVerificationIndependence = {
  sameProvider: boolean;
  sameTrace: boolean;
  providerIndependenceKnown: boolean;
  traceIndependenceKnown: boolean;
  independent: boolean;
  eligibleAsIndependentTruth: boolean;
  reasons: string[];
};

/**
 * Evaluate provenance independence deterministically. This proves only that the
 * explicit verifier is not the same declared provider/trace as the proposal; it
 * does not prove that the verifier's substantive conclusion is true.
 */
export function evaluateMssrExplicitVerificationIndependence(
  input: MssrExplicitVerificationEvidence | unknown,
): MssrExplicitVerificationIndependence {
  const evidence = mssrExplicitVerificationEvidenceSchema.parse(input);
  const proposalProvider = evidence.subject.proposalProvider;
  const proposalTraceId = evidence.subject.proposalTraceId;
  const verifierProvider = evidence.verifier.provider;
  const verifierTraceId = evidence.verifier.traceId;

  const sameProvider = Boolean(proposalProvider && verifierProvider && proposalProvider === verifierProvider);
  const sameTrace = Boolean(proposalTraceId && verifierTraceId && proposalTraceId === verifierTraceId);
  const providerIndependenceKnown = !proposalProvider
    || !["host", "model"].includes(evidence.verifier.kind)
    || Boolean(verifierProvider);
  const traceIndependenceKnown = !proposalTraceId || Boolean(verifierTraceId);
  const reasons: string[] = [];
  if (sameProvider) reasons.push("same-provider");
  if (sameTrace) reasons.push("same-trace");
  if (!providerIndependenceKnown) reasons.push("provider-independence-unknown");
  if (!traceIndependenceKnown) reasons.push("trace-independence-unknown");
  const independent = !sameProvider && !sameTrace && providerIndependenceKnown && traceIndependenceKnown;
  return {
    sameProvider,
    sameTrace,
    providerIndependenceKnown,
    traceIndependenceKnown,
    independent,
    eligibleAsIndependentTruth: independent,
    reasons,
  };
}

export function assertMssrExplicitVerificationIndependent(
  input: MssrExplicitVerificationEvidence | unknown,
): MssrExplicitVerificationEvidence {
  const evidence = mssrExplicitVerificationEvidenceSchema.parse(input);
  const result = evaluateMssrExplicitVerificationIndependence(evidence);
  if (!result.independent) {
    throw new Error(`Explicit verification is not independent: ${result.reasons.join(",") || "unknown-independence"}.`);
  }
  return evidence;
}
