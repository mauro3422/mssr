import { z } from "zod";
import {
  MSSR_CONTEXT_PROVENANCE,
  type MssrContextEvidenceReference,
  type MssrContextFreshness,
  mssrContextEvidenceReferenceSchema,
} from "./context-messages.js";

/**
 * A bounded current observation of stored context evidence.  Carries only the
 * fields needed to revalidate freshness: identity, provenance, availability,
 * and, when the evidence is available, a revision or observed timestamp from
 * the authoritative source.  An unavailable current observation
 * (`availability: false`) is representable even when the survey returned
 * neither a revision nor a timestamp.
 */
export const mssrContextObservationSchema = z.object({
  ref: z.string().min(1).max(240),
  canonicalOwner: z.string().min(1).max(120),
  provenance: z.enum(MSSR_CONTEXT_PROVENANCE),
  availability: z.boolean(),
  observedAt: z.string().datetime({ offset: true }).optional(),
  revision: z.string().min(1).max(160).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.availability && !value.observedAt && !value.revision) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Available current observation requires observedAt or revision." });
  }
});

export type MssrContextObservation = z.infer<typeof mssrContextObservationSchema>;

/**
 * Revalidates stored evidence against a current observation.  Advisory
 * freshness only; it never authorizes I/O or grants permissions.
 *
 * - `unavailable` when the observation reports the evidence is not available.
 * - `conflicting` when owner, provenance, or reference identity mismatch.
 * - `fresh` when a nonempty revision matches, otherwise when observedAt equal.
 * - `stale` when revision or observedAt differ.
 * - `unknown` when the inputs are insufficient to establish freshness.
 */
export function revalidateMssrContextEvidence(
  storedEvidence: MssrContextEvidenceReference,
  currentObservation: MssrContextObservation,
): MssrContextFreshness {
  const storedCheck = mssrContextEvidenceReferenceSchema.safeParse(storedEvidence);
  const observationCheck = mssrContextObservationSchema.safeParse(currentObservation);
  if (!storedCheck.success || !observationCheck.success) return "unknown";

  const stored = storedCheck.data;
  const observation = observationCheck.data;

  if (observation.availability === false) return "unavailable";

  if (
    stored.canonicalOwner !== observation.canonicalOwner
    || stored.provenance !== observation.provenance
    || stored.ref !== observation.ref
  ) {
    return "conflicting";
  }

  const storedRevision = stored.revision ?? "";
  const observationRevision = observation.revision ?? "";
  if (storedRevision || observationRevision) {
    return storedRevision === observationRevision && storedRevision !== "" ? "fresh" : "stale";
  }

  if (stored.observedAt && observation.observedAt) {
    return stored.observedAt === observation.observedAt ? "fresh" : "stale";
  }

  return "unknown";
}