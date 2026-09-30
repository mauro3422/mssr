import { createHash } from "node:crypto";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  evaluateMssrExplicitVerificationIndependence,
  mssrExplicitVerificationEvidenceSchema,
} from "./explicit-verification.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Catalog one explicit correction/verifier observation. Non-independent attempts
 * are still retained as evidence of what happened, but are marked ineligible as
 * independent truth and never gain authority merely by crossing Librarian ingress.
 */
export function librarianRecordFromExplicitVerification(input: unknown): MssrLibrarianIngressRecord {
  const evidence = mssrExplicitVerificationEvidenceSchema.parse(input);
  const independence = evaluateMssrExplicitVerificationIndependence(evidence);
  const projection = {
    schemaVersion: evidence.schemaVersion,
    verificationId: evidence.verificationId,
    subject: evidence.subject,
    status: evidence.status,
    value: evidence.value ?? null,
    evidenceRef: evidence.evidenceRef,
    evidenceRevision: evidence.evidenceRevision ?? null,
    verifier: evidence.verifier,
    observedAt: evidence.observedAt,
    independence,
    advisoryOnly: true,
    authorityInfluence: false,
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    autoApplyAllowed: false,
  };
  const fingerprint = sha256(stableJson(projection));
  const namespace = evidence.status === "corrected" ? "correction" : "verification";
  const encodedSubject = `${evidence.subject.namespace}/${evidence.subject.kind}/${evidence.subject.identity}`;

  return {
    namespace,
    kind: evidence.status,
    identity: evidence.verificationId,
    sourceRef: `explicit-verification/${encodedSubject}`,
    revision: evidence.evidenceRevision ?? fingerprint,
    payloadFingerprint: fingerprint,
    metadata: projection,
    provenance: {
      producer: "explicit-corrections-verifiers",
      ...(evidence.verifier.provider ? { host: evidence.verifier.provider } : {}),
      ...(evidence.verifier.traceId ? { traceId: evidence.verifier.traceId } : {}),
    },
  };
}
