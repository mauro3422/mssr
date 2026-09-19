import {
  mssrContextMessageBatchSchema,
  type MssrContextEvidenceReference,
  type MssrContextMessage,
  type MssrContextProvenance,
} from "./context-messages.js";
import type {
  MssrSemanticConsistencyEvaluation,
  MssrSemanticConsistencyFinding,
  MssrSemanticFindingEvidence,
} from "./semantic-consistency.js";
import type { MssrSemanticUnresolvedReference } from "./semantic-relations.js";

function stableToken(value: string, max = 90): string {
  const token = value.toLowerCase().replace(/[^a-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
  return (token || "semantic").slice(0, max);
}

function provenanceFor(source: string): MssrContextProvenance {
  if (source === "git") return "git";
  if (source === "runtime" || source === "verification" || source === "test" || source === "installed" || source === "generated") return "host";
  if (source === "provider") return "provider";
  return "project";
}

function evidenceRevision(evidence: MssrSemanticFindingEvidence): string {
  const comparable = evidence.revision ?? evidence.value ?? "observed";
  return `semantic:${stableToken(evidence.extractor, 50)}:${stableToken(comparable, 80)}`.slice(0, 160);
}

function contextEvidence(evidence: MssrSemanticFindingEvidence, summary: string): MssrContextEvidenceReference {
  return {
    kind: evidence.source === "project-state"
      ? "project-state"
      : evidence.source === "project-context"
        ? "project-context"
        : evidence.source === "project-memory"
          ? "project-memory"
          : evidence.source === "changelog"
            ? "changelog"
            : evidence.source === "architecture-decision"
              ? "architecture-decision"
              : evidence.source === "verification" || evidence.source === "test"
                ? "verification"
                : "other",
    ref: evidence.sourceRef,
    summary,
    canonicalOwner: evidence.source,
    provenance: provenanceFor(evidence.source),
    freshness: "conflicting",
    ...(evidence.observedAt ? { observedAt: evidence.observedAt } : { revision: evidenceRevision(evidence) }),
  };
}

function findingEvidence(finding: MssrSemanticConsistencyFinding): MssrContextEvidenceReference[] {
  const evidence: MssrContextEvidenceReference[] = [];
  if (finding.sourceA) evidence.push(contextEvidence(finding.sourceA, `Structured current claim A for ${finding.subject}.`));
  evidence.push(contextEvidence(finding.sourceB, `Structured current claim B for ${finding.subject}.`));
  return evidence;
}

function roadmapMessage(finding: MssrSemanticConsistencyFinding): MssrContextMessage {
  const token = stableToken(`${finding.scope}:${finding.subject}`, 88);
  return {
    id: `semantic-roadmap:${token}`,
    kind: "roadmap-contradiction",
    severity: finding.severity === "error" ? "warning" : "attention",
    title: `Contradictory current state for ${finding.subject}`,
    summary: `Deterministic structured evidence disagrees about current ${finding.subject}; inspect the cited authorities before relying on the roadmap state.`,
    evidence: findingEvidence(finding),
    advisoryActions: ["inspect-reference", "replan"],
    stages: [],
    domains: [],
    actions: [],
    artifacts: [],
    needs: [],
    signals: [],
    required: finding.blocksPublication,
    priority: finding.severity === "error" ? 85 : 65,
    dedupeKey: `semantic-roadmap:${token}`,
    estimatedChars: 420,
  };
}

function unresolvedEvidence(reference: MssrSemanticUnresolvedReference, observedAt: string): MssrContextEvidenceReference {
  return {
    kind: "other",
    ref: reference.sourceRef,
    summary: `Declared ${reference.kind} relation '${reference.relationId}' cannot resolve target ${reference.toSubject}${reference.targetRef ? ` (${reference.targetRef})` : ""}.`,
    canonicalOwner: reference.owner,
    provenance: "project",
    freshness: "unavailable",
    observedAt,
  };
}

function unresolvedMessage(reference: MssrSemanticUnresolvedReference, observedAt: string): MssrContextMessage {
  const token = stableToken(`${reference.scope}:${reference.relationId}`, 88);
  const lifecycleRequired = reference.reasonCode === "required-lifecycle-target-unresolved";
  return {
    id: `semantic-unresolved:${token}`,
    kind: "unresolved-reference",
    severity: lifecycleRequired ? "warning" : "attention",
    title: `Unresolved semantic relation ${reference.relationId}`,
    summary: `Declared ${reference.kind} relation from ${reference.fromSubject} to ${reference.toSubject} is unresolved; no semantic truth is inferred from the missing target.`,
    evidence: [unresolvedEvidence(reference, observedAt)],
    advisoryActions: ["inspect-reference", "load-context"],
    stages: [],
    domains: [],
    actions: [],
    artifacts: [],
    needs: [],
    signals: [],
    required: lifecycleRequired,
    priority: lifecycleRequired ? 80 : 55,
    dedupeKey: `semantic-unresolved:${token}`,
    estimatedChars: 380,
  };
}

/**
 * Gate F producer. Only PROVEN deterministic roadmap conflicts and explicit
 * unresolved declared relations become Context Messages. Candidate/strong-review
 * evidence is intentionally silent to preserve the notice-plane signal budget.
 */
export function produceMssrSemanticContextMessages(input: Readonly<{
  evaluation: MssrSemanticConsistencyEvaluation;
  observedAt: string;
}>): MssrContextMessage[] {
  const messages: MssrContextMessage[] = [];
  const roadmapSeen = new Set<string>();
  for (const finding of input.evaluation.findings) {
    if (finding.evidenceTier !== "proven" || !finding.subject.startsWith("roadmap.")) continue;
    const key = `${finding.scope}:${finding.subject}`;
    if (roadmapSeen.has(key)) continue;
    roadmapSeen.add(key);
    messages.push(roadmapMessage(finding));
  }
  for (const reference of input.evaluation.unresolvedReferences) messages.push(unresolvedMessage(reference, input.observedAt));
  return mssrContextMessageBatchSchema.parse(messages.sort((left, right) => left.id.localeCompare(right.id)));
}
