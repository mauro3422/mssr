import { createHash } from "node:crypto";
import type { MssrLibrarianIngressRecord } from "./librarian-contract.js";
import {
  MSSR_SEMANTIC_EXPERIENCE_MODE,
  mssrSemanticExperienceObservationSchema,
} from "./semantic-experience.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Project one bounded Semantic Experience observation into Librarian atoms.
 *
 * The proposal/observation and its later independent verification are separate
 * records. This prevents a provider proposal from becoming truth merely because
 * the stored observation was later confirmed/corrected/rejected, and avoids
 * treating legitimate verification evolution as an identity collision.
 *
 * Raw provider output, prompts, transcripts, source bodies and private reasoning
 * cannot enter because the strict Semantic Experience observation schema does not
 * contain them.
 */
export function librarianRecordsFromSemanticExperienceObservation(input: unknown): MssrLibrarianIngressRecord[] {
  const observation = mssrSemanticExperienceObservationSchema.parse(input);
  const trace = observation.trace;

  const proposalProjection = {
    schemaVersion: observation.schemaVersion,
    mode: MSSR_SEMANTIC_EXPERIENCE_MODE,
    observedAt: observation.observedAt,
    projectKey: observation.projectKey,
    decisionKind: observation.decisionKind,
    decisionSignature: observation.decisionSignature,
    featureSignature: observation.featureSignature,
    feature: observation.feature,
    evidenceUnits: observation.evidenceUnits,
    proposal: observation.proposal ?? null,
    trace: trace ? {
      traceId: trace.traceId ?? null,
      workflowKey: trace.workflowKey ?? null,
      semanticSignatureHash: trace.semanticSignatureHash ?? null,
      finalStage: trace.finalStage ?? null,
      outcomeStatus: trace.outcomeStatus ?? null,
      accepted: trace.accepted ?? null,
      verificationPassed: trace.verificationPassed ?? null,
      persisted: trace.persisted ?? null,
      userCorrections: trace.userCorrections ?? null,
      evidenceRefHashes: trace.evidenceRefHashes,
    } : null,
    advisoryOnly: observation.advisoryOnly,
    authorityInfluence: observation.authorityInfluence,
    routingInfluence: observation.routingInfluence,
    canonicalRewriteAllowed: observation.canonicalRewriteAllowed,
    autoApplyAllowed: observation.autoApplyAllowed,
  };
  const proposalFingerprint = sha256(stableJson(proposalProjection));

  const records: MssrLibrarianIngressRecord[] = [{
    namespace: "experience",
    kind: "observation",
    identity: observation.id,
    sourceRef: `semantic-experience/observation/${observation.id}`,
    revision: proposalFingerprint,
    payloadFingerprint: observation.decisionSignature,
    metadata: proposalProjection,
    provenance: {
      producer: "semantic-experience",
      ...(trace?.traceId ? { traceId: trace.traceId } : {}),
    },
  }];

  if (observation.verification.status !== "unknown") {
    const verificationProjection = {
      schemaVersion: observation.schemaVersion,
      mode: MSSR_SEMANTIC_EXPERIENCE_MODE,
      observationId: observation.id,
      projectKey: observation.projectKey,
      decisionKind: observation.decisionKind,
      decisionSignature: observation.decisionSignature,
      featureSignature: observation.featureSignature,
      status: observation.verification.status,
      value: observation.verification.value ?? null,
      evidenceRef: observation.verification.evidenceRef ?? null,
      evidenceRevision: observation.verification.evidenceRevision ?? null,
      verificationId: observation.verification.verificationId ?? null,
      verifier: observation.verification.verifier ?? null,
      independent: observation.verification.independent === true,
      verifiedAt: observation.verification.verifiedAt ?? null,
      proposalProvider: observation.proposal?.provider ?? null,
      proposalModelId: observation.proposal?.modelId ?? null,
      proposalValue: observation.proposal?.value ?? null,
      advisoryOnly: observation.advisoryOnly,
      authorityInfluence: observation.authorityInfluence,
      routingInfluence: observation.routingInfluence,
      canonicalRewriteAllowed: observation.canonicalRewriteAllowed,
      autoApplyAllowed: observation.autoApplyAllowed,
    };
    const verificationFingerprint = sha256(stableJson(verificationProjection));
    records.push({
      namespace: "experience",
      kind: "verification",
      identity: `${observation.id}:${verificationFingerprint}`,
      sourceRef: `semantic-experience/verification/${observation.id}`,
      revision: verificationFingerprint,
      payloadFingerprint: verificationFingerprint,
      metadata: verificationProjection,
      provenance: {
        producer: "semantic-experience",
        ...(trace?.traceId ? { traceId: trace.traceId } : {}),
      },
    });
  }

  return records;
}
