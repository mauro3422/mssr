import { createHash } from "node:crypto";

import { mssrLearningDigestSchema, type MssrLearningDigest } from "./learning.js";
import { projectMssrSemanticTraceLearning } from "./semantic-curation-distillation.js";
import {
  createMssrSemanticExperienceObservation,
  type MssrSemanticExperienceObservation,
} from "./semantic-experience.js";
import {
  appendMssrSemanticExperienceObservations,
  attachMssrSemanticExperienceTrace,
} from "./semantic-experience-store.js";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeToken(value: string, fallback = "unknown"): string {
  const compact = value.trim().replace(/[\r\n]+/g, " ").slice(0, 120);
  return compact || fallback;
}

function evidencePrefix(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/");
  const colon = normalized.indexOf(":");
  const slash = normalized.indexOf("/");
  const cut = [colon, slash].filter((index) => index > 0).sort((a, b) => a - b)[0];
  return safeToken(cut ? normalized.slice(0, cut) : normalized.slice(0, 80), "evidence");
}

export type MssrSemanticExperienceDigestProjection = Readonly<{
  traceId: string;
  workflowKey?: string;
  projectKey: string;
  observations: readonly MssrSemanticExperienceObservation[];
  counts: Readonly<Record<string, number>>;
  contextSelections: number;
  driftInterpretations: number;
  maintenanceDispositions: number;
  abstentionPolicies: number;
  rawTraceLoaded: false;
  rawSourceTextStored: false;
  verificationStateChanged: false;
  advisoryOnly: true;
  authorityInfluence: false;
  routingInfluence: false;
  canonicalRewriteAllowed: false;
  autoApplyAllowed: false;
}>;

/**
 * Project one strict privacy-safe learning digest into Semantic Experience shadows.
 *
 * The digest is already the durable retention boundary for a trace. This function
 * intentionally does not read the raw trace, source text, prompts or transcripts.
 * It also never self-confirms a decision: every generated observation remains
 * verification=unknown until independent evidence confirms/corrects/rejects it.
 */
export function projectMssrLearningDigestSemanticExperiences(args: {
  traceId: string;
  workflowKey?: string;
  projectKey: string;
  digest: MssrLearningDigest;
  evidenceRefs?: readonly string[];
  observedAt?: string;
}): MssrSemanticExperienceDigestProjection {
  const digest = mssrLearningDigestSchema.parse(args.digest);
  const observedAt = args.observedAt ?? new Date().toISOString();
  const trace = projectMssrSemanticTraceLearning({
    traceId: args.traceId,
    ...(args.workflowKey ? { workflowKey: args.workflowKey } : {}),
    digest,
    evidenceRefs: [...(args.evidenceRefs ?? [])].slice(0, 12),
  });
  const intentSignature = hash(digest.semanticSignature).slice(0, 24);
  const observations: MssrSemanticExperienceObservation[] = [];

  for (const selection of digest.contextSelections) {
    const feature = {
      subjectKind: "context-candidate",
      candidateKinds: [selection.scope],
      signals: digest.signals.slice(0, 20),
      flags: {},
      buckets: {
        owner: safeToken(selection.owner),
        module: safeToken(selection.module),
        stage: digest.finalStage,
        intentSignature,
      },
    };
    observations.push(createMssrSemanticExperienceObservation({
      projectKey: args.projectKey,
      decisionKind: "context-selection",
      feature,
      evidenceUnits: [{
        sourceRef: `context:${selection.scope}:${selection.owner}:${selection.module}`.slice(0, 320),
        role: selection.scope,
        selected: selection.selected,
        reasonCode: selection.reasonCode,
      }],
      proposal: {
        value: selection.selected ? "select" : "skip",
        confidence: 1,
        provider: "mssr-learning-digest",
        modelId: "deterministic-projection-v1",
      },
      trace,
      observedAt,
    }));

    if (!selection.selected && (selection.reasonCode === "ambiguous" || selection.reasonCode === "host-policy")) {
      observations.push(createMssrSemanticExperienceObservation({
        projectKey: args.projectKey,
        decisionKind: "abstention-policy",
        feature: {
          subjectKind: "context-selection",
          candidateKinds: [selection.scope],
          signals: [selection.reasonCode, ...digest.signals].slice(0, 20),
          flags: {},
          buckets: {
            owner: safeToken(selection.owner),
            module: safeToken(selection.module),
            stage: digest.finalStage,
            intentSignature,
          },
        },
        evidenceUnits: [{
          sourceRef: `context:${selection.scope}:${selection.owner}:${selection.module}`.slice(0, 320),
          role: "abstained-context-candidate",
          selected: false,
          reasonCode: selection.reasonCode,
        }],
        proposal: {
          value: "abstain",
          confidence: 1,
          provider: "mssr-learning-digest",
          modelId: "deterministic-projection-v1",
        },
        trace,
        observedAt,
      }));
    }
  }

  const conflictingEvidence = digest.signals.includes("conflicting-evidence");
  if (conflictingEvidence) {
    for (const finding of digest.findings) {
      observations.push(createMssrSemanticExperienceObservation({
        projectKey: args.projectKey,
        decisionKind: "drift-interpretation",
        feature: {
          subjectKind: "evidence-finding",
          candidateKinds: ["supported", "rejected"],
          signals: ["conflicting-evidence", ...finding.signals].slice(0, 20),
          flags: {},
          buckets: {
            evidenceKind: evidencePrefix(finding.evidenceRef),
            stage: digest.finalStage,
            intentSignature,
          },
        },
        evidenceUnits: [{
          sourceRef: finding.evidenceRef.slice(0, 320),
          role: "learning-finding",
        }],
        proposal: {
          value: finding.status === "supported" ? "drift-supported" : "drift-rejected",
          confidence: 1,
          provider: "mssr-learning-digest",
          modelId: "deterministic-projection-v1",
        },
        trace,
        observedAt,
      }));
    }
  }

  const closeReady = digest.outcome.status === "success"
    && digest.outcome.accepted !== false
    && digest.outcome.verificationPassed === true
    && digest.outcome.persisted === true;
  observations.push(createMssrSemanticExperienceObservation({
    projectKey: args.projectKey,
    decisionKind: "maintenance-disposition",
    feature: {
      subjectKind: "trace-close",
      candidateKinds: ["close-ready", "review"],
      signals: digest.signals.slice(0, 20),
      flags: {
        accepted: digest.outcome.accepted === true,
        verificationPassed: digest.outcome.verificationPassed === true,
        persisted: digest.outcome.persisted === true,
        hasFindings: digest.findings.length > 0,
      },
      buckets: {
        status: digest.outcome.status,
        stage: digest.finalStage,
        intentSignature,
      },
    },
    evidenceUnits: (args.evidenceRefs ?? []).slice(0, 12).map((sourceRef) => ({ sourceRef: sourceRef.slice(0, 320), role: "trace-outcome-evidence" })),
    proposal: {
      value: closeReady ? "close-ready" : "review",
      confidence: 1,
      provider: "mssr-learning-digest",
      modelId: "deterministic-projection-v1",
    },
    trace,
    observedAt,
  }));

  const counts: Record<string, number> = {};
  for (const observation of observations) counts[observation.decisionKind] = (counts[observation.decisionKind] ?? 0) + 1;

  return {
    traceId: args.traceId,
    ...(args.workflowKey ? { workflowKey: args.workflowKey } : {}),
    projectKey: args.projectKey,
    observations,
    counts,
    contextSelections: counts["context-selection"] ?? 0,
    driftInterpretations: counts["drift-interpretation"] ?? 0,
    maintenanceDispositions: counts["maintenance-disposition"] ?? 0,
    abstentionPolicies: counts["abstention-policy"] ?? 0,
    rawTraceLoaded: false,
    rawSourceTextStored: false,
    verificationStateChanged: false,
    advisoryOnly: true,
    authorityInfluence: false,
    routingInfluence: false,
    canonicalRewriteAllowed: false,
    autoApplyAllowed: false,
  };
}

/**
 * Persist digest-derived shadow experiences and hydrate any pre-existing shadows
 * that already carry the same trace identity. Failures are intentionally left
 * to the host to handle as advisory/fail-open; this function itself is strict.
 */
export async function persistMssrLearningDigestSemanticExperiences(args: {
  traceId: string;
  workflowKey?: string;
  projectKey: string;
  digest: MssrLearningDigest;
  evidenceRefs?: readonly string[];
  storePath?: string;
  observedAt?: string;
}) {
  const projection = projectMssrLearningDigestSemanticExperiences(args);
  const appended = await appendMssrSemanticExperienceObservations({
    observations: projection.observations,
    ...(args.storePath ? { storePath: args.storePath } : {}),
  });
  const trace = projectMssrSemanticTraceLearning({
    traceId: args.traceId,
    ...(args.workflowKey ? { workflowKey: args.workflowKey } : {}),
    digest: mssrLearningDigestSchema.parse(args.digest),
    evidenceRefs: [...(args.evidenceRefs ?? [])].slice(0, 12),
  });
  const hydrated = await attachMssrSemanticExperienceTrace({
    trace,
    ...(args.storePath ? { storePath: args.storePath } : {}),
  });
  return {
    traceId: projection.traceId,
    workflowKey: projection.workflowKey ?? null,
    projectKey: projection.projectKey,
    added: appended.added,
    total: appended.total,
    hydratedMatched: hydrated.matched,
    hydratedUpdated: hydrated.updated,
    counts: projection.counts,
    verificationStateChanged: false as const,
    rawTraceLoaded: false as const,
    rawSourceTextStored: false as const,
    advisoryOnly: true as const,
    authorityInfluence: false as const,
    routingInfluence: false as const,
    canonicalRewriteAllowed: false as const,
    autoApplyAllowed: false as const,
  };
}
